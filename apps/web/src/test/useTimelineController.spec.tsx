import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTimelineController } from '../hooks/useTimelineController'
import type { MessageDto, MessagesPageDto } from '../types/api'

const mockScrollToIndex = vi.fn()
const mockGetTotalSize = vi.fn(() => 1000)

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: mockGetTotalSize,
    getVirtualItems: () => [],
    measureElement: () => undefined,
    scrollToIndex: mockScrollToIndex,
  }),
}))

type FeedMock = {
  isLoadingNext: boolean
  isLoadingPrevious: boolean
  loadNext: () => Promise<boolean>
  loadPrevious: () => Promise<boolean>
  refetch: () => void
  resetWithData: (data: MessagesPageDto) => void
}

type ControllerInput = Parameters<typeof useTimelineController>[0]

function buildMessage(id: number): MessageDto {
  return {
    id,
    sourceRowId: id,
    messageTimestamp: new Date(`2023-10-17T16:${String(id % 60).padStart(2, '0')}:00.000Z`).toISOString(),
    authorId: 'tester',
    authorName: 'Tester',
    content: `message-${id}`,
    attachmentsRaw: null,
    reactionsRaw: null,
  }
}

function buildPage(items: MessageDto[], cursors?: { next?: string | null; prev?: string | null }): MessagesPageDto {
  return {
    items,
    nextCursor: cursors?.next ?? null,
    prevCursor: cursors?.prev ?? null,
  }
}

function createScroller(scrollTop = 0, scrollHeight = 1200, clientHeight = 200) {
  const scroller = document.createElement('div')

  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    writable: true,
    value: scrollTop,
  })
  Object.defineProperty(scroller, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  })
  Object.defineProperty(scroller, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  })

  return scroller
}

function createInput(overrides: Partial<ControllerInput> = {}): { input: ControllerInput; feed: FeedMock } {
  const page = buildPage([buildMessage(1), buildMessage(2)], { next: 'next-1', prev: 'prev-1' })
  const feed: FeedMock = {
    isLoadingNext: false,
    isLoadingPrevious: false,
    loadNext: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    loadPrevious: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    refetch: vi.fn(),
    resetWithData: vi.fn<(data: MessagesPageDto) => void>(),
  }

  const input: ControllerInput = {
    isSearchMode: false,
    activeState: { data: page, isLoading: false },
    activeItems: page.items,
    contextMessageId: null,
    highlightedMessageId: null,
    messagesFeed: feed,
    setContextMessageId: vi.fn(),
    setHighlightedMessageId: vi.fn(),
    setFeedCursor: vi.fn(),
    setFeedDir: vi.fn(),
    setSearchCursor: vi.fn(),
    clearSearchFilters: vi.fn(),
    ...overrides,
  }

  return { input, feed }
}

describe('useTimelineController', () => {
  beforeEach(() => {
    mockScrollToIndex.mockReset()
    mockGetTotalSize.mockReset()
    mockGetTotalSize.mockReturnValue(1000)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('openMessageContext updates focus state and clears search filters', () => {
    const { input } = createInput()
    const { result } = renderHook(() => useTimelineController(input))

    act(() => {
      result.current.openMessageContext(42)
    })

    expect(input.setContextMessageId).toHaveBeenCalledWith(42)
    expect(input.setHighlightedMessageId).toHaveBeenCalledWith(42)
    expect(input.clearSearchFilters).toHaveBeenCalled()
    expect(input.setSearchCursor).toHaveBeenCalledWith('')
  })

  it('openPreviousMessages loads previous in feed mode', () => {
    const { input, feed } = createInput({ contextMessageId: null, isSearchMode: false })
    const { result } = renderHook(() => useTimelineController(input))

    act(() => {
      result.current.openPreviousMessages()
    })

    expect(feed.loadPrevious).toHaveBeenCalled()
    expect(input.setFeedCursor).not.toHaveBeenCalled()
  })

  it('openNextMessages updates search cursor in search mode', () => {
    const { input, feed } = createInput({ isSearchMode: true })
    const { result } = renderHook(() => useTimelineController(input))

    act(() => {
      result.current.openNextMessages()
    })

    expect(input.setSearchCursor).toHaveBeenCalledWith('next-1')
    expect(feed.loadNext).not.toHaveBeenCalled()
  })

  it('resetTimeline clears context and refetches feed', () => {
    const { input, feed } = createInput({ contextMessageId: 10, highlightedMessageId: 10 })
    const { result } = renderHook(() => useTimelineController(input))

    act(() => {
      result.current.resetTimeline()
    })

    expect(input.setContextMessageId).toHaveBeenCalledWith(null)
    expect(input.setHighlightedMessageId).toHaveBeenCalledWith(null)
    expect(input.setFeedCursor).toHaveBeenCalledWith('')
    expect(input.setFeedDir).toHaveBeenCalledWith('next')
    expect(feed.refetch).toHaveBeenCalled()
  })

  it('auto-loads next page on bottom scroll in feed mode', async () => {
    const { input, feed } = createInput({ contextMessageId: null })
    const { result, rerender } = renderHook((props: ControllerInput) => useTimelineController(props), {
      initialProps: input,
    })

    const scroller = createScroller(1000, 1200, 200)
    act(() => {
      result.current.scrollRef.current = scroller
    })

    rerender(input)

    act(() => {
      scroller.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() => {
      expect(feed.loadNext).toHaveBeenCalled()
    })
  })

  it('does not auto-load next page before any user scroll event', () => {
    const { input, feed } = createInput({ contextMessageId: null })
    const { result, rerender } = renderHook((props: ControllerInput) => useTimelineController(props), {
      initialProps: input,
    })

    const scroller = createScroller(1000, 1200, 200)
    act(() => {
      result.current.scrollRef.current = scroller
    })

    rerender(input)

    expect(feed.loadNext).not.toHaveBeenCalled()
  })

  it('hydrates feed from context on bottom scroll before leaving context mode', async () => {
    const page = buildPage([buildMessage(41), buildMessage(42)], { next: 'cursor-next', prev: 'cursor-prev' })
    const { input, feed } = createInput({
      contextMessageId: 42,
      activeState: { data: page, isLoading: false },
      activeItems: page.items,
    })

    const { result, rerender } = renderHook((props: ControllerInput) => useTimelineController(props), {
      initialProps: input,
    })

    const scroller = createScroller(1000, 1200, 200)
    act(() => {
      result.current.scrollRef.current = scroller
    })

    rerender(input)

    act(() => {
      scroller.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() => {
      expect(feed.resetWithData).toHaveBeenCalledWith(page)
      expect(input.setContextMessageId).toHaveBeenCalledWith(null)
    })

    expect(feed.loadNext).not.toHaveBeenCalled()
  })

  it('scrolls to highlighted message only once for the same id', () => {
    const firstItems = [buildMessage(10), buildMessage(42)]
    const firstPage = buildPage(firstItems, { next: null, prev: null })
    const { input } = createInput({
      activeState: { data: firstPage, isLoading: false },
      activeItems: firstItems,
      highlightedMessageId: 42,
    })

    const { rerender } = renderHook((props: ControllerInput) => useTimelineController(props), {
      initialProps: input,
    })

    expect(mockScrollToIndex).toHaveBeenCalledTimes(1)
    expect(mockScrollToIndex).toHaveBeenCalledWith(1, { align: 'center' })

    const nextItems = [buildMessage(10), buildMessage(42), buildMessage(43)]
    const nextPage = buildPage(nextItems, { next: null, prev: null })
    const nextInput: ControllerInput = {
      ...input,
      activeState: { data: nextPage, isLoading: false },
      activeItems: nextItems,
      highlightedMessageId: 42,
    }

    rerender(nextInput)

    expect(mockScrollToIndex).toHaveBeenCalledTimes(1)
  })

  it('does not auto-exit context mode on re-bind edge check after focus scroll', async () => {
    const page = buildPage([buildMessage(41), buildMessage(42)], { next: 'cursor-next', prev: 'cursor-prev' })
    const { input, feed } = createInput({
      contextMessageId: 42,
      activeState: { data: page, isLoading: false },
      activeItems: page.items,
      highlightedMessageId: 42,
    })

    const { result, rerender } = renderHook((props: ControllerInput) => useTimelineController(props), {
      initialProps: input,
    })

    const scroller = createScroller(300, 1200, 200)
    act(() => {
      result.current.scrollRef.current = scroller
    })

    rerender(input)

    act(() => {
      scroller.dispatchEvent(new Event('scroll'))
    })

    // Simulate later render while context mode is still active; immediate edge check must be skipped.
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 })
    rerender(input)

    await waitFor(() => {
      expect(feed.resetWithData).not.toHaveBeenCalled()
      expect(input.setContextMessageId).not.toHaveBeenCalledWith(null)
    })
  })
})

    describe('regression: loadPrevious not triggered when dragging scrollbar fast to top', () => {
    it('calls loadPrevious on listener re-bind when scroller is already at top edge', async () => {
        // Regression: after a fast drag to scrollTop=0 the browser fires no further scroll events.
        // The fix calls onTimelineScroll() immediately after each re-bind, so the edge check
        // fires even if the user stopped scrolling before the listener was attached.
      const page = buildPage([buildMessage(1), buildMessage(2)], { next: 'next-1', prev: 'prev-1' })
      const { input, feed } = createInput({
        activeState: { data: page, isLoading: false },
        activeItems: page.items,
      })

      const { result, rerender } = renderHook((props: ControllerInput) => useTimelineController(props), {
        initialProps: input,
      })

          // Scroller starts away from the top so the initial bind and first scroll don't trigger a load.
          const scroller = createScroller(300, 1200, 200)
      act(() => {
        result.current.scrollRef.current = scroller
      })

          // Attach listener (scrollTop=300, wasScrolledRef still false → no immediate call on bind).
          rerender(input)

          // Fire a real scroll event to set wasScrolledRef=true. scrollTop=300 is outside the edge
          // threshold (>160) so no load is triggered here.
          act(() => {
            scroller.dispatchEvent(new Event('scroll'))
          })

          // Fast drag to top: update scrollTop to 0 without dispatching a scroll event —
          // exactly the scenario that caused the bug.
          Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 })

          // Re-bind (rowVirtualizer new identity from mock → onTimelineScroll recreates → effect re-runs).
          // wasScrolledRef=true → immediate onTimelineScroll() fires → top edge detected → loadPrevious.
          rerender(input)

      await waitFor(() => {
        expect(feed.loadPrevious).toHaveBeenCalled()
      })
    })

    it('does not call loadPrevious a second time while prepend anchor is still pending', async () => {
        // Regression guard: between the synchronous capturePrependAnchor() call and the async
        // isLoadingPrevious React state update, another re-bind could fire a duplicate load.
        // The !prependAnchorRef.current guard blocks it. rAF is mocked so the anchor is never
        // cleared by the compensation effect during this test.
      vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0 as unknown as ReturnType<typeof requestAnimationFrame>)

      const page = buildPage([buildMessage(1), buildMessage(2)], { next: 'next-1', prev: 'prev-1' })
      const { input, feed } = createInput({
        activeState: { data: page, isLoading: false },
        activeItems: page.items,
      })

      const { result, rerender } = renderHook((props: ControllerInput) => useTimelineController(props), {
        initialProps: input,
      })

          const scroller = createScroller(300, 1200, 200)
      act(() => {
        result.current.scrollRef.current = scroller
      })

          // Attach listener (no immediate call yet — wasScrolledRef=false on first bind).
          rerender(input)

          // Mark wasScrolledRef=true via a real scroll event. scrollTop=300 is outside the edge.
          act(() => {
            scroller.dispatchEvent(new Event('scroll'))
          })

          // Fast drag to top (no scroll event).
          Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 })

          // First re-bind at top: immediate call fires, capturePrependAnchor sets the anchor, loadPrevious called.
          rerender(input)
          await waitFor(() => {
        expect(feed.loadPrevious).toHaveBeenCalledTimes(1)
      })

      // Second re-bind: anchor is still set (rAF callback never ran), guard blocks second load.
      rerender(input)

      expect(feed.loadPrevious).toHaveBeenCalledTimes(1)
    })
  })
