import { useEffect, useState } from 'react'
import { searchMessages, type SearchMessagesInput } from '../services/apiClient'
import type { MessagesPageDto } from '../types/api'

type SearchState = {
  data: MessagesPageDto | null
  isLoading: boolean
  error: string | null
  isEmpty: boolean
}

export function useSearchMessages(input: SearchMessagesInput | null) {
  const query = input?.q
  const cursor = input?.cursor
  const limit = input?.limit ?? 50

  const [state, setState] = useState<SearchState>({
    data: null,
    isLoading: false,
    error: null,
    isEmpty: true,
  })
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    let isCancelled = false

    async function run() {
      if (!query || query.trim().length < 2) {
        setState({
          data: null,
          isLoading: false,
          error: null,
          isEmpty: true,
        })
        return
      }

      setState((previous) => ({ ...previous, isLoading: true, error: null }))

      try {
        const data = await searchMessages({ q: query, cursor, limit })
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
  }, [query, cursor, limit, reloadNonce])

  return {
    ...state,
    refetch: () => setReloadNonce((value) => value + 1),
  }
}
