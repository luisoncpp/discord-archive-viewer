import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { MessageDto, MessagesPageDto } from '../types/api'

const mockUseMessagesFeed = vi.fn()
const mockUseSearchMessages = vi.fn()
const mockUseMessageContext = vi.fn()
const mockScrollToIndex = vi.fn()

vi.mock('../hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: string) => value,
}))

vi.mock('../hooks/useMessagesFeed', () => ({
  useMessagesFeed: (input: unknown) => mockUseMessagesFeed(input),
}))

vi.mock('../hooks/useSearchMessages', () => ({
  useSearchMessages: (input: unknown) => mockUseSearchMessages(input),
}))

vi.mock('../hooks/useMessageContext', () => ({
  useMessageContext: (id: number | null, before: number, after: number) => mockUseMessageContext(id, before, after),
}))

vi.mock('../features/messages/MessageContent', () => ({
  MessageContent: ({ content }: { content: string | null }) => <p>{content ?? ''}</p>,
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 100 })),
    scrollToIndex: mockScrollToIndex,
    measureElement: () => undefined,
  }),
}))

type FeedState = {
  data: MessagesPageDto | null
  isLoading: boolean
  isLoadingNext: boolean
  isLoadingPrevious: boolean
  error: string | null
  isEmpty: boolean
  refetch: () => void
  loadNext: () => Promise<boolean>
  loadPrevious: () => Promise<boolean>
}

type QueryState = {
  data: MessagesPageDto | null
  isLoading: boolean
  error: string | null
  isEmpty: boolean
}

function buildMessage(id: number, author = 'Tester'): MessageDto {
  return {
    id,
    sourceRowId: id,
    messageTimestamp: new Date(`2023-10-17T16:${String(id % 60).padStart(2, '0')}:00.000Z`).toISOString(),
    authorId: author.toLowerCase(),
    authorName: author,
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

function createFeedState(page: MessagesPageDto): FeedState {
  return {
    data: page,
    isLoading: false,
    isLoadingNext: false,
    isLoadingPrevious: false,
    error: null,
    isEmpty: page.items.length === 0,
    refetch: vi.fn(),
    loadNext: vi.fn().mockResolvedValue(true),
    loadPrevious: vi.fn().mockResolvedValue(true),
  }
}

function createQueryState(page: MessagesPageDto | null): QueryState {
  return {
    data: page,
    isLoading: false,
    error: null,
    isEmpty: !page || page.items.length === 0,
  }
}

let messagesFeedState: FeedState
let searchState: QueryState
let contextState: QueryState

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
})

beforeEach(() => {
  messagesFeedState = createFeedState(buildPage([buildMessage(1), buildMessage(2)], { next: 'next-1', prev: 'prev-1' }))
  searchState = createQueryState(null)
  contextState = createQueryState(null)

  mockUseMessagesFeed.mockImplementation(() => messagesFeedState)
  mockUseSearchMessages.mockImplementation(() => searchState)
  mockUseMessageContext.mockImplementation(() => contextState)
  mockScrollToIndex.mockReset()
})

describe('App', () => {
  it('renders heading and feed messages', () => {
    render(<App />)

    expect(screen.getByText(/Discord Archive Viewer/i)).toBeInTheDocument()
    expect(screen.getByText('message-1')).toBeInTheDocument()
    expect(screen.getByText('message-2')).toBeInTheDocument()
  })

  it('passes search input to search hook', async () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText(/Buscar mensajes/i), {
      target: { value: 'touhou' },
    })

    await waitFor(() => {
      expect(mockUseSearchMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({
          q: 'touhou',
          limit: 50,
        }),
      )
    })
  })

  it('opens focused context when clicking a search result', async () => {
    window.history.replaceState({}, '', '/?q=touhou')
    const focusedMessage = buildMessage(42, 'SearchUser')

    searchState = createQueryState(buildPage([focusedMessage], { next: null, prev: null }))
    mockUseSearchMessages.mockImplementation(() => searchState)
    mockUseMessageContext.mockImplementation((id: number | null) => {
      if (id === 42) {
        return createQueryState(buildPage([focusedMessage]))
      }

      return createQueryState(null)
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockUseMessageContext).toHaveBeenCalledWith(42, 15, 15)
    })
  })

  it('auto-loads next page when scroller reaches bottom', async () => {
    const loadNext = vi.fn().mockResolvedValue(true)
    messagesFeedState = {
      ...messagesFeedState,
      loadNext,
      data: buildPage([buildMessage(1), buildMessage(2)], { next: 'cursor-next', prev: null }),
    }
    mockUseMessagesFeed.mockImplementation(() => messagesFeedState)

    const { container } = render(<App />)
    const scroller = container.querySelector('.discord-message-scroller') as HTMLDivElement

    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 1000 })

    fireEvent.scroll(scroller)

    await waitFor(() => {
      expect(loadNext).toHaveBeenCalled()
    })
  })

  it('auto-loads previous page when scroller reaches top while moving up', async () => {
    const loadPrevious = vi.fn().mockResolvedValue(true)
    messagesFeedState = {
      ...messagesFeedState,
      loadPrevious,
      data: buildPage([buildMessage(10), buildMessage(11)], { next: null, prev: 'cursor-prev' }),
    }
    mockUseMessagesFeed.mockImplementation(() => messagesFeedState)

    const { container } = render(<App />)
    const scroller = container.querySelector('.discord-message-scroller') as HTMLDivElement

    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 300 })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 300 })
    fireEvent.scroll(scroller)

    scroller.scrollTop = 0
    fireEvent.scroll(scroller)

    await waitFor(() => {
      expect(loadPrevious).toHaveBeenCalled()
    })
  })
})
