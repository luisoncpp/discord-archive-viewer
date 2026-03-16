import { useCallback, useEffect, useRef } from 'react'
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

/**
 * Mapa rápido del controlador de timeline:
 * 1) Expone refs/acciones para UI (scrollRef + acciones públicas).
 * 2) Escucha scroll y decide auto-load en borde superior/inferior.
 * 3) En modo contexto, hidrata feed antes de salir para evitar saltos.
 * 4) Conserva viewport al prepend de mensajes anteriores.
 * 5) Ejecuta auto-load inferior post-render cuando aplica.
 * 6) Hace scroll al mensaje enfocado solo una vez por id.
 * 7) Mantiene deduplicación por nextCursor para no disparar cargas repetidas.
 */

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
  const wasScrolledRef = useRef(false)
  const topEdgeArmedRef = useRef(true)
  const prependAnchorRef = useRef<{
    scrollTop: number
    totalSize: number
    messageId: number | null
    offsetTop: number | null
  } | null>(null)
  const autoLoadNextCursorRef = useRef<string | null>(null)
  const lastScrolledFocusIdRef = useRef<number | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: activeItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92,
    overscan: 10,
    getItemKey: (index) => activeItems[index]?.id ?? index,
  })

  const capturePrependAnchor = useCallback(
    (scrollTop: number) => {
      const scroller = scrollRef.current
      const scrollerTop = scroller?.getBoundingClientRect().top ?? 0
      const anchorElement = Array.from(
        scroller?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [],
      ).find((element) => element.getBoundingClientRect().bottom > scrollerTop) ?? null

      prependAnchorRef.current = {
        scrollTop,
        totalSize: rowVirtualizer.getTotalSize(),
        messageId: anchorElement ? Number(anchorElement.dataset.messageId) : null,
        offsetTop: anchorElement ? anchorElement.getBoundingClientRect().top - scrollerTop : null,
      }
    },
    [rowVirtualizer],
  )

  const resetAutoLoadNextCursorOnFailure = useCallback((loaded: boolean) => {
    if (!loaded) {
      autoLoadNextCursorRef.current = null
    }
  }, [])

  const hydrateFeedAndExitContext = useCallback(
    (data: MessagesPageDto) => {
      messagesFeed.resetWithData(data)
      setContextMessageId(null)
    },
    [messagesFeed, setContextMessageId],
  )

  const tryHandleTopEdgeScroll = useCallback(
    (input: {
      scrollDirection: number
      currentScrollTop: number
      data: MessagesPageDto
      isLoading: boolean
    }) => {
      const { scrollDirection, currentScrollTop, data, isLoading } = input

      if (
        !(
          topEdgeArmedRef.current &&
          scrollDirection <= 0 &&
          currentScrollTop <= AUTO_LOAD_EDGE_THRESHOLD &&
          data.prevCursor &&
          !isLoading &&
          (contextMessageId !== null || (!messagesFeed.isLoadingPrevious && !prependAnchorRef.current))
        )
      ) {
        return false
      }

      if (contextMessageId !== null) {
        hydrateFeedAndExitContext(data)
      } else {
        topEdgeArmedRef.current = false
        capturePrependAnchor(currentScrollTop)
        void messagesFeed.loadPrevious()
      }

      return true
    },
    [capturePrependAnchor, contextMessageId, hydrateFeedAndExitContext, messagesFeed],
  )

  const tryHandleBottomEdgeScroll = useCallback(
    (input: {
      distanceFromBottom: number
      data: MessagesPageDto
      isLoading: boolean
    }) => {
      const { distanceFromBottom, data, isLoading } = input

      if (
        !(
          distanceFromBottom <= AUTO_LOAD_EDGE_THRESHOLD &&
          data.nextCursor &&
          (contextMessageId !== null || autoLoadNextCursorRef.current !== data.nextCursor) &&
          !isLoading &&
          (contextMessageId !== null || !messagesFeed.isLoadingNext)
        )
      ) {
        return false
      }

      if (contextMessageId !== null) {
        hydrateFeedAndExitContext(data)
      } else {
        autoLoadNextCursorRef.current = data.nextCursor
        void messagesFeed.loadNext().then(resetAutoLoadNextCursorOnFailure)
      }

      return true
    },
    [contextMessageId, hydrateFeedAndExitContext, messagesFeed, resetAutoLoadNextCursorOnFailure],
  )

  const onTimelineScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }

    wasScrolledRef.current = true

    const data = activeState.data
    if (!data) {
      return
    }

    const currentScrollTop = element.scrollTop
    const scrollDirection = currentScrollTop - scrollTopRef.current
    scrollTopRef.current = currentScrollTop

    if (currentScrollTop > AUTO_LOAD_EDGE_THRESHOLD) {
      topEdgeArmedRef.current = true
    }

    const distanceFromBottom = element.scrollHeight - currentScrollTop - element.clientHeight

    const didHandleTopEdge = tryHandleTopEdgeScroll({
      scrollDirection,
      currentScrollTop,
      data,
      isLoading: activeState.isLoading,
    })

    if (didHandleTopEdge) {
      return
    }

    void tryHandleBottomEdgeScroll({
      distanceFromBottom,
      data,
      isLoading: activeState.isLoading,
    })
  }, [activeState.data, activeState.isLoading, tryHandleBottomEdgeScroll, tryHandleTopEdgeScroll])

  const scrollToHighlightedMessageOnce = useCallback(() => {
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
      rowVirtualizer.scrollToIndex(highlightedIndex, { align: 'center' })
    }
  }, [activeItems, highlightedMessageId, rowVirtualizer])

  const openMessageContext = useCallback(
    (messageId: number) => {
      lastScrolledFocusIdRef.current = null
      setContextMessageId(messageId)
      setHighlightedMessageId(messageId)
      clearSearchFilters()
      setSearchCursor('')
    },
    [clearSearchFilters, setContextMessageId, setHighlightedMessageId, setSearchCursor],
  )

  const openPreviousMessages = useCallback(() => {
    const prevCursor = activeState.data?.prevCursor
    if (!prevCursor) {
      return
    }

    if (!isSearchMode && contextMessageId === null) {
      capturePrependAnchor(scrollRef.current?.scrollTop ?? 0)
      void messagesFeed.loadPrevious()
      return
    }

    setContextMessageId(null)
    setHighlightedMessageId(null)
    setFeedCursor(prevCursor)
    setFeedDir('prev')
  }, [
    activeState.data?.prevCursor,
    capturePrependAnchor,
    contextMessageId,
    isSearchMode,
    messagesFeed,
    setContextMessageId,
    setFeedCursor,
    setFeedDir,
    setHighlightedMessageId,
  ])

  const openNextMessages = useCallback(() => {
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
  }, [
    activeState.data?.nextCursor,
    contextMessageId,
    isSearchMode,
    messagesFeed,
    setContextMessageId,
    setFeedCursor,
    setFeedDir,
    setHighlightedMessageId,
    setSearchCursor,
  ])

  const resetTimeline = useCallback(() => {
    setContextMessageId(null)
    setHighlightedMessageId(null)
    setFeedCursor('')
    setFeedDir('next')
    messagesFeed.refetch()
  }, [messagesFeed, setContextMessageId, setFeedCursor, setFeedDir, setHighlightedMessageId])

  useEffect(function compensatePrependAnchorAfterPreviousLoad() {
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
      const scrollerTop = scroller.getBoundingClientRect().top
      const anchoredElement = anchor.messageId !== null
        ? scroller.querySelector<HTMLElement>(`[data-message-id="${anchor.messageId}"]`)
        : null

      if (anchoredElement && anchor.offsetTop !== null) {
        const nextOffsetTop = anchoredElement.getBoundingClientRect().top - scrollerTop
        scroller.scrollTop += nextOffsetTop - anchor.offsetTop
      } else {
        const nextTotalSize = rowVirtualizer.getTotalSize()
        scroller.scrollTop = anchor.scrollTop + Math.max(0, nextTotalSize - anchor.totalSize)
      }

      prependAnchorRef.current = null
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [activeItems.length, messagesFeed.isLoadingPrevious, rowVirtualizer])

  useEffect(function bindTimelineScrollListener() {
    const scroller = scrollRef.current
    if (!scroller || isSearchMode) {
      return
    }

    scrollTopRef.current = scroller.scrollTop
    scroller.addEventListener('scroll', onTimelineScroll, { passive: true })

    // On re-bind in feed mode (after at least one user scroll): check edge immediately
    // in case no further scroll events fire (e.g. fast scrollbar drag that stops at top).
    if (wasScrolledRef.current && contextMessageId === null) {
      onTimelineScroll()
    }

    return () => {
      scroller.removeEventListener('scroll', onTimelineScroll)
    }
  }, [contextMessageId, isSearchMode, onTimelineScroll])

  useEffect(function resetBottomAutoLoadCursorOnCursorChange() {
    autoLoadNextCursorRef.current = null
  }, [activeState.data?.nextCursor])

  useEffect(function scrollToHighlightedMessageOnFirstAppearance() {
    scrollToHighlightedMessageOnce()
  }, [scrollToHighlightedMessageOnce])

  return {
    scrollRef,
    rowVirtualizer,
    openMessageContext,
    openPreviousMessages,
    openNextMessages,
    resetTimeline,
  }
}
