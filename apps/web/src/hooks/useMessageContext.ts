import { useEffect, useState } from 'react'
import { getMessageContext } from '../services/apiClient'
import type { MessagesPageDto } from '../types/api'

type MessageContextState = {
  data: MessagesPageDto | null
  isLoading: boolean
  error: string | null
  isEmpty: boolean
}

export function useMessageContext(messageId: number | null, before = 10, after = 10) {
  const [state, setState] = useState<MessageContextState>({
    data: null,
    isLoading: false,
    error: null,
    isEmpty: true,
  })

  useEffect(() => {
    let isCancelled = false

    async function run() {
      if (!messageId) {
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
        const data = await getMessageContext({ id: messageId, before, after })
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
  }, [messageId, before, after])

  return state
}
