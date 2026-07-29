import { describe, expect, it } from 'vitest'
import { getLevelProgress, getOtokogiLevel, getScores } from './lib'
import type { Group, Match } from './types'

const group: Group = {
  id: 'g1',
  name: 'テスト',
  emoji: '✊',
  description: '',
  createdAt: '2026-01-01',
  members: [
    { id: 'a', name: 'A', color: '#000', createdAt: '2026-01-01' },
    { id: 'b', name: 'B', color: '#fff', createdAt: '2026-01-02' },
  ],
}

const matches: Match[] = [
  {
    id: 'm1',
    groupId: 'g1',
    playedAt: '2026-01-01',
    stake: 'アイス',
    category: 'snack',
    otokogiId: 'b',
    participantIds: ['a', 'b'],
    points: 1,
    memo: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'm2',
    groupId: 'g1',
    playedAt: '2026-01-02',
    stake: 'ランチ',
    category: 'meal',
    otokogiId: 'a',
    participantIds: ['a', 'b'],
    points: 3,
    memo: '',
    createdAt: '2026-01-02',
  },
]

describe('getScores', () => {
  it('ポイント合計の高い順に並べる', () => {
    expect(getScores(group, matches).map((score) => score.member.id)).toEqual([
      'a',
      'b',
    ])
    expect(getScores(group, matches)[0]).toMatchObject({ points: 3, wins: 1 })
  })
})

describe('getOtokogiLevel', () => {
  it('しきい値に応じたレベルを返す', () => {
    expect(getOtokogiLevel(0).stage).toBe(0)
    expect(getOtokogiLevel(5).stage).toBe(2)
    expect(getOtokogiLevel(20).stage).toBe(4)
  })

  it('次のレベルまでの進捗を計算する', () => {
    const level = getOtokogiLevel(8)
    expect(getLevelProgress(8, level)).toBeCloseTo(42.857, 2)
  })
})
