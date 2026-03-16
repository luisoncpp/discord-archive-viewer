import { useCallback, useEffect, useState } from 'react'
import { listMessages, type ListMessagesInput } from '../services/apiClient'
import type { MessageDto, MessagesPageDto } from '../types/api'

type MessagesFeedState = {
  data: MessagesPageDto | null
  isLoading: boolean
  isLoadingNext: boolean
  isLoadingPrevious: boolean
  error: string | null
  isEmpty: boolean
}

function mergeItems(currentItems: MessageDto[], incomingItems: MessageDto[], position: 'prepend' | 'append') {
  const mergedItems = position === 'prepend'
    ? [...incomingItems, ...currentItems]
    : [...currentItems, ...incomingItems]

  const seenIds = new Set<number>()

  return mergedItems.filter((message) => {
    if (seenIds.has(message.id)) {
      return false
    }

    seenIds.add(message.id)
    return true
  })
}

export function useMessagesFeed(input: ListMessagesInput = {}) {
  const { cursor, dir = 'next', limit = 40 } = input
  const [state, setState] = useState<MessagesFeedState>({
    data: null,
    isLoading: true,
    isLoadingNext: false,
    isLoadingPrevious: false,
    error: null,
    isEmpty: false,
  })
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    let isCancelled = false

    async function run() {
      setState((previous) => ({
        ...previous,
        isLoading: true,
        isLoadingNext: false,
        isLoadingPrevious: false,
        error: null,
      }))

      try {
        const data = await listMessages({ cursor, dir, limit })
        if (isCancelled) {
          return
        }

        setState({
          data,
          isLoading: false,
          isLoadingNext: false,
          isLoadingPrevious: false,
          error: null,
          isEmpty: data.items.length === 0,
        })
      } catch (error) {
        if (isCancelled) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unknown error'
        setState({
          data: null,
          isLoading: false,
          isLoadingNext: false,
          isLoadingPrevious: false,
          error: message,
          isEmpty: true,
        })
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [cursor, dir, limit, reloadNonce])

  const loadMore = useCallback(
    async (direction: 'next' | 'prev') => {
      const currentData = state.data
      const pageCursor = direction === 'prev' ? currentData?.prevCursor : currentData?.nextCursor

      if (!pageCursor || state.isLoading || state.isLoadingNext || state.isLoadingPrevious) {
        return false
      }

      setState((previous) => ({
        ...previous,
        error: null,
        isLoadingNext: direction === 'next',
        isLoadingPrevious: direction === 'prev',
      }))

      try {
        const nextPage = await listMessages({ cursor: pageCursor, dir: direction, limit })

        setState((previous) => {
          const previousData = previous.data
          if (!previousData) {
            return {
              data: nextPage,
              isLoading: false,
              isLoadingNext: false,
              isLoadingPrevious: false,
              error: null,
              isEmpty: nextPage.items.length === 0,
            }
          }

          return {
            data: {
              items: mergeItems(
                previousData.items,
                nextPage.items,
                direction === 'prev' ? 'prepend' : 'append',
              ),
              prevCursor: direction === 'prev' ? nextPage.prevCursor : previousData.prevCursor,
              nextCursor: direction === 'next' ? nextPage.nextCursor : previousData.nextCursor,
            },
            isLoading: false,
            isLoadingNext: false,
            isLoadingPrevious: false,
            error: null,
            isEmpty: false,
          }
        })

        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        setState((previous) => ({
          ...previous,
          isLoadingNext: false,
          isLoadingPrevious: false,
          error: message,
        }))

        return false
      }
    },
    [limit, state.data, state.isLoading, state.isLoadingNext, state.isLoadingPrevious],
  )

  return {
    ...state,
    refetch: () => setReloadNonce((value) => value + 1),
    loadNext: () => loadMore('next'),
    loadPrevious: () => loadMore('prev'),
  }
}
