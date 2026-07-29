import { API_URL } from './config'
import type { AppState, Group, Match, Member } from './types'

export interface SharedStateResponse {
  key: string
  version: number
  state: AppState
  updatedAt: string
}

interface ApiSuccess extends SharedStateResponse {
  ok: true
}

interface ApiFailure {
  ok: false
  code: string
  message: string
}

type ApiResponse = ApiSuccess | ApiFailure

export class SharedApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SharedApiError'
    this.code = code
  }
}

const parseResponse = async (response: Response) => {
  const result = (await response.json()) as ApiResponse
  if (!result.ok) {
    throw new SharedApiError(result.code, result.message)
  }
  return result
}

export const fetchSharedState = async (key: string) => {
  const url = new URL(API_URL)
  url.searchParams.set('action', 'get')
  url.searchParams.set('key', key)
  url.searchParams.set('_', Date.now().toString())

  return parseResponse(
    await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    }),
  )
}

const post = async (payload: Record<string, unknown>) =>
  parseResponse(
    await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      cache: 'no-store',
      body: JSON.stringify(payload),
    }),
  )

export const createSharedSpace = (state: AppState) =>
  post({ action: 'createSpace', state })

export const addSharedGroup = (key: string, group: Group) =>
  post({ action: 'addGroup', key, group })

export const addSharedMember = (
  key: string,
  groupId: string,
  member: Member,
) => post({ action: 'addMember', key, groupId, member })

export const deleteSharedGroup = (key: string, groupId: string) =>
  post({ action: 'deleteGroup', key, groupId })

export const createSharedMatch = (key: string, match: Match) =>
  post({ action: 'createMatch', key, match })

export const deleteSharedMatch = (key: string, matchId: string) =>
  post({ action: 'deleteMatch', key, matchId })
