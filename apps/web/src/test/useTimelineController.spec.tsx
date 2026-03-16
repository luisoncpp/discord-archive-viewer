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
})
