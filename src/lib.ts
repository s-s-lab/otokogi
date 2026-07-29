import type { Group, Match, Member } from './types'

export interface MemberScore {
  member: Member
  points: number
  wins: number
}

export interface OtokogiLevel {
  name: string
  shortName: string
  message: string
  min: number
  next: number | null
  stage: 0 | 1 | 2 | 3 | 4
}

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const getScores = (group: Group, matches: Match[]): MemberScore[] => {
  const relevantMatches = matches.filter((match) => match.groupId === group.id)

  return group.members
    .map((member) => {
      const wins = relevantMatches.filter(
        (match) => match.otokogiId === member.id,
      )
      return {
        member,
        points: wins.reduce((sum, match) => sum + match.points, 0),
        wins: wins.length,
      }
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        a.member.createdAt.localeCompare(b.member.createdAt),
    )
}

export const getOtokogiLevel = (points: number): OtokogiLevel => {
  if (points >= 20) {
    return {
      name: '天下無双の男気王',
      shortName: '男気王',
      message: 'その背中に、みんなの尊敬が集まっている。',
      min: 20,
      next: null,
      stage: 4,
    }
  }
  if (points >= 12) {
    return {
      name: '堂々たる男気将軍',
      shortName: '男気将軍',
      message: '迷いのない一手。もはや貫禄が違う。',
      min: 12,
      next: 20,
      stage: 3,
    }
  }
  if (points >= 5) {
    return {
      name: '頼れる男気番長',
      shortName: '男気番長',
      message: '勝負どころを知る、頼れる存在。',
      min: 5,
      next: 12,
      stage: 2,
    }
  }
  if (points >= 1) {
    return {
      name: '粋な男気ルーキー',
      shortName: 'ルーキー',
      message: 'その一歩が、伝説のはじまり。',
      min: 1,
      next: 5,
      stage: 1,
    }
  }
  return {
    name: '男気見習い',
    shortName: '見習い',
    message: '勝負はこれから。拳に気合いを込めよう。',
    min: 0,
    next: 1,
    stage: 0,
  }
}

export const getLevelProgress = (points: number, level: OtokogiLevel) => {
  if (level.next === null) return 100
  const span = level.next - level.min
  return Math.max(0, Math.min(100, ((points - level.min) / span) * 100))
}

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
