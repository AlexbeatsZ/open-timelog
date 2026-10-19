import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Database,
  FileText,
  Gift,
  History,
  LayoutGrid,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Square,
  Target,
  TimerReset,
  Trash2,
  X,
} from 'lucide-react';
import {
  balance,
  clipped,
  colors,
  dayKey,
  dayRange,
  dayStart,
  duration,
  finishTimer,
  formatClock,
  formatDuration,
  formatPoints,
  formatTime,
  goalProgress,
  liveSpans,
  localDateTime,
  makeBackup,
  mergeBackup,
  natureLabels,
  newId,
  parseBackup,
  recordPoints,
  recordsIn,
  redeem,
  shiftDay,
  startTimer,
  stats,
  timestamp,
  toCsv,
  toMarkdown,
  toggleTimer,
  validateState,
  type Activity,
  type Backup,
  type Goal,
  type Nature,
  type Reward,
  type State,
  type TimeRecord,
} from './domain';
import { download, mutateState, readRawStorage, readState, subscribe } from './storage';

type Page = 'today' | 'timeline' | 'analytics' | 'activities' | 'goals' | 'rewards' | 'settings';
type Modal =
  | { kind: 'record'; record?: TimeRecord }
  | { kind: 'activity'; activity?: Activity }
  | { kind: 'goal'; goal?: Goal }
  | { kind: 'reward'; reward?: Reward }
  | { kind: 'confirm'; title: string; body: string; action: () => void };
const pages = [
  { id: 'today', title: '今日', icon: Clock3 },
  { id: 'timeline', title: '时间轴', icon: History },
  { id: 'analytics', title: '统计', icon: BarChart3 },
  { id: 'activities', title: '活动', icon: LayoutGrid },
  { id: 'goals', title: '目标', icon: Target },
  { id: 'rewards', title: '奖励', icon: Gift },
  { id: 'settings', title: '数据与设置', icon: Settings2 },
] as const;
const titles: Record<Page, string> = {
  today: '让今天，留下痕迹。',
  timeline: '每一段时间，都有去处。',
  analytics: '从记录里，看见自己。',
  activities: '把生活分成喜欢的样子。',
  goals: '一点一点，靠近想做的事。',
  rewards: '为每一份投入，留一点奖励。',
  settings: '你的时间，握在自己手里。',
};
const pointSign = (value: number) => `${value > 0 ? '+' : ''}${formatPoints(value)}`;
const cssColor = (color: string): CSSProperties => ({ '--activity-color': color }) as CSSProperties;
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function Empty({
  icon = <Clock3 />,
  title,
  detail,
  action,
}: {
  icon?: ReactNode;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function FocusShell({ children, close }: { children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="focus-view"
      aria-label="专注模式"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      {children}
    </dialog>
  );
}

function ModalShell({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <div className="dialog-inner">
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭对话框" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState<Page>('today');
  const [date, setDate] = useState(dayKey(Date.now()));
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [activityId, setActivityId] = useState('study');
  const [timerNote, setTimerNote] = useState('');
  const [search, setSearch] = useState('');
  const [natureFilter, setNatureFilter] = useState<Nature | 'all'>('all');
  const [pendingBackup, setPendingBackup] = useState<Backup | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'restore'>('merge');
  const [rangeDays, setRangeDays] = useState(7);
  const [allRecords, setAllRecords] = useState(false);
  const [focus, setFocus] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      readState()
        .then((next) => {
          if (alive) {
            setState(next);
            setLoadError('');
          }
        })
        .catch((error) => {
          if (alive) setLoadError(errorText(error));
        });
    };
    refresh();
    const unsubscribe = subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.error ? 12000 : 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    setFormError('');
  }, [modal]);
  useEffect(() => {
    document.title = state?.timer
      ? `${formatClock(duration(liveSpans(state.timer, now)))} · 时迹`
      : '时迹 · Open Timelog';
  }, [state?.timer, now]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function mutate(
    transform: (current: State) => State,
    success = '已保存',
    closeModal = false,
  ) {
    if (busy) return false;
    setBusy(true);
    try {
      setState(await mutateState(transform));
      if (success) setNotice({ text: success, error: false });
      if (closeModal) setModal(null);
      return true;
    } catch (error) {
      setNotice({ text: errorText(error), error: true });
      setFormError(errorText(error));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const showError = (error: unknown) => setNotice({ text: errorText(error), error: true });
  const openModal = (next: Modal) => {
    setFormError('');
    setModal(next);
  };
  function exportBackup() {
    if (state) {
      download(
        `open-timelog-${dayKey(Date.now())}.json`,
        JSON.stringify(makeBackup(state), null, 2),
      );
      setNotice({ text: '已导出完整备份（含进行中的计时）', error: false });
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('请选择不超过 10 MB 的备份。');
      setPendingBackup(parseBackup(await file.text()));
      setImportMode('merge');
    } catch (error) {
      showError(error);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  if (loadError)
    return (
      <main className="loading">
        <Database size={36} />
        <h1>暂时无法读取数据</h1>
        <p>{loadError}</p>
        <p>原始数据已保留。请先导出恢复文件，再检查浏览器存储权限。</p>
        <button
          className="primary"
          onClick={() =>
            readRawStorage()
              .then((raw) => download('open-timelog-recovery.json', raw))
              .catch(showError)
          }
        >
          导出恢复文件
        </button>
        {notice && <p role="alert">{notice.text}</p>}
      </main>
    );
  if (!state)
    return (
      <main className="loading">
        <TimerReset size={36} />
        <p>正在打开你的时间记录…</p>
      </main>
    );

  const activeActivities = state.activities.filter((item) => !item.archived);
  const selectedActivity =
    activeActivities.find((item) => item.id === activityId) || activeActivities[0];
  const getActivity = (id: string) => state.activities.find((item) => item.id === id)!;
  const timer = state.timer;
  const timerActivity = timer ? getActivity(timer.activityId) : null;
  const timerMs = timer ? duration(liveSpans(timer, now)) : 0;
  const range = dayRange(date),
    daily = stats(state, range);
  const dayRecords = recordsIn(state, range).sort((a, b) => a.spans[0].start - b.spans[0].start);
  const selectedRecords = (
    page === 'timeline' && allRecords
      ? state.records.filter((record) => !record.deletedAt)
      : dayRecords
  )
    .filter((record) => {
      const activity = getActivity(record.activityId);
      return (
        (natureFilter === 'all' || record.nature === natureFilter) &&
        `${activity.name} ${record.note} ${record.tags.join(' ')}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())
      );
    })
    .sort((a, b) => b.spans[0].start - a.spans[0].start);
  const activeGoals = state.goals.filter((item) => !item.archived);
  const availablePoints = balance(state);

  function datePicker() {
    return (
      <div className="date-picker">
        <button
          className="icon-button"
          aria-label="前一天"
          onClick={() => setDate(shiftDay(date, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <input
          aria-label="查看日期"
          type="date"
          value={date}
          min="1970-01-01"
          max="2199-12-31"
          onChange={(event) => {
            if (event.target.value) setDate(event.target.value);
          }}
        />
        <button
          className="icon-button"
          aria-label="后一天"
          onClick={() => setDate(shiftDay(date, 1))}
        >
          <ChevronRight size={18} />
        </button>
        {date !== dayKey(now) && (
          <button className="text-button" onClick={() => setDate(dayKey(now))}>
            今天
          </button>
        )}
      </div>
    );
  }
  function timeRibbon() {
    return (
      <div className="time-ribbon" aria-label="全天记录分布">
        <div className="ribbon-track">
          {dayRecords.flatMap((record) =>
            clipped(record.spans, range).map((span, index) => (
              <span
                key={`${record.id}-${index}`}
                title={`${getActivity(record.activityId).name} ${formatTime(span.start)}–${formatTime(span.end)}`}
                style={{
                  left: `${((span.start - range.start) / (range.end - range.start)) * 100}%`,
                  width: `${((span.end - span.start) / (range.end - range.start)) * 100}%`,
                  background: getActivity(record.activityId).color,
                }}
              />
            )),
          )}
          {timer &&
            clipped(liveSpans(timer, now), range).map((span, index) => (
              <span
                key={`live-${index}`}
                className="live-strip"
                style={{
                  left: `${((span.start - range.start) / (range.end - range.start)) * 100}%`,
                  width: `${Math.max(0.2, ((span.end - span.start) / (range.end - range.start)) * 100)}%`,
                  background: timerActivity!.color,
                }}
              />
            ))}
        </div>
        <div className="ribbon-hours">
          {['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'].map((hour) => (
            <span key={hour}>{hour}</span>
          ))}
        </div>
      </div>
    );
  }
  function goalCard(goal: Goal, compact = false) {
    const progress = goalProgress(state!, goal, date),
      activity = getActivity(goal.activityId),
      percent = Math.min(100, (progress / goal.minutes) * 100);
    return (
      <article
        className={`goal-card ${compact ? 'compact' : ''}`}
        key={goal.id}
        style={cssColor(activity.color)}
      >
        <div className="section-heading">
          <span className="activity-label">
            <i />
            {goal.name}
          </span>
          {!compact && (
            <button
              className="icon-button"
              aria-label={`编辑目标 ${goal.name}`}
              onClick={() => openModal({ kind: 'goal', goal })}
            >
              <Pencil size={16} />
            </button>
          )}
          {compact && percent >= 100 && <CheckCheck size={17} />}
        </div>
        <div className="goal-detail">
          <span>
            {goal.period === 'day' ? '每日' : '每周'} · {activity.name}
          </span>
          <span>
            <strong>{Math.floor(progress)}</strong> / {goal.minutes} 分钟
          </span>
        </div>
        <div className="progress-track">
          <span style={{ width: `${percent}%` }} />
        </div>
      </article>
    );
  }
  function timerControls() {
    return (
      <div className="timer-controls">
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            mutate(
              (current) => {
                if (
                  current.timer?.id !== timer?.id ||
                  current.timer?.runningSince !== timer?.runningSince
                )
                  throw new Error('计时已在其他窗口更新，请重新操作。');
                return toggleTimer(current, Date.now());
              },
              timer?.runningSince === null ? '计时已继续' : '计时已暂停',
            )
          }
        >
          {timer?.runningSince === null ? <Play size={17} /> : <Pause size={17} />}
          {timer?.runningSince === null ? '继续' : '暂停'}
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            if (
              await mutate((current) => {
                if (current.timer?.id !== timer?.id)
                  throw new Error('计时已在其他窗口更新，请重新操作。');
                return finishTimer(current, Date.now());
              }, '计时已保存')
            ) {
              setTimerNote('');
              setFocus(false);
              setDate(dayKey(Date.now()));
            }
          }}
        >
          <Square size={15} />
          结束并保存
        </button>
      </div>
    );
  }
  function timerPanel() {
    return (
      <section className="panel timer-panel">
        <div className="section-heading">
          <h2>{timer ? '正在做的事' : '此刻，做一件事'}</h2>
          <span className={`badge ${timer ? 'live' : ''}`}>
            {timer ? (timer.runningSince === null ? '已暂停' : '计时中') : '正向计时'}
          </span>
        </div>
        <div
          className={`timer-face ${timer && timer.runningSince !== null ? 'ticking' : ''}`}
          style={
            {
              '--timer-color': timerActivity?.color || selectedActivity?.color || '#256f68',
            } as CSSProperties
          }
        >
          <span className="timer-caption">{timer ? timerActivity?.name : '准备开始'}</span>
          <strong className="clock" aria-label="计时时长">
            {formatClock(timerMs)}
          </strong>
          <span className="timer-value">
            {timer
              ? `${pointSign((timerMs / 3600000) * timer.pointsPerHour)} 积分`
              : '一段时间，一点积累'}
          </span>
        </div>
        {timer ? (
          <>
            <p className="timer-note">{timer.note || '专注于眼前的这一件事'}</p>
            {timerControls()}
            <button className="text-button focus-link" onClick={() => setFocus(true)}>
              进入专注模式
            </button>
            <button
              className="text-button muted cancel-timer"
              onClick={() =>
                openModal({
                  kind: 'confirm',
                  title: '放弃这次计时？',
                  body: '这次计时不会生成记录。已保存的历史记录不受影响。',
                  action: () => {
                    mutate(
                      (current) => {
                        if (current.timer?.id !== timer.id)
                          throw new Error('计时已在其他窗口发生变化，请重新查看。');
                        return { ...current, timer: null };
                      },
                      '已放弃计时',
                      true,
                    );
                  },
                })
              }
            >
              放弃本次
            </button>
          </>
        ) : (
          <>
            <label>
              选择活动
              <select
                aria-label="计时活动"
                value={selectedActivity?.id || ''}
                onChange={(event) => setActivityId(event.target.value)}
              >
                {activeActivities.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              这次准备做什么？
              <textarea
                aria-label="计时描述"
                placeholder="写一句描述，方便之后回顾"
                value={timerNote}
                maxLength={4000}
                onChange={(event) => setTimerNote(event.target.value)}
                rows={2}
              />
            </label>
            <button
              className="primary start-button"
              disabled={busy || !selectedActivity}
              onClick={() =>
                mutate(
                  (current) => startTimer(current, selectedActivity!.id, timerNote, Date.now()),
                  '计时已开始',
                )
              }
            >
              <Play size={17} fill="currentColor" />
              开始计时
            </button>
            <p className="subtle timer-footnote">关闭应用后，计时依然保留</p>
          </>
        )}
      </section>
    );
  }
  function recordList() {
    return (
      <section className="panel records-panel">
        <div className="section-heading">
          <h2>
            {page === 'timeline' && allRecords ? '全部记录' : '时间记录'}
            <span className="count">{selectedRecords.length}</span>
          </h2>
          <button className="text-button" onClick={() => openModal({ kind: 'record' })}>
            <Plus size={16} />
            补记时间
          </button>
        </div>
        <div className="record-filters">
          <div className="segmented" aria-label="按性质筛选">
            {(['all', 'positive', 'neutral', 'negative'] as const).map((item) => (
              <button
                key={item}
                aria-pressed={natureFilter === item}
                className={natureFilter === item ? 'selected' : ''}
                onClick={() => setNatureFilter(item)}
              >
                {item === 'all' ? '全部' : natureLabels[item]}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={15} />
            <input
              aria-label="搜索记录"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索活动、描述、标签"
            />
          </label>
        </div>
        {!selectedRecords.length ? (
          <Empty
            title={search || natureFilter !== 'all' ? '没有找到相关记录' : '今天的故事，从这里开始'}
            detail={
              search || natureFilter !== 'all'
                ? '换个关键词，或切换活动性质。'
                : '开始一次计时，或补记刚刚做过的事。'
            }
            action={
              !(search || natureFilter !== 'all') && (
                <button className="secondary" onClick={() => openModal({ kind: 'record' })}>
                  <Plus size={16} />
                  补记一段时间
                </button>
              )
            }
          />
        ) : (
          <div className="record-list">
            {selectedRecords.map((record) => {
              const activity = getActivity(record.activityId),
                parts =
                  page === 'timeline' && allRecords ? record.spans : clipped(record.spans, range),
                points = recordPoints(
                  record,
                  page === 'timeline' && allRecords ? undefined : range,
                );
              return (
                <article className="record-row" key={record.id} style={cssColor(activity.color)}>
                  <div className="record-time">
                    {page === 'timeline' && allRecords && <small>{dayKey(parts[0].start)}</small>}
                    <time>{formatTime(parts[0].start)}</time>
                    <span>{formatTime(parts.at(-1)!.end)}</span>
                  </div>
                  <span className="record-dot" />
                  <div className="record-content">
                    <div className="record-title">
                      <h3>{activity.name}</h3>
                      <span className={`nature ${record.nature}`}>
                        {natureLabels[record.nature]}
                      </span>
                    </div>
                    {record.note && <p>{record.note}</p>}
                    {record.tags.length > 0 && (
                      <div className="tags">
                        {record.tags.map((tag, index) => (
                          <span key={index}>#{tag}</span>
                        ))}
                      </div>
                    )}
                    {record.spans.length > 1 && (
                      <small className="subtle">
                        {record.spans.length} 段有效计时 · 已扣除暂停
                      </small>
                    )}
                  </div>
                  <div className="record-summary">
                    <strong>{formatDuration(duration(parts))}</strong>
                    <span className={points < 0 ? 'negative-text' : 'positive-text'}>
                      {pointSign(points)} 积分
                    </span>
                  </div>
                  <div className="record-actions">
                    <button
                      className="icon-button"
                      aria-label={`编辑记录 ${activity.name}`}
                      onClick={() => openModal({ kind: 'record', record })}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`删除记录 ${activity.name}`}
                      onClick={() =>
                        openModal({
                          kind: 'confirm',
                          title: '删除这条记录？',
                          body: `${activity.name} · ${formatDuration(duration(record.spans))}。删除后会同时更新统计、积分和目标进度。`,
                          action: () => {
                            mutate(
                              (current) => ({
                                ...current,
                                records: current.records.map((item) =>
                                  item.id === record.id
                                    ? {
                                        ...item,
                                        deletedAt: Date.now(),
                                        updatedAt: timestamp(item.updatedAt),
                                      }
                                    : item,
                                ),
                              }),
                              '记录已删除，可在数据与设置中恢复',
                              true,
                            );
                          },
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }
  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || modal.kind === 'confirm') return;
    const form = new FormData(event.currentTarget),
      text = (key: string) => String(form.get(key) || '').trim();
    try {
      if (modal.kind === 'record') {
        const activityId = text('activityId'),
          note = text('note');
        const tags = text('tags')
          .split(/[,，]/)
          .map((tag) => tag.trim().replace(/^#/, ''))
          .filter(Boolean);
        const spans = Array.from({ length: modal.record?.spans.length || 1 }, (_, index) => ({
          start: new Date(text(`start-${index}`)).getTime(),
          end: new Date(text(`end-${index}`)).getTime(),
        }));
        if (
          spans.some(
            (span) =>
              !Number.isFinite(span.start) || !Number.isFinite(span.end) || span.end <= span.start,
          )
        )
          throw new Error('请填写有效的时间，结束时间需晚于开始时间。');
        if (spans.some((span) => span.end > Date.now() + 60000))
          throw new Error('时间记录不能晚于当前时间。');
        const previous = modal.record;
        await mutate(
          (current) => {
            const activity = current.activities.find((item) => item.id === activityId);
            if (!activity) throw new Error('请选择活动。');
            const existing = previous && current.records.find((item) => item.id === previous.id);
            if (previous && existing?.updatedAt !== previous.updatedAt)
              throw new Error('这条记录已在其他窗口更新，请重新打开编辑。');
            const same = previous?.activityId === activityId;
            const record: TimeRecord = {
              id: previous?.id || newId(),
              activityId,
              note,
              tags,
              spans,
              nature: same ? previous.nature : activity.nature,
              pointsPerHour: same ? previous.pointsPerHour : activity.pointsPerHour,
              deletedAt: null,
              updatedAt: timestamp(existing?.updatedAt),
            };
            return {
              ...current,
              records: previous
                ? current.records.map((item) => (item.id === previous.id ? record : item))
                : [...current.records, record],
            };
          },
          '时间记录已保存',
          true,
        );
      } else if (modal.kind === 'activity') {
        const previous = modal.activity,
          selectedNature = text('nature') as Nature;
        const rawRate = Number(text('rate'));
        const rate =
          selectedNature === 'negative'
            ? -Math.abs(rawRate)
            : selectedNature === 'positive'
              ? Math.abs(rawRate)
              : 0;
        await mutate(
          (current) => {
            if (
              current.activities.some(
                (item) => item.id !== previous?.id && !item.archived && item.name === text('name'),
              )
            )
              throw new Error('已有同名活动，请使用不同名称。');
            const existing = previous && current.activities.find((item) => item.id === previous.id);
            if (previous && existing?.updatedAt !== previous.updatedAt)
              throw new Error('活动已在其他窗口更新，请重新编辑。');
            const activity: Activity = {
              id: previous?.id || newId(),
              name: text('name'),
              color: text('color'),
              nature: selectedNature,
              pointsPerHour: rate,
              archived: previous?.archived || false,
              updatedAt: timestamp(existing?.updatedAt),
            };
            return {
              ...current,
              activities: previous
                ? current.activities.map((item) => (item.id === previous.id ? activity : item))
                : [...current.activities, activity],
            };
          },
          '活动已保存',
          true,
        );
      } else if (modal.kind === 'goal') {
        const previous = modal.goal;
        await mutate(
          (current) => {
            const existing = previous && current.goals.find((item) => item.id === previous.id);
            if (previous && existing?.updatedAt !== previous.updatedAt)
              throw new Error('目标已在其他窗口更新，请重新编辑。');
            const goal: Goal = {
              id: previous?.id || newId(),
              name: text('name'),
              activityId: text('activityId'),
              period: text('period') as Goal['period'],
              minutes: Number(text('minutes')),
              archived: false,
              updatedAt: timestamp(existing?.updatedAt),
            };
            return {
              ...current,
              goals: previous
                ? current.goals.map((item) => (item.id === previous.id ? goal : item))
                : [...current.goals, goal],
            };
          },
          '目标已保存',
          true,
        );
      } else {
        const previous = modal.reward;
        await mutate(
          (current) => {
            const existing = previous && current.rewards.find((item) => item.id === previous.id);
            if (previous && existing?.updatedAt !== previous.updatedAt)
              throw new Error('奖励已在其他窗口更新，请重新编辑。');
            const reward: Reward = {
              id: previous?.id || newId(),
              name: text('name'),
              cost: Number(text('cost')),
              archived: false,
              updatedAt: timestamp(existing?.updatedAt),
            };
            return {
              ...current,
              rewards: previous
                ? current.rewards.map((item) => (item.id === previous.id ? reward : item))
                : [...current.rewards, reward],
            };
          },
          '奖励已保存',
          true,
        );
      }
    } catch (error) {
      setFormError(errorText(error));
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="./icon.svg" alt="" />
          <div>
            <strong>时迹</strong>
            <span>OPEN TIMELOG</span>
          </div>
        </div>
        <nav aria-label="主导航">
          {pages.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => {
                setPage(id);
                setSearch('');
                setNatureFilter('all');
              }}
            >
              <Icon size={19} />
              <span>{title}</span>
              {id === 'today' && timer && <i className="nav-live" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span />
            <div>
              <strong>时间，属于你</strong>
              <small>离线可用 · 无需账号</small>
            </div>
          </div>
          <button className="sidebar-backup" onClick={exportBackup}>
            <ArrowDownToLine size={16} />
            导出备份
          </button>
          <small className="version">Open Timelog · v0.1.0 · MIT</small>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span className="breadcrumb">
            我的时间 <ChevronRight size={13} /> {pages.find((item) => item.id === page)?.title}
          </span>
          <span className="save-status">
            <Check size={14} />
            {busy ? '正在保存…' : '已保存在此设备'}
          </span>
        </header>
        <div className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {page === 'today'
                  ? new Date(dayStart(date)).toLocaleDateString('zh-CN', {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    })
                  : '时迹 / ' + pages.find((item) => item.id === page)?.title}
              </p>
              <h1>{titles[page]}</h1>
            </div>
            {(page === 'today' ||
              page === 'timeline' ||
              page === 'analytics' ||
              page === 'goals') &&
              datePicker()}
            {page === 'activities' && (
              <button className="primary" onClick={() => openModal({ kind: 'activity' })}>
                <Plus size={17} />
                新建活动
              </button>
            )}
            {page === 'rewards' && (
              <button className="primary" onClick={() => openModal({ kind: 'reward' })}>
                <Plus size={17} />
                添加奖励
              </button>
            )}
          </div>

          {(page === 'today' || page === 'timeline') && (
            <>
              <section className="day-overview">
                <div className="overview-stats">
                  <div>
                    <span>已记录</span>
                    <strong>{formatDuration(daily.tracked)}</strong>
                    <small>{daily.count} 段记录</small>
                  </div>
                  <div>
                    <span>积极投入</span>
                    <strong>{formatDuration(daily.positive)}</strong>
                    <small>给想做的事留时间</small>
                  </div>
                  <div>
                    <span>今日积分</span>
                    <strong className={daily.points < 0 ? 'negative-text' : 'positive-text'}>
                      {pointSign(daily.points)}
                      <em>分</em>
                    </strong>
                    <small>每一点投入都有回响</small>
                  </div>
                </div>
                {timeRibbon()}
              </section>
              {page === 'today' ? (
                <div className="today-layout">
                  <div className="today-left">
                    <section className="quick-start">
                      <div className="section-heading">
                        <h2>快速开始</h2>
                        <button className="text-button" onClick={() => setPage('activities')}>
                          管理活动
                          <ChevronRight size={14} />
                        </button>
                      </div>
                      <div className="quick-activities">
                        {activeActivities.slice(0, 6).map((activity) => (
                          <button
                            disabled={busy || !!timer}
                            key={activity.id}
                            style={cssColor(activity.color)}
                            onClick={() => {
                              setActivityId(activity.id);
                              mutate(
                                (current) => startTimer(current, activity.id, '', Date.now()),
                                `开始记录${activity.name}`,
                              );
                            }}
                          >
                            <span className="quick-symbol">
                              <Play size={17} />
                            </span>
                            <span>{activity.name}</span>
                            <small>{pointSign(activity.pointsPerHour)} 分/时</small>
                          </button>
                        ))}
                      </div>
                    </section>
                    {recordList()}
                  </div>
                  <aside className="right-column">
                    {timerPanel()}
                    <section className="panel daily-goals">
                      <div className="section-heading">
                        <h2>一点进展</h2>
                        <button className="text-button" onClick={() => setPage('goals')}>
                          目标
                          <ChevronRight size={14} />
                        </button>
                      </div>
                      {activeGoals.length ? (
                        activeGoals.slice(0, 3).map((goal) => goalCard(goal, true))
                      ) : (
                        <div className="small-empty">
                          <Target size={23} />
                          <p>为一件想做的事，设个小目标。</p>
                          <button
                            className="text-button"
                            onClick={() => openModal({ kind: 'goal' })}
                          >
                            创建第一个目标
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </section>
                  </aside>
                </div>
              ) : (
                <>
                  <div className="timeline-options">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={allRecords}
                        onChange={(event) => setAllRecords(event.target.checked)}
                      />
                      搜索全部日期
                    </label>
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          `timelog-${date}.md`,
                          toMarkdown(state, date),
                          'text/markdown;charset=utf-8',
                        )
                      }
                    >
                      <FileText size={15} />
                      导出当日 Markdown
                    </button>
                  </div>
                  {recordList()}
                </>
              )}
            </>
          )}

          {page === 'analytics' &&
            (() => {
              const keys = Array.from({ length: rangeDays }, (_, index) =>
                shiftDay(date, index - rangeDays + 1),
              );
              const periodRange = { start: dayStart(keys[0]), end: range.end },
                summary = stats(state, periodRange);
              const dailyStats = keys.map((key) => ({
                key,
                ...stats(state, dayRange(key)),
              }));
              const max = Math.max(3600000, ...dailyStats.map((item) => item.tracked));
              const breakdown = state.activities
                .map((activity) => ({
                  ...activity,
                  ms: recordsIn(state, periodRange)
                    .filter((record) => record.activityId === activity.id)
                    .reduce((sum, record) => sum + duration(clipped(record.spans, periodRange)), 0),
                }))
                .filter((item) => item.ms > 0)
                .sort((a, b) => b.ms - a.ms);
              const totalActivityMs = breakdown.reduce((sum, item) => sum + item.ms, 0);
              return (
                <>
                  <div className="analysis-range">
                    <div className="segmented">
                      {[7, 30].map((days) => (
                        <button
                          key={days}
                          className={rangeDays === days ? 'selected' : ''}
                          onClick={() => setRangeDays(days)}
                        >
                          近 {days} 天
                        </button>
                      ))}
                    </div>
                    <p>
                      {keys[0]} 至 {date} · 统计包含已保存记录
                    </p>
                  </div>
                  <div className="analysis-summary">
                    <div>
                      <span>记录时间</span>
                      <strong>{formatDuration(summary.tracked)}</strong>
                    </div>
                    <div>
                      <span>积极时间</span>
                      <strong>{formatDuration(summary.positive)}</strong>
                    </div>
                    <div>
                      <span>时间积分</span>
                      <strong>{pointSign(summary.points)}</strong>
                    </div>
                    <div>
                      <span>日均记录</span>
                      <strong>{formatDuration(summary.tracked / rangeDays)}</strong>
                    </div>
                  </div>
                  <section className="panel chart-panel">
                    <div className="section-heading">
                      <h2>每天的投入</h2>
                      <span className="subtle">按实际时长，已合并重叠区间</span>
                    </div>
                    <div
                      className={`bar-chart days-${rangeDays}`}
                      role="img"
                      aria-label={`近${rangeDays}天记录时长柱状图`}
                    >
                      {dailyStats.map((item) => (
                        <button
                          key={item.key}
                          title={`${item.key}：${formatDuration(item.tracked)}`}
                          onClick={() => {
                            setDate(item.key);
                            setPage('timeline');
                            setAllRecords(false);
                          }}
                        >
                          <div className="bar-slot">
                            <span
                              style={{
                                height: `${(item.tracked / max) * 100}%`,
                              }}
                            />
                          </div>
                          <small>{item.key.slice(5).replace('-', '/')}</small>
                        </button>
                      ))}
                    </div>
                    <p className="subtle">点击某一天，查看当日记录。</p>
                  </section>
                  <section className="panel distribution-panel">
                    <div className="section-heading">
                      <h2>时间花在哪里</h2>
                      <span className="subtle">按活动累计时长</span>
                    </div>
                    {breakdown.length ? (
                      breakdown.map((item) => (
                        <div
                          className="distribution-row"
                          key={item.id}
                          style={cssColor(item.color)}
                        >
                          <span className="activity-label">
                            <i />
                            {item.name}
                          </span>
                          <div className="progress-track">
                            <span
                              style={{
                                width: `${(item.ms / Math.max(...breakdown.map((a) => a.ms))) * 100}%`,
                              }}
                            />
                          </div>
                          <strong>{formatDuration(item.ms)}</strong>
                          <small>{Math.round((item.ms / totalActivityMs) * 100)}%</small>
                        </div>
                      ))
                    ) : (
                      <Empty
                        icon={<BarChart3 />}
                        title="积累一些记录，再来看看"
                        detail="你记录的每一段时间，都会出现在这里。"
                      />
                    )}
                  </section>
                </>
              );
            })()}

          {page === 'activities' && (
            <>
              <p className="page-description">
                积极活动获得积分，消极活动消耗积分。调整速率只影响新记录。
              </p>
              <div className="activity-grid">
                {state.activities.map((activity) => (
                  <article
                    className={`panel activity-card ${activity.archived ? 'archived' : ''}`}
                    key={activity.id}
                    style={cssColor(activity.color)}
                  >
                    <div className="section-heading">
                      <span className="activity-avatar">{activity.name.slice(0, 1)}</span>
                      <button
                        className="icon-button"
                        aria-label={`编辑活动 ${activity.name}`}
                        onClick={() => openModal({ kind: 'activity', activity })}
                      >
                        <Pencil size={17} />
                      </button>
                    </div>
                    <h2>{activity.name}</h2>
                    <p>
                      <span className={`nature ${activity.nature}`}>
                        {natureLabels[activity.nature]}
                      </span>
                      <span>{pointSign(activity.pointsPerHour)} 分 / 小时</span>
                    </p>
                    <div className="activity-card-footer">
                      <button
                        className="text-button"
                        disabled={busy || !!timer || activity.archived}
                        onClick={() => {
                          setActivityId(activity.id);
                          mutate(
                            (current) => startTimer(current, activity.id, '', Date.now()),
                            '计时已开始',
                          );
                          setPage('today');
                        }}
                      >
                        <Play size={15} />
                        开始计时
                      </button>
                      <button
                        className="text-button muted"
                        disabled={busy || timer?.activityId === activity.id}
                        onClick={() =>
                          mutate(
                            (current) => ({
                              ...current,
                              activities: current.activities.map((item) =>
                                item.id === activity.id
                                  ? {
                                      ...item,
                                      archived: !item.archived,
                                      updatedAt: timestamp(item.updatedAt),
                                    }
                                  : item,
                              ),
                            }),
                            activity.archived ? '活动已恢复' : '活动已归档',
                          )
                        }
                      >
                        {activity.archived ? '恢复' : '归档'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {page === 'goals' && (
            <>
              <div className="section-heading page-description">
                <p>进度自动来自已保存的时间记录。每周从周一开始。</p>
                <button className="primary" onClick={() => openModal({ kind: 'goal' })}>
                  <Plus size={17} />
                  创建目标
                </button>
              </div>
              {activeGoals.length ? (
                <div className="goals-grid">
                  {activeGoals.map((goal) => (
                    <section className="panel" key={goal.id}>
                      {goalCard(goal)}
                      <div className="goal-footer">
                        <span>
                          {goalProgress(state, goal, date) >= goal.minutes
                            ? '这份投入，已经达成。'
                            : '按自己的节奏，继续就好。'}
                        </span>
                        <button
                          className="text-button muted"
                          onClick={() =>
                            mutate(
                              (current) => ({
                                ...current,
                                goals: current.goals.map((item) =>
                                  item.id === goal.id
                                    ? {
                                        ...item,
                                        archived: true,
                                        updatedAt: timestamp(item.updatedAt),
                                      }
                                    : item,
                                ),
                              }),
                              '目标已归档',
                            )
                          }
                        >
                          归档
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={<Target />}
                    title="给想做的事，一个具体的时间"
                    detail="比如每日阅读 30 分钟，或每周运动 150 分钟。"
                    action={
                      <button className="secondary" onClick={() => openModal({ kind: 'goal' })}>
                        <Plus size={16} />
                        创建目标
                      </button>
                    }
                  />
                </section>
              )}
              {state.goals.some((item) => item.archived) && (
                <section className="panel archived-items">
                  <h2>已归档目标</h2>
                  {state.goals
                    .filter((item) => item.archived)
                    .map((item) => (
                      <div className="settings-row" key={item.id}>
                        <span>{item.name}</span>
                        <button
                          className="text-button"
                          onClick={() =>
                            mutate(
                              (current) => ({
                                ...current,
                                goals: current.goals.map((goal) =>
                                  goal.id === item.id
                                    ? {
                                        ...goal,
                                        archived: false,
                                        updatedAt: timestamp(goal.updatedAt),
                                      }
                                    : goal,
                                ),
                              }),
                              '目标已恢复',
                            )
                          }
                        >
                          恢复
                        </button>
                      </div>
                    ))}
                </section>
              )}
            </>
          )}

          {page === 'rewards' && (
            <>
              <section className="balance-panel">
                <div>
                  <span>可用积分</span>
                  <strong>
                    {formatPoints(availablePoints)}
                    <small>分</small>
                  </strong>
                </div>
                <p>
                  把持续的投入，换成喜欢的事。
                  <br />
                  积分来自时间记录，兑换后自动扣除。
                </p>
              </section>
              <div className="rewards-grid">
                {state.rewards
                  .filter((item) => !item.archived)
                  .map((reward) => (
                    <article className="panel reward-card" key={reward.id}>
                      <div className="section-heading">
                        <Gift size={26} />
                        <button
                          className="icon-button"
                          aria-label={`编辑奖励 ${reward.name}`}
                          onClick={() => openModal({ kind: 'reward', reward })}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                      <h2>{reward.name}</h2>
                      <p>
                        <strong>{formatPoints(reward.cost)}</strong> 积分
                      </p>
                      <div className="reward-footer">
                        <button
                          className="secondary"
                          disabled={busy || availablePoints < reward.cost}
                          onClick={() =>
                            openModal({
                              kind: 'confirm',
                              title: `兑换「${reward.name}」？`,
                              body: `将消耗 ${formatPoints(reward.cost)} 积分。`,
                              action: () => {
                                mutate(
                                  (current) => redeem(current, reward.id, Date.now()),
                                  '奖励已兑换，享受一下吧',
                                  true,
                                );
                              },
                            })
                          }
                        >
                          {availablePoints < reward.cost
                            ? `还差 ${formatPoints(reward.cost - availablePoints)} 分`
                            : '兑换奖励'}
                        </button>
                        <button
                          className="text-button muted"
                          onClick={() =>
                            mutate(
                              (current) => ({
                                ...current,
                                rewards: current.rewards.map((item) =>
                                  item.id === reward.id
                                    ? {
                                        ...item,
                                        archived: true,
                                        updatedAt: timestamp(item.updatedAt),
                                      }
                                    : item,
                                ),
                              }),
                              '奖励已归档',
                            )
                          }
                        >
                          归档
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              {!state.rewards.some((item) => !item.archived) && (
                <section className="panel">
                  <Empty
                    icon={<Coffee />}
                    title="什么事值得期待？"
                    detail="一本书、一杯咖啡，或一段心安理得的休息。"
                    action={
                      <button className="secondary" onClick={() => openModal({ kind: 'reward' })}>
                        <Plus size={16} />
                        添加奖励
                      </button>
                    }
                  />
                </section>
              )}
              <section className="panel redemption-panel">
                <h2>兑换记录</h2>
                {state.redemptions.length ? (
                  state.redemptions
                    .slice()
                    .reverse()
                    .map((item) => (
                      <div className="settings-row" key={item.id}>
                        <span>
                          <strong>{item.name}</strong>
                          <small>{new Date(item.at).toLocaleString('zh-CN')}</small>
                        </span>
                        <strong className="negative-text">−{formatPoints(item.cost)} 分</strong>
                      </div>
                    ))
                ) : (
                  <p className="subtle">还没有兑换记录，先从一段时间开始积累。</p>
                )}
              </section>
              {state.rewards.some((item) => item.archived) && (
                <section className="panel archived-items">
                  <h2>已归档奖励</h2>
                  {state.rewards
                    .filter((item) => item.archived)
                    .map((item) => (
                      <div className="settings-row" key={item.id}>
                        <span>{item.name}</span>
                        <button
                          className="text-button"
                          onClick={() =>
                            mutate(
                              (current) => ({
                                ...current,
                                rewards: current.rewards.map((reward) =>
                                  reward.id === item.id
                                    ? {
                                        ...reward,
                                        archived: false,
                                        updatedAt: timestamp(reward.updatedAt),
                                      }
                                    : reward,
                                ),
                              }),
                              '奖励已恢复',
                            )
                          }
                        >
                          恢复
                        </button>
                      </div>
                    ))}
                </section>
              )}
            </>
          )}

          {page === 'settings' && (
            <div className="settings-content">
              <section className="panel">
                <h2>备份与迁移</h2>
                <p className="subtle">
                  完整 JSON 备份可迁移活动、记录、目标、奖励和计时。请定期保存到安全的位置。
                </p>
                <div className="settings-row">
                  <div>
                    <strong>完整备份</strong>
                    <p>
                      {state.records.filter((item) => !item.deletedAt).length} 条记录 ·{' '}
                      {state.activities.length} 项活动 · {state.goals.length} 个目标
                    </p>
                  </div>
                  <button className="secondary" onClick={exportBackup}>
                    <ArrowDownToLine size={16} />
                    导出 JSON
                  </button>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>导入时迹备份</strong>
                    <p>先预览再合并；同 ID 保留较新版本。导入前自动下载当前备份。</p>
                  </div>
                  <button className="secondary" onClick={() => fileInput.current?.click()}>
                    <ArrowUpFromLine size={16} />
                    选择备份
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInput}
                  accept=".json,application/json"
                  hidden
                  aria-label="导入备份文件"
                  onChange={(event) => importFile(event.target.files?.[0])}
                />
                <div className="info-note">
                  UpTimer 原生数据库与备份格式尚未完成兼容验证，当前只接受时迹备份。
                </div>
              </section>
              <section className="panel">
                <h2>导出时间记录</h2>
                <div className="settings-row">
                  <div>
                    <strong>表格 CSV</strong>
                    <p>全部有效记录，适合 Excel 和后续分析。时间使用 ISO 格式。</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(`timelog-${dayKey(now)}.csv`, toCsv(state), 'text/csv;charset=utf-8')
                    }
                  >
                    <ArrowDownToLine size={16} />
                    导出 CSV
                  </button>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>当日回顾 Markdown</strong>
                    <p>导出 {date}，可放入日记或 Obsidian。</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        `timelog-${date}.md`,
                        toMarkdown(state, date),
                        'text/markdown;charset=utf-8',
                      )
                    }
                  >
                    <FileText size={16} />
                    导出 Markdown
                  </button>
                </div>
              </section>
              <section className="panel">
                <h2>最近删除</h2>
                {state.records.some((item) => item.deletedAt) ? (
                  state.records
                    .filter((item) => item.deletedAt)
                    .slice()
                    .reverse()
                    .map((record) => (
                      <div className="settings-row" key={record.id}>
                        <div>
                          <strong>{getActivity(record.activityId).name}</strong>
                          <p>
                            {dayKey(record.spans[0].start)} ·{' '}
                            {formatDuration(duration(record.spans))}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() =>
                            mutate(
                              (current) => ({
                                ...current,
                                records: current.records.map((item) =>
                                  item.id === record.id
                                    ? {
                                        ...item,
                                        deletedAt: null,
                                        updatedAt: timestamp(item.updatedAt),
                                      }
                                    : item,
                                ),
                              }),
                              '记录已恢复',
                            )
                          }
                        >
                          <RotateCcw size={15} />
                          恢复
                        </button>
                      </div>
                    ))
                ) : (
                  <p className="subtle">没有已删除的记录。</p>
                )}
              </section>
              <section className="panel about-panel">
                <img src="./icon.svg" alt="" />
                <div>
                  <h2>
                    时迹 · Open Timelog <span>0.1.0</span>
                  </h2>
                  <p>独立实现的开源时间记录工具，参考 UpTimer 的时间记录与自我反馈理念。</p>
                  <p className="subtle">MIT 许可 · 无账号 · 无遥测 · 数据保存在此设备</p>
                  <p className="subtle">
                    网页端数据属于当前浏览器与站点，桌面端单独保存。清除站点或应用数据前请导出备份。设备之间目前通过备份手动迁移。
                  </p>
                </div>
              </section>
            </div>
          )}
          <footer className="workspace-footer">
            <span>把时间看见，把日子过好。</span>
            <span>时迹 · Open Timelog</span>
          </footer>
        </div>
      </main>

      {notice && (
        <div
          className={`toast ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <X size={17} /> : <Check size={17} />}
          <span>{notice.text}</span>
          <button aria-label="关闭提示" onClick={() => setNotice(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <ModalShell
          close={() => {
            if (!busy) setModal(null);
          }}
          title={
            modal.kind === 'confirm'
              ? modal.title
              : modal.kind === 'record'
                ? modal.record
                  ? '编辑时间记录'
                  : '补记一段时间'
                : modal.kind === 'activity'
                  ? modal.activity
                    ? '编辑活动'
                    : '新建活动'
                  : modal.kind === 'goal'
                    ? modal.goal
                      ? '编辑目标'
                      : '创建目标'
                    : modal.reward
                      ? '编辑奖励'
                      : '添加奖励'
          }
        >
          {modal.kind === 'confirm' ? (
            <>
              <p className="confirm-body">{modal.body}</p>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="dialog-actions">
                <button className="secondary" disabled={busy} onClick={() => setModal(null)}>
                  取消
                </button>
                <button className="primary" disabled={busy} onClick={modal.action}>
                  确认
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submitForm}>
              {modal.kind === 'record' && (
                <>
                  <label>
                    活动
                    <select
                      name="activityId"
                      defaultValue={modal.record?.activityId || selectedActivity?.id}
                      required
                    >
                      {state.activities
                        .filter((item) => !item.archived || item.id === modal.record?.activityId)
                        .map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {(
                    modal.record?.spans || [
                      {
                        start: Math.max(
                          dayStart(date),
                          Math.min(Date.now(), dayRange(date).end) - 30 * 60000,
                        ),
                        end: Math.min(Date.now(), dayRange(date).end),
                      },
                    ]
                  ).map((span, index) => (
                    <div key={index} className="form-columns">
                      <label>
                        {index ? `第 ${index + 1} 段开始` : '开始时间'}
                        <input
                          name={`start-${index}`}
                          aria-label={index ? `第 ${index + 1} 段开始` : '开始时间'}
                          type="datetime-local"
                          step="1"
                          defaultValue={`${localDateTime(span.start)}:${String(new Date(span.start).getSeconds()).padStart(2, '0')}`}
                          required
                        />
                      </label>
                      <label>
                        {index ? `第 ${index + 1} 段结束` : '结束时间'}
                        <input
                          name={`end-${index}`}
                          aria-label={index ? `第 ${index + 1} 段结束` : '结束时间'}
                          type="datetime-local"
                          step="1"
                          defaultValue={`${localDateTime(span.end)}:${String(new Date(span.end).getSeconds()).padStart(2, '0')}`}
                          required
                        />
                      </label>
                    </div>
                  ))}
                  <label>
                    描述
                    <textarea
                      name="note"
                      aria-label="描述"
                      defaultValue={modal.record?.note || ''}
                      rows={3}
                      maxLength={4000}
                      placeholder="做了什么，有什么收获？"
                    />
                  </label>
                  <label>
                    标签
                    <input
                      name="tags"
                      defaultValue={modal.record?.tags.join(', ') || ''}
                      maxLength={600}
                      placeholder="用逗号分隔，例如：课程, 物理化学"
                    />
                  </label>
                  <p className="subtle">重叠记录在总时长中合并，积分按每条记录计算。</p>
                </>
              )}
              {modal.kind === 'activity' && (
                <>
                  <label>
                    活动名称
                    <input
                      name="name"
                      defaultValue={modal.activity?.name}
                      placeholder="例如：学习、运动、阅读"
                      maxLength={80}
                      required
                    />
                  </label>
                  <div className="form-columns">
                    <label>
                      活动性质
                      <select name="nature" defaultValue={modal.activity?.nature || 'positive'}>
                        <option value="positive">积极 · 获得积分</option>
                        <option value="neutral">日常 · 不计积分</option>
                        <option value="negative">消极 · 消耗积分</option>
                      </select>
                    </label>
                    <label>
                      每小时积分
                      <input
                        type="number"
                        name="rate"
                        defaultValue={Math.abs(modal.activity?.pointsPerHour ?? 20)}
                        min="0"
                        max="100000"
                        step="0.01"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    活动颜色
                    <input
                      className="color-input"
                      type="color"
                      name="color"
                      defaultValue={
                        modal.activity?.color || colors[state.activities.length % colors.length]
                      }
                    />
                  </label>
                  <p className="subtle">
                    日常活动自动计为 0 分；消极活动自动扣分。历史记录保留原来的性质和速率。
                  </p>
                </>
              )}
              {modal.kind === 'goal' && (
                <>
                  <label>
                    目标名称
                    <input
                      name="name"
                      defaultValue={modal.goal?.name}
                      maxLength={80}
                      placeholder="例如：每天读一点"
                      required
                    />
                  </label>
                  <label>
                    关联活动
                    <select
                      name="activityId"
                      defaultValue={modal.goal?.activityId || selectedActivity?.id}
                      required
                    >
                      {state.activities
                        .filter((item) => !item.archived || item.id === modal.goal?.activityId)
                        .map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="form-columns">
                    <label>
                      周期
                      <select name="period" defaultValue={modal.goal?.period || 'day'}>
                        <option value="day">每天</option>
                        <option value="week">每周（周一开始）</option>
                      </select>
                    </label>
                    <label>
                      目标时长（分钟）
                      <input
                        name="minutes"
                        type="number"
                        defaultValue={modal.goal?.minutes || 30}
                        min="1"
                        max="1000000"
                        step="1"
                        required
                      />
                    </label>
                  </div>
                </>
              )}
              {modal.kind === 'reward' && (
                <>
                  <label>
                    奖励名称
                    <input
                      name="name"
                      defaultValue={modal.reward?.name}
                      maxLength={80}
                      placeholder="例如：周末去看一场电影"
                      required
                    />
                  </label>
                  <label>
                    需要积分
                    <input
                      name="cost"
                      type="number"
                      defaultValue={modal.reward?.cost || 100}
                      min="0.01"
                      max="100000000"
                      step="0.01"
                      required
                    />
                  </label>
                </>
              )}
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setModal(null)}
                  disabled={busy}
                >
                  取消
                </button>
                <button type="submit" className="primary" disabled={busy}>
                  {busy ? '正在保存…' : '保存'}
                </button>
              </div>
            </form>
          )}
        </ModalShell>
      )}
      {pendingBackup && (
        <ModalShell
          title="预览备份"
          close={() => {
            if (!busy) setPendingBackup(null);
          }}
        >
          <div className="backup-preview">
            <p>导出于 {new Date(pendingBackup.exportedAt).toLocaleString('zh-CN')}</p>
            <strong>
              {pendingBackup.data.records.filter((item) => !item.deletedAt).length} 条有效记录 ·{' '}
              {pendingBackup.data.activities.length} 项活动
            </strong>
            <label>
              导入方式
              <select
                aria-label="导入方式"
                value={importMode}
                onChange={(event) => setImportMode(event.target.value as 'merge' | 'restore')}
              >
                <option value="merge">合并到现有数据</option>
                <option value="restore">完整恢复（替换本机数据）</option>
              </select>
            </label>
            <p>
              {importMode === 'merge'
                ? '同一 ID 保留更新时间较新的内容。已删除标记与归档状态会一并合并。'
                : '完整恢复将替换本机现有数据和正在进行的计时，使用备份中的完整状态。'}
              导入前将下载本机备份。
            </p>
            {importMode === 'merge' && (timer || pendingBackup.data.timer) && (
              <p className="form-error">
                合并前请先保存计时。若要迁移整个状态（含计时），请选择完整恢复。
              </p>
            )}
          </div>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setPendingBackup(null)} disabled={busy}>
              取消
            </button>
            <button
              className="primary"
              disabled={busy || (importMode === 'merge' && (!!timer || !!pendingBackup.data.timer))}
              onClick={async () => {
                try {
                  const saved = await mutate(
                    (current) => {
                      const merged =
                        importMode === 'merge'
                          ? mergeBackup(current, pendingBackup.data)
                          : validateState(pendingBackup.data);
                      download(
                        `open-timelog-before-import-${Date.now()}.json`,
                        JSON.stringify(makeBackup(current), null, 2),
                      );
                      return merged;
                    },
                    importMode === 'merge' ? '备份已合并' : '完整备份已恢复',
                  );
                  if (saved) setPendingBackup(null);
                } catch (error) {
                  showError(error);
                }
              }}
            >
              {importMode === 'merge' ? '备份当前数据并合并' : '备份当前数据并完整恢复'}
            </button>
          </div>
        </ModalShell>
      )}
      {focus && timer && (
        <FocusShell close={() => setFocus(false)}>
          <button className="secondary focus-exit" onClick={() => setFocus(false)}>
            <X size={18} />
            退出专注
          </button>
          <span className="focus-label">
            {timer.runningSince === null ? '休息一下，随时继续' : '只做眼前的这一件事'}
          </span>
          <h1>{timerActivity?.name}</h1>
          <strong className="focus-clock">{formatClock(timerMs)}</strong>
          <p>{timer.note || '把这一刻，留给自己。'}</p>
          {timerControls()}
          <small>Esc 退出专注模式</small>
        </FocusShell>
      )}
    </div>
  );
}
