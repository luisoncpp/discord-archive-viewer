export type MessageReaction = {
  emoji: string
  count: number
}

const REACTION_ENTRY_PATTERN = /^(.*)\((\d+)\)$/

export function parseReactionsRaw(reactionsRaw: string | null): MessageReaction[] {
  if (!reactionsRaw || !reactionsRaw.trim()) {
    return []
  }

  return reactionsRaw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = part.match(REACTION_ENTRY_PATTERN)
      if (!match) {
        return {
          emoji: part,
          count: 1,
        }
      }

      const emoji = match[1]?.trim() ?? part
      const countValue = Number(match[2])

      return {
        emoji,
        count: Number.isFinite(countValue) && countValue > 0 ? countValue : 1,
      }
    })
}
