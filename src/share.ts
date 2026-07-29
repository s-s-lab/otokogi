import { sampleState } from './data'
import type { AppState } from './types'

export const STORAGE_KEY = 'otokogi-log-state-v1'
export const SHARE_KEY_PATTERN = /^[a-f0-9]{64}$/

export const emptyState = (): AppState => ({
  groups: [],
  matches: [],
  activeGroupId: null,
})

export const getShareKeyFromHash = (hash: string) => {
  const match = hash.match(/^#\/group\/([a-f0-9]{64})$/i)
  return match ? match[1].toLowerCase() : null
}

export const buildShareHash = (key: string) => `#/group/${key}`

export const getLegacyState = (): AppState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null

    const parsed = JSON.parse(saved) as AppState
    if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.matches)) {
      return null
    }

    const isUntouchedSample =
      parsed.groups.length === sampleState.groups.length &&
      parsed.matches.length === sampleState.matches.length &&
      parsed.groups[0]?.id === sampleState.groups[0]?.id &&
      parsed.matches.every((match, index) => match.id === sampleState.matches[index]?.id)

    return isUntouchedSample ? null : parsed
  } catch {
    return null
  }
}
