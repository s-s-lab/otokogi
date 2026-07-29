import {
  Archive,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Crown,
  Flame,
  Home,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { CATEGORY_META, MEMBER_COLORS } from './constants'
import { sampleState } from './data'
import {
  formatDate,
  getLevelProgress,
  getOtokogiLevel,
  getScores,
  uid,
} from './lib'
import type {
  AppState,
  Group,
  Match,
  MatchCategory,
  ViewName,
} from './types'
import { OtokogiIllustration } from './components/OtokogiIllustration'

const STORAGE_KEY = 'otokogi-log-state-v1'

const loadState = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return sampleState
    const parsed = JSON.parse(saved) as AppState
    if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.matches)) {
      return sampleState
    }
    return parsed
  } catch {
    return sampleState
  }
}

function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [view, setView] = useState<ViewName>('home')
  const [recordOpen, setRecordOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const activeGroup =
    state.groups.find((group) => group.id === state.activeGroupId) ??
    state.groups[0] ??
    null

  const changeView = (nextView: ViewName) => {
    setView(nextView)
    setMobileMenuOpen(false)
  }

  const selectGroup = (groupId: string) => {
    setState((current) => ({ ...current, activeGroupId: groupId }))
  }

  const createGroup = (input: {
    name: string
    description: string
    emoji: string
    memberNames: string[]
  }) => {
    const createdAt = new Date().toISOString()
    const group: Group = {
      id: uid('group'),
      name: input.name,
      description: input.description,
      emoji: input.emoji,
      createdAt,
      members: input.memberNames.map((name, index) => ({
        id: uid('member'),
        name,
        color: MEMBER_COLORS[index % MEMBER_COLORS.length],
        createdAt,
      })),
    }
    setState((current) => ({
      ...current,
      groups: [...current.groups, group],
      activeGroupId: group.id,
    }))
    setGroupOpen(false)
    setView('home')
  }

  const addMember = (groupId: string, name: string) => {
    const cleanedName = name.trim()
    if (!cleanedName) return
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              members: [
                ...group.members,
                {
                  id: uid('member'),
                  name: cleanedName,
                  color:
                    MEMBER_COLORS[group.members.length % MEMBER_COLORS.length],
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : group,
      ),
    }))
  }

  const deleteGroup = (groupId: string) => {
    const group = state.groups.find((item) => item.id === groupId)
    if (
      !group ||
      !window.confirm(
        `「${group.name}」と、このグループの勝負記録を削除しますか？`,
      )
    ) {
      return
    }
    setState((current) => {
      const groups = current.groups.filter((item) => item.id !== groupId)
      return {
        groups,
        matches: current.matches.filter((match) => match.groupId !== groupId),
        activeGroupId:
          current.activeGroupId === groupId
            ? (groups[0]?.id ?? null)
            : current.activeGroupId,
      }
    })
  }

  const createMatch = (match: Omit<Match, 'id' | 'createdAt'>) => {
    setState((current) => ({
      ...current,
      activeGroupId: match.groupId,
      matches: [
        {
          ...match,
          id: uid('match'),
          createdAt: new Date().toISOString(),
        },
        ...current.matches,
      ],
    }))
    setRecordOpen(false)
    setView('home')
  }

  const deleteMatch = (matchId: string) => {
    if (!window.confirm('この勝負記録を削除しますか？')) return
    setState((current) => ({
      ...current,
      matches: current.matches.filter((match) => match.id !== matchId),
    }))
  }

  return (
    <div className="app-shell">
      <Header
        groups={state.groups}
        activeGroup={activeGroup}
        view={view}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMenu={() => setMobileMenuOpen((open) => !open)}
        onNavigate={changeView}
        onSelectGroup={selectGroup}
        onCreateGroup={() => setGroupOpen(true)}
        onCreateMatch={() => setRecordOpen(true)}
      />

      <main className="main-content">
        {view === 'home' && (
          <Dashboard
            group={activeGroup}
            matches={state.matches}
            onCreateGroup={() => setGroupOpen(true)}
            onCreateMatch={() => setRecordOpen(true)}
            onShowHistory={() => setView('history')}
          />
        )}
        {view === 'groups' && (
          <GroupsView
            groups={state.groups}
            matches={state.matches}
            activeGroupId={activeGroup?.id ?? null}
            onCreateGroup={() => setGroupOpen(true)}
            onSelectGroup={(groupId) => {
              selectGroup(groupId)
              setView('home')
            }}
            onAddMember={addMember}
            onDeleteGroup={deleteGroup}
          />
        )}
        {view === 'history' && (
          <HistoryView
            groups={state.groups}
            activeGroup={activeGroup}
            matches={state.matches}
            onSelectGroup={selectGroup}
            onCreateMatch={() => setRecordOpen(true)}
            onDeleteMatch={deleteMatch}
          />
        )}
      </main>

      <MobileNav
        view={view}
        onNavigate={changeView}
        onCreateMatch={() => setRecordOpen(true)}
      />

      {recordOpen && (
        <RecordModal
          groups={state.groups}
          activeGroupId={activeGroup?.id ?? null}
          onClose={() => setRecordOpen(false)}
          onSubmit={createMatch}
        />
      )}
      {groupOpen && (
        <GroupModal
          onClose={() => setGroupOpen(false)}
          onSubmit={createGroup}
        />
      )}
    </div>
  )
}

interface HeaderProps {
  groups: Group[]
  activeGroup: Group | null
  view: ViewName
  mobileMenuOpen: boolean
  onToggleMenu: () => void
  onNavigate: (view: ViewName) => void
  onSelectGroup: (groupId: string) => void
  onCreateGroup: () => void
  onCreateMatch: () => void
}

function Header({
  groups,
  activeGroup,
  view,
  mobileMenuOpen,
  onToggleMenu,
  onNavigate,
  onSelectGroup,
  onCreateGroup,
  onCreateMatch,
}: HeaderProps) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          className="brand"
          type="button"
          onClick={() => onNavigate('home')}
          aria-label="男気録トップへ"
        >
          <span className="brand-mark">男</span>
          <span>
            <strong>男気録</strong>
            <small>OTOKOGI LOG</small>
          </span>
        </button>

        <nav className="desktop-nav" aria-label="メインナビゲーション">
          <NavButton
            active={view === 'home'}
            icon={<Home size={18} />}
            label="ホーム"
            onClick={() => onNavigate('home')}
          />
          <NavButton
            active={view === 'groups'}
            icon={<Users size={18} />}
            label="グループ"
            onClick={() => onNavigate('groups')}
          />
          <NavButton
            active={view === 'history'}
            icon={<Archive size={18} />}
            label="勝負の記録"
            onClick={() => onNavigate('history')}
          />
        </nav>

        <div className="header-actions">
          {groups.length > 0 && (
            <label className="group-switcher">
              <span className="sr-only">表示するグループ</span>
              <select
                value={activeGroup?.id ?? ''}
                onChange={(event) => onSelectGroup(event.target.value)}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.emoji} {group.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </label>
          )}
          <button
            className="button primary compact desktop-record"
            type="button"
            onClick={groups.length ? onCreateMatch : onCreateGroup}
          >
            <Plus size={18} />
            {groups.length ? '勝負を記録' : 'グループ作成'}
          </button>
          <button
            type="button"
            className="icon-button menu-button"
            onClick={onToggleMenu}
            aria-label="メニューを開く"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          <NavButton
            active={view === 'home'}
            icon={<Home size={18} />}
            label="ホーム"
            onClick={() => onNavigate('home')}
          />
          <NavButton
            active={view === 'groups'}
            icon={<Users size={18} />}
            label="グループ"
            onClick={() => onNavigate('groups')}
          />
          <NavButton
            active={view === 'history'}
            icon={<Archive size={18} />}
            label="勝負の記録"
            onClick={() => onNavigate('history')}
          />
        </div>
      )}
    </header>
  )
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`nav-button ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

interface DashboardProps {
  group: Group | null
  matches: Match[]
  onCreateGroup: () => void
  onCreateMatch: () => void
  onShowHistory: () => void
}

function Dashboard({
  group,
  matches,
  onCreateGroup,
  onCreateMatch,
  onShowHistory,
}: DashboardProps) {
  if (!group) {
    return (
      <EmptyState
        icon={<Users size={42} />}
        eyebrow="WELCOME"
        title="最初のグループを作ろう"
        description="一緒に勝負する仲間を登録すると、男気じゃんけんの記録を始められます。"
        actionLabel="グループを作成"
        onAction={onCreateGroup}
      />
    )
  }

  const groupMatches = matches
    .filter((match) => match.groupId === group.id)
    .sort(
      (a, b) =>
        b.playedAt.localeCompare(a.playedAt) ||
        b.createdAt.localeCompare(a.createdAt),
    )
  const scores = getScores(group, matches)
  const leader = scores[0] ?? null
  const level = getOtokogiLevel(leader?.points ?? 0)
  const progress = getLevelProgress(leader?.points ?? 0, level)
  const totalPoints = groupMatches.reduce((sum, match) => sum + match.points, 0)

  return (
    <div className="page-stack">
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow-line">
            <span>THIS GROUP&apos;S OTOKOGI</span>
            <i />
          </div>
          <p className="group-kicker">
            {group.emoji} {group.name}
          </p>
          <h1>
            今週も、<br />
            <em>気持ちよく勝とう。</em>
          </h1>
          <p className="hero-description">
            勝った者が払う。それが男気じゃんけん。
            <br />
            仲間との粋な勝負を、ここに刻もう。
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="button primary"
              onClick={onCreateMatch}
              disabled={group.members.length < 2}
            >
              <Swords size={20} />
              新しい勝負を記録
            </button>
            <button
              type="button"
              className="button text-button"
              onClick={onShowHistory}
            >
              記録を見る
              <ArrowRight size={18} />
            </button>
          </div>
          {group.members.length < 2 && (
            <p className="helper warning">
              勝負を記録するには、グループに2人以上必要です。
            </p>
          )}
        </div>

        <div className="hero-card">
          <div className="hero-badge">
            <Crown size={16} />
            現在のトップ
          </div>
          <div className="illustration-wrap">
            <OtokogiIllustration
              stage={level.stage}
              name={leader?.member.name ?? '挑戦者'}
            />
            <div className="brush-label">
              <span>{level.shortName}</span>
            </div>
          </div>
          <div className="hero-card-copy">
            <p>暫定・男気ランキング 1位</p>
            <h2>{leader?.member.name ?? 'まだ記録なし'}</h2>
            <div className="point-display">
              <strong>{leader?.points ?? 0}</strong>
              <span>OTOKOGI PT</span>
            </div>
            <p className="level-message">{level.message}</p>
            <div className="level-progress">
              <div className="level-progress-label">
                <span>{level.name}</span>
                <span>
                  {level.next === null
                    ? '最高位'
                    : `次まで ${level.next - (leader?.points ?? 0)} PT`}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-strip" aria-label="グループの集計">
        <Stat icon={<Swords />} value={groupMatches.length} label="これまでの勝負" />
        <Stat icon={<Users />} value={group.members.length} label="参加メンバー" />
        <Stat icon={<Flame />} value={totalPoints} label="累計男気ポイント" />
        <Stat
          icon={<CalendarDays />}
          value={
            groupMatches[0]
              ? `${Math.max(
                  0,
                  Math.ceil(
                    (Date.now() -
                      new Date(`${groupMatches[0].playedAt}T00:00:00`).getTime()) /
                      86400000,
                  ),
                )}日`
              : '—'
          }
          label="最後の勝負から"
        />
      </section>

      <section className="content-grid">
        <div className="panel ranking-panel">
          <SectionHeading
            icon={<Trophy />}
            eyebrow="RANKING"
            title="男気ランキング"
            aside={`${groupMatches.length}戦の記録`}
          />
          {scores.length ? (
            <div className="ranking-list">
              {scores.map((score, index) => {
                const memberLevel = getOtokogiLevel(score.points)
                return (
                  <div
                    className={`ranking-row ${index === 0 ? 'leader' : ''}`}
                    key={score.member.id}
                  >
                    <div className={`rank rank-${index + 1}`}>
                      {index === 0 ? <Crown size={20} /> : index + 1}
                    </div>
                    <Avatar
                      name={score.member.name}
                      color={score.member.color}
                      size="medium"
                    />
                    <div className="ranking-person">
                      <strong>{score.member.name}</strong>
                      <span>
                        {memberLevel.shortName} · {score.wins}勝
                      </span>
                    </div>
                    <div className="ranking-points">
                      <strong>{score.points}</strong>
                      <span>PT</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <InlineEmpty message="メンバーを追加するとランキングが始まります。" />
          )}
        </div>

        <div className="panel recent-panel">
          <SectionHeading
            icon={<Sparkles />}
            eyebrow="RECENT BATTLES"
            title="最近の勝負"
            action={
              groupMatches.length > 0 ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={onShowHistory}
                >
                  すべて見る <ArrowRight size={16} />
                </button>
              ) : null
            }
          />
          {groupMatches.length ? (
            <div className="match-list compact-list">
              {groupMatches.slice(0, 4).map((match) => (
                <MatchCard key={match.id} match={match} group={group} compact />
              ))}
            </div>
          ) : (
            <InlineEmpty
              message="最初の男気じゃんけんを記録しましょう。"
              actionLabel="勝負を記録"
              onAction={onCreateMatch}
            />
          )}
        </div>
      </section>
    </div>
  )
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: string | number
  label: string
}) {
  return (
    <div className="stat-item">
      <div className="stat-icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  aside,
  action,
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  aside?: string
  action?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div className="section-title">
        <span className="section-icon">{icon}</span>
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
        </div>
      </div>
      {aside && <span className="section-aside">{aside}</span>}
      {action}
    </div>
  )
}

interface GroupsViewProps {
  groups: Group[]
  matches: Match[]
  activeGroupId: string | null
  onCreateGroup: () => void
  onSelectGroup: (groupId: string) => void
  onAddMember: (groupId: string, name: string) => void
  onDeleteGroup: (groupId: string) => void
}

function GroupsView({
  groups,
  matches,
  activeGroupId,
  onCreateGroup,
  onSelectGroup,
  onAddMember,
  onDeleteGroup,
}: GroupsViewProps) {
  return (
    <div className="page-stack narrow-page">
      <PageTitle
        eyebrow="YOUR CREWS"
        title="グループ"
        description="家族、友人、同僚。勝負する仲間ごとに記録を分けられます。"
        action={
          <button
            className="button primary"
            type="button"
            onClick={onCreateGroup}
          >
            <Plus size={18} />
            グループを作成
          </button>
        }
      />

      {groups.length ? (
        <div className="group-grid">
          {groups.map((group) => {
            const groupMatches = matches.filter(
              (match) => match.groupId === group.id,
            )
            const scores = getScores(group, matches)
            return (
              <article
                key={group.id}
                className={`group-card ${
                  group.id === activeGroupId ? 'active' : ''
                }`}
              >
                <div className="group-card-top">
                  <div className="group-emoji">{group.emoji}</div>
                  <div className="group-card-title">
                    <span>
                      {group.id === activeGroupId && (
                        <>
                          <Check size={14} /> 表示中
                        </>
                      )}
                    </span>
                    <h2>{group.name}</h2>
                    <p>{group.description || '男気あふれる仲間たち'}</p>
                  </div>
                  <button
                    className="icon-button danger"
                    type="button"
                    onClick={() => onDeleteGroup(group.id)}
                    aria-label={`${group.name}を削除`}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="group-meta">
                  <span>
                    <Users size={16} /> {group.members.length}人
                  </span>
                  <span>
                    <Swords size={16} /> {groupMatches.length}戦
                  </span>
                  <span>
                    <Flame size={16} />
                    {groupMatches.reduce(
                      (sum, match) => sum + match.points,
                      0,
                    )}
                    PT
                  </span>
                </div>

                <div className="member-cloud">
                  {scores.map((score) => (
                    <div className="member-chip" key={score.member.id}>
                      <Avatar
                        name={score.member.name}
                        color={score.member.color}
                        size="small"
                      />
                      <span>{score.member.name}</span>
                      <strong>{score.points}PT</strong>
                    </div>
                  ))}
                </div>

                <NewMemberForm
                  onSubmit={(name) => onAddMember(group.id, name)}
                />

                <button
                  className={`button full-width ${
                    group.id === activeGroupId ? 'secondary' : 'outline'
                  }`}
                  type="button"
                  onClick={() => onSelectGroup(group.id)}
                >
                  {group.id === activeGroupId
                    ? 'このグループのホームへ'
                    : 'このグループを表示'}
                  <ArrowRight size={17} />
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Users size={42} />}
          eyebrow="NO GROUPS YET"
          title="勝負する仲間を集めよう"
          description="グループを作成し、最初のメンバーを登録してください。"
          actionLabel="グループを作成"
          onAction={onCreateGroup}
        />
      )}
    </div>
  )
}

function NewMemberForm({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    onSubmit(name)
    setName('')
  }

  return (
    <form className="new-member-form" onSubmit={submit}>
      <label>
        <span className="sr-only">追加するメンバー名</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="メンバー名を追加"
          maxLength={20}
        />
      </label>
      <button type="submit" className="icon-button add" aria-label="追加">
        <Plus size={19} />
      </button>
    </form>
  )
}

interface HistoryViewProps {
  groups: Group[]
  activeGroup: Group | null
  matches: Match[]
  onSelectGroup: (groupId: string) => void
  onCreateMatch: () => void
  onDeleteMatch: (matchId: string) => void
}

function HistoryView({
  groups,
  activeGroup,
  matches,
  onSelectGroup,
  onCreateMatch,
  onDeleteMatch,
}: HistoryViewProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | MatchCategory>('all')

  const filteredMatches = useMemo(() => {
    if (!activeGroup) return []
    return matches
      .filter((match) => match.groupId === activeGroup.id)
      .filter((match) => category === 'all' || match.category === category)
      .filter((match) => {
        const member = activeGroup.members.find(
          (item) => item.id === match.otokogiId,
        )
        const text = `${match.stake} ${match.memo} ${member?.name ?? ''}`
        return text.toLowerCase().includes(search.toLowerCase())
      })
      .sort(
        (a, b) =>
          b.playedAt.localeCompare(a.playedAt) ||
          b.createdAt.localeCompare(a.createdAt),
      )
  }, [activeGroup, category, matches, search])

  return (
    <div className="page-stack narrow-page">
      <PageTitle
        eyebrow="BATTLE ARCHIVE"
        title="勝負の記録"
        description="あの日、誰が何に男気を見せたのか。すべての勝負を振り返れます。"
        action={
          <button
            className="button primary"
            type="button"
            onClick={onCreateMatch}
            disabled={!activeGroup || activeGroup.members.length < 2}
          >
            <Plus size={18} />
            勝負を記録
          </button>
        }
      />

      {activeGroup ? (
        <>
          <div className="filter-bar">
            <label className="search-box">
              <Search size={18} />
              <span className="sr-only">記録を検索</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="内容・メンバー名で検索"
              />
            </label>
            <label className="filter-select">
              <span className="sr-only">グループ</span>
              <select
                value={activeGroup.id}
                onChange={(event) => onSelectGroup(event.target.value)}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.emoji} {group.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
            <label className="filter-select">
              <span className="sr-only">カテゴリ</span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as 'all' | MatchCategory)
                }
              >
                <option value="all">すべての勝負</option>
                {Object.entries(CATEGORY_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.emoji} {meta.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
          </div>

          {filteredMatches.length ? (
            <div className="history-list">
              {filteredMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  group={activeGroup}
                  onDelete={() => onDeleteMatch(match.id)}
                />
              ))}
            </div>
          ) : (
            <InlineEmpty
              message={
                search || category !== 'all'
                  ? '条件に一致する勝負はありません。'
                  : 'まだ勝負の記録がありません。'
              }
              actionLabel={!search && category === 'all' ? '勝負を記録' : undefined}
              onAction={!search && category === 'all' ? onCreateMatch : undefined}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={<Archive size={42} />}
          eyebrow="NO GROUP"
          title="先にグループを作成してください"
          description="勝負の記録はグループごとに保存されます。"
          actionLabel=""
          onAction={() => undefined}
        />
      )}
    </div>
  )
}

function MatchCard({
  match,
  group,
  compact = false,
  onDelete,
}: {
  match: Match
  group: Group
  compact?: boolean
  onDelete?: () => void
}) {
  const winner = group.members.find((member) => member.id === match.otokogiId)
  const meta = CATEGORY_META[match.category]

  return (
    <article className={`match-card ${compact ? 'compact' : ''}`}>
      <div className="match-category" title={meta.label}>
        {meta.emoji}
      </div>
      <div className="match-main">
        <div className="match-date">
          <CalendarDays size={14} />
          {formatDate(match.playedAt)}
          <span>·</span>
          {match.participantIds.length}人で勝負
        </div>
        <h3>{match.stake}</h3>
        {!compact && match.memo && <p>{match.memo}</p>}
      </div>
      <div className="match-winner">
        {winner && (
          <Avatar name={winner.name} color={winner.color} size="small" />
        )}
        <div>
          <span>男気を見せた人</span>
          <strong>{winner?.name ?? '退会メンバー'}</strong>
        </div>
      </div>
      <div className="match-points">
        <strong>+{match.points}</strong>
        <span>PT</span>
      </div>
      {onDelete && (
        <button
          className="icon-button danger match-delete"
          type="button"
          onClick={onDelete}
          aria-label={`${match.stake}の記録を削除`}
        >
          <Trash2 size={17} />
        </button>
      )}
    </article>
  )
}

function Avatar({
  name,
  color,
  size,
}: {
  name: string
  color: string
  size: 'small' | 'medium'
}) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ '--avatar-color': color } as React.CSSProperties}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function EmptyState({
  icon,
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <section className="empty-state">
      <div className="empty-icon">{icon}</div>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {actionLabel && (
        <button type="button" className="button primary" onClick={onAction}>
          <Plus size={18} />
          {actionLabel}
        </button>
      )}
    </section>
  )
}

function InlineEmpty({
  message,
  actionLabel,
  onAction,
}: {
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="inline-empty">
      <span className="empty-fist">✊</span>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="link-button" onClick={onAction}>
          {actionLabel} <ArrowRight size={16} />
        </button>
      )}
    </div>
  )
}

interface RecordModalProps {
  groups: Group[]
  activeGroupId: string | null
  onClose: () => void
  onSubmit: (match: Omit<Match, 'id' | 'createdAt'>) => void
}

function RecordModal({
  groups,
  activeGroupId,
  onClose,
  onSubmit,
}: RecordModalProps) {
  const initialGroup =
    groups.find((group) => group.id === activeGroupId) ?? groups[0]
  const [groupId, setGroupId] = useState(initialGroup?.id ?? '')
  const [playedAt, setPlayedAt] = useState(
    new Date().toLocaleDateString('en-CA'),
  )
  const [stake, setStake] = useState('')
  const [category, setCategory] = useState<MatchCategory>('snack')
  const [points, setPoints] = useState(CATEGORY_META.snack.points)
  const [participantIds, setParticipantIds] = useState<string[]>(
    initialGroup?.members.map((member) => member.id) ?? [],
  )
  const [otokogiId, setOtokogiId] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')

  const group = groups.find((item) => item.id === groupId)

  const chooseGroup = (nextGroupId: string) => {
    const nextGroup = groups.find((item) => item.id === nextGroupId)
    setGroupId(nextGroupId)
    setParticipantIds(nextGroup?.members.map((member) => member.id) ?? [])
    setOtokogiId('')
  }

  const chooseCategory = (nextCategory: MatchCategory) => {
    setCategory(nextCategory)
    setPoints(CATEGORY_META[nextCategory].points)
  }

  const toggleParticipant = (memberId: string) => {
    setParticipantIds((current) => {
      if (current.includes(memberId)) {
        if (otokogiId === memberId) setOtokogiId('')
        return current.filter((id) => id !== memberId)
      }
      return [...current, memberId]
    })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!groupId || !stake.trim() || !playedAt) {
      setError('グループ、日付、かけたものを入力してください。')
      return
    }
    if (participantIds.length < 2) {
      setError('参加者を2人以上選んでください。')
      return
    }
    if (!otokogiId) {
      setError('男気を見せた人を選んでください。')
      return
    }
    onSubmit({
      groupId,
      playedAt,
      stake: stake.trim(),
      category,
      otokogiId,
      participantIds,
      points: Math.max(1, Math.min(99, points)),
      memo: memo.trim(),
    })
  }

  return (
    <Modal title="新しい勝負を記録" icon={<Swords />} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-row two-columns">
          <FormField label="グループ" required>
            <div className="select-wrap">
              <select
                value={groupId}
                onChange={(event) => chooseGroup(event.target.value)}
              >
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.emoji} {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          </FormField>
          <FormField label="勝負した日" required>
            <input
              type="date"
              value={playedAt}
              onChange={(event) => setPlayedAt(event.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label="何をかけた？"
          hint="例：コンビニのアイス、ランチ、旅行のお土産"
          required
        >
          <input
            value={stake}
            onChange={(event) => setStake(event.target.value)}
            placeholder="勝負の内容を入力"
            maxLength={60}
            autoFocus
          />
        </FormField>

        <FormField label="勝負のカテゴリ" required>
          <div className="category-grid">
            {(
              Object.entries(CATEGORY_META) as [
                MatchCategory,
                (typeof CATEGORY_META)[MatchCategory],
              ][]
            ).map(([value, meta]) => (
              <button
                type="button"
                key={value}
                className={`category-option ${
                  category === value ? 'selected' : ''
                }`}
                onClick={() => chooseCategory(value)}
              >
                <span>{meta.emoji}</span>
                <strong>{meta.label}</strong>
                <small>{meta.points} PT</small>
              </button>
            ))}
          </div>
        </FormField>

        <FormField
          label="参加したメンバー"
          hint={`${participantIds.length}人を選択中`}
          required
        >
          <div className="member-select-grid">
            {group?.members.map((member) => {
              const selected = participantIds.includes(member.id)
              return (
                <button
                  type="button"
                  className={`member-select ${selected ? 'selected' : ''}`}
                  key={member.id}
                  onClick={() => toggleParticipant(member.id)}
                >
                  <Avatar
                    name={member.name}
                    color={member.color}
                    size="small"
                  />
                  <span>{member.name}</span>
                  <i>{selected && <Check size={14} />}</i>
                </button>
              )
            })}
          </div>
        </FormField>

        <FormField
          label="男気を見せたのは？"
          hint="じゃんけんに勝ち、支払いを引き受けた人"
          required
        >
          <div className="winner-grid">
            {group?.members
              .filter((member) => participantIds.includes(member.id))
              .map((member) => (
                <button
                  type="button"
                  key={member.id}
                  className={`winner-option ${
                    otokogiId === member.id ? 'selected' : ''
                  }`}
                  onClick={() => setOtokogiId(member.id)}
                >
                  {otokogiId === member.id && <Crown size={17} />}
                  <Avatar
                    name={member.name}
                    color={member.color}
                    size="medium"
                  />
                  <strong>{member.name}</strong>
                </button>
              ))}
          </div>
        </FormField>

        <div className="form-row point-memo-row">
          <FormField
            label="獲得ポイント"
            hint="内容に応じて調整できます"
          >
            <div className="point-input">
              <input
                type="number"
                min={1}
                max={99}
                value={points}
                onChange={(event) => setPoints(Number(event.target.value))}
              />
              <span>PT</span>
            </div>
          </FormField>
          <FormField label="ひとことメモ" optional>
            <input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="その場の出来事など"
              maxLength={120}
            />
          </FormField>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="button outline" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="button primary">
            <Flame size={19} />
            この勝負を刻む
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface GroupModalProps {
  onClose: () => void
  onSubmit: (input: {
    name: string
    description: string
    emoji: string
    memberNames: string[]
  }) => void
}

function GroupModal({ onClose, onSubmit }: GroupModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('✊')
  const [members, setMembers] = useState('')
  const [error, setError] = useState('')
  const emojis = ['✊', '🔥', '🍻', '🏕️', '⚽', '🎓', '💪', '🎲']

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const memberNames = members
      .split(/[\n,、]/)
      .map((member) => member.trim())
      .filter(Boolean)
    if (!name.trim()) {
      setError('グループ名を入力してください。')
      return
    }
    if (memberNames.length < 2) {
      setError('最初のメンバーを2人以上入力してください。')
      return
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      emoji,
      memberNames,
    })
  }

  return (
    <Modal title="グループを作成" icon={<Users />} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <FormField label="グループのアイコン">
          <div className="emoji-grid">
            {emojis.map((item) => (
              <button
                type="button"
                key={item}
                className={emoji === item ? 'selected' : ''}
                onClick={() => setEmoji(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </FormField>
        <FormField label="グループ名" required>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例：週末メンバー"
            maxLength={30}
            autoFocus
          />
        </FormField>
        <FormField label="グループの説明" optional>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="例：毎週集まるいつもの4人"
            maxLength={80}
          />
        </FormField>
        <FormField
          label="最初のメンバー"
          hint="改行または読点で区切ってください"
          required
        >
          <textarea
            value={members}
            onChange={(event) => setMembers(event.target.value)}
            placeholder={'シゲル\nケンタ\nユウタ'}
            rows={4}
          />
        </FormField>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button outline" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="button primary">
            <Users size={19} />
            グループを作成
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({
  title,
  icon,
  onClose,
  children,
}: {
  title: string
  icon: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="modal-icon">{icon}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}

function FormField({
  label,
  hint,
  required,
  optional,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  optional?: boolean
  children: ReactNode
}) {
  return (
    <label className="form-field">
      <span className="field-label">
        <strong>{label}</strong>
        {required && <i>必須</i>}
        {optional && <em>任意</em>}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  )
}

function MobileNav({
  view,
  onNavigate,
  onCreateMatch,
}: {
  view: ViewName
  onNavigate: (view: ViewName) => void
  onCreateMatch: () => void
}) {
  return (
    <nav className="mobile-bottom-nav" aria-label="モバイルナビゲーション">
      <NavButton
        active={view === 'home'}
        icon={<Home size={20} />}
        label="ホーム"
        onClick={() => onNavigate('home')}
      />
      <button
        type="button"
        className="mobile-add"
        onClick={onCreateMatch}
        aria-label="勝負を記録"
      >
        <Plus size={25} />
      </button>
      <NavButton
        active={view === 'history'}
        icon={<Archive size={20} />}
        label="記録"
        onClick={() => onNavigate('history')}
      />
      <NavButton
        active={view === 'groups'}
        icon={<Settings2 size={20} />}
        label="グループ"
        onClick={() => onNavigate('groups')}
      />
    </nav>
  )
}

export default App
