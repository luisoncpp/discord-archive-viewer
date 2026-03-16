import { useEffect, useState } from 'react'
import { listMessages, type ListMessagesInput } from '../services/apiClient'
import type { MessagesPageDto } from '../types/api'

type MessagesFeedState = {
  data: MessagesPageDto | null
  isLoading: boolean
  error: string | null
  isEmpty: boolean
}

export function useMessagesFeed(input: ListMessagesInput = {}) {
  const { cursor, dir = 'next', limit = 100 } = input
  const [state, setState] = useState<MessagesFeedState>({
    data: null,
    isLoading: true,
    error: null,
    isEmpty: false,
  })
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    let isCancelled = false

    async function run() {
      setState((previous) => ({ ...previous, isLoading: true, error: null }))

      try {
        const data = await listMessages({ cursor, dir, limit })
        if (isCancelled) {
          return
        }

        setState({
          data,
          isLoading: false,
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

  return {
    ...state,
    refetch: () => setReloadNonce((value) => value + 1),
  }
}
