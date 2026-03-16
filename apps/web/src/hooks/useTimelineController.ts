import { useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { MessageDto, MessagesPageDto } from '../types/api'

const AUTO_LOAD_EDGE_THRESHOLD = 160

type ActiveState = {
  data: MessagesPageDto | null
  isLoading: boolean
}

type MessagesFeedController = {
  isLoadingNext: boolean
  isLoadingPrevious: boolean
  loadNext: () => Promise<boolean>
  loadPrevious: () => Promise<boolean>
  refetch: () => void
  resetWithData: (data: MessagesPageDto) => void
}

type UseTimelineControllerInput = {
  isSearchMode: boolean
  activeState: ActiveState
  activeItems: MessageDto[]
  contextMessageId: number | null
  highlightedMessageId: number | null
  messagesFeed: MessagesFeedController
  setContextMessageId: (value: number | null) => void
  setHighlightedMessageId: (value: number | null) => void
  setFeedCursor: (value: string) => void
  setFeedDir: (value: 'next' | 'prev') => void
  setSearchCursor: (value: string) => void
  clearSearchFilters: () => void
}

export function useTimelineController({
  isSearchMode,
  activeState,
  activeItems,
  contextMessageId,
  highlightedMessageId,
  messagesFeed,
  setContextMessageId,
  setHighlightedMessageId,
  setFeedCursor,
  setFeedDir,
  setSearchCursor,
  clearSearchFilters,
}: UseTimelineControllerInput) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const scrollTopRef = useRef(0)
  const prependAnchorRef = useRef<{ scrollTop: number; totalSize: number } | null>(null)
  const autoLoadNextCursorRef = useRef<string | null>(null)
  const lastScrolledFocusIdRef = useRef<number | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: activeItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92,
    overscan: 10,
    getItemKey: (index) => activeItems[index]?.id ?? index,
  })

  useEffect(() => {
    const anchor = prependAnchorRef.current
    if (!anchor || messagesFeed.isLoadingPrevious) {
      return
    }

    const scroller = scrollRef.current
    if (!scroller) {
      prependAnchorRef.current = null
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const nextTotalSize = rowVirtualizer.getTotalSize()
      scroller.scrollTop = anchor.scrollTop + Math.max(0, nextTotalSize - anchor.totalSize)
      prependAnchorRef.current = null
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [activeItems.length, messagesFeed.isLoadingPrevious, rowVirtualizer])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || isSearchMode) {
      return
    }

    function handleScroll() {
      const element = scrollRef.current
      if (!element) {
        return
      }

      const currentScrollTop = element.scrollTop
      const scrollDirection = currentScrollTop - scrollTopRef.current
      scrollTopRef.current = currentScrollTop

      const edgeThreshold = AUTO_LOAD_EDGE_THRESHOLD
      const distanceFromBottom = element.scrollHeight - currentScrollTop - element.clientHeight

      if (
        scrollDirection < 0 &&
        currentScrollTop <= edgeThreshold &&
        activeState.data?.prevCursor &&
        !activeState.isLoading &&
        (contextMessageId !== null || !messagesFeed.isLoadingPrevious)
      ) {
        if (contextMessageId !== null) {
          messagesFeed.resetWithData(activeState.data)
          setContextMessageId(null)
        } else {
          prependAnchorRef.current = {
            scrollTop: currentScrollTop,
            totalSize: rowVirtualizer.getTotalSize(),
          }
          void messagesFeed.loadPrevious()
        }

        return
      }

      if (
        distanceFromBottom <= edgeThreshold &&
        activeState.data?.nextCursor &&
        (contextMessageId !== null || autoLoadNextCursorRef.current !== activeState.data.nextCursor) &&
        !activeState.isLoading &&
        (contextMessageId !== null || !messagesFeed.isLoadingNext)
      ) {
        if (contextMessageId !== null) {
          messagesFeed.resetWithData(activeState.data)
          setContextMessageId(null)
        } else {
          autoLoadNextCursorRef.current = activeState.data.nextCursor
          void messagesFeed.loadNext().then((loaded) => {
            if (!loaded) {
              autoLoadNextCursorRef.current = null
            }
          })
        }
      }
    }

    scrollTopRef.current = scroller.scrollTop
    scroller.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      scroller.removeEventListener('scroll', handleScroll)
    }
  }, [activeState, contextMessageId, isSearchMode, messagesFeed, rowVirtualizer, setContextMessageId])

  useEffect(() => {
    autoLoadNextCursorRef.current = null
  }, [activeState.data?.nextCursor])

  useEffect(() => {
    if (isSearchMode) {
      return
    }

    const element = scrollRef.current
    if (!element) {
      return
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    if (distanceFromBottom > AUTO_LOAD_EDGE_THRESHOLD) {
      return
    }

    const currentData = activeState.data
    const nextCursor = currentData?.nextCursor
    if (!nextCursor || activeState.isLoading) {
      return
    }

    if (contextMessageId !== null) {
      messagesFeed.resetWithData(currentData)
      setContextMessageId(null)
      return
    }

    if (messagesFeed.isLoadingNext || autoLoadNextCursorRef.current === nextCursor) {
      return
    }

    autoLoadNextCursorRef.current = nextCursor
    void messagesFeed.loadNext().then((loaded) => {
      if (!loaded) {
        autoLoadNextCursorRef.current = null
      }
    })
  }, [
    activeItems.length,
    activeState.data,
    activeState.isLoading,
    contextMessageId,
    isSearchMode,
    messagesFeed,
    setContextMessageId,
  ])

  useEffect(() => {
    if (!highlightedMessageId) {
      lastScrolledFocusIdRef.current = null
      return
    }

    if (lastScrolledFocusIdRef.current === highlightedMessageId || activeItems.length === 0) {
      return
    }

    const highlightedIndex = activeItems.findIndex((message) => message.id === highlightedMessageId)
    if (highlightedIndex >= 0) {
      lastScrolledFocusIdRef.current = highlightedMessageId
      rowVirtualizer.scrollToIndex(highlightedIndex, {
        align: 'center',
      })
    }
  }, [highlightedMessageId, activeItems, rowVirtualizer])

  const actions = useMemo(
    () => ({
      openMessageContext(messageId: number) {
        lastScrolledFocusIdRef.current = null
        setContextMessageId(messageId)
        setHighlightedMessageId(messageId)
        clearSearchFilters()
        setSearchCursor('')
      },
      openPreviousMessages() {
        const prevCursor = activeState.data?.prevCursor
        if (!prevCursor) {
          return
        }

        if (!isSearchMode && contextMessageId === null) {
          prependAnchorRef.current = {
            scrollTop: scrollRef.current?.scrollTop ?? 0,
            totalSize: rowVirtualizer.getTotalSize(),
          }
          void messagesFeed.loadPrevious()
          return
        }

        setContextMessageId(null)
        setHighlightedMessageId(null)
        setFeedCursor(prevCursor)
        setFeedDir('prev')
      },
      openNextMessages() {
        const nextCursor = activeState.data?.nextCursor
        if (!nextCursor) {
          return
        }

        if (isSearchMode) {
          setSearchCursor(nextCursor)
          return
        }

        if (contextMessageId === null) {
          void messagesFeed.loadNext()
          return
        }

        setContextMessageId(null)
        setHighlightedMessageId(null)
        setFeedCursor(nextCursor)
        setFeedDir('next')
      },
      resetTimeline() {
        setContextMessageId(null)
        setHighlightedMessageId(null)
        setFeedCursor('')
        setFeedDir('next')
        messagesFeed.refetch()
      },
    }),
    [
      activeState.data,
      clearSearchFilters,
      contextMessageId,
      isSearchMode,
      messagesFeed,
      rowVirtualizer,
      setContextMessageId,
      setFeedCursor,
      setFeedDir,
      setHighlightedMessageId,
      setSearchCursor,
    ],
  )

  return {
    scrollRef,
    rowVirtualizer,
    ...actions,
  }
}
