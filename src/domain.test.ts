import { describe, expect, it } from 'vitest';
import {
  balance,
  clipped,
  dayKey,
  dayRange,
  dayStart,
  duration,
  finishTimer,
  goalProgress,
  initialState,
  liveSpans,
  makeBackup,
  mergeBackup,
  parseBackup,
  recordPoints,
  redeem,
  shiftDay,
  startTimer,
  stats,
  toCsv,
  toggleTimer,
  unionDuration,
  validateState,
  weekRange,
  type State,
  type TimeRecord,
} from './domain';

const hour = 3600000;
const record = (start: number, end: number, override: Partial<TimeRecord> = {}): TimeRecord => ({
  id: crypto.randomUUID(),
  activityId: 'study',
  note: '',
  tags: [],
  spans: [{ start, end }],
  pointsPerHour: 20,
  nature: 'positive',
  deletedAt: null,
  updatedAt: end,
  ...override,
});
describe('durable timing', () => {
  it('restores running state after serialization and excludes every pause', () => {
    let state = startTimer(initialState(), 'study', 'chapter 1', 10000);
    state = toggleTimer(state, 10000 + hour);
    expect(state.timer!.runningSince).toBeNull();
    state = toggleTimer(validateState(JSON.parse(JSON.stringify(state))), 10000 + 3 * hour);
    expect(duration(liveSpans(state.timer!, 10000 + 4 * hour))).toBe(2 * hour);
    state = finishTimer(state, 10000 + 4 * hour);
    expect(state.timer).toBeNull();
    expect(duration(state.records[0].spans)).toBe(2 * hour);
    expect(recordPoints(state.records[0])).toBe(40);
  });
  it('rejects two simultaneous timers and a backward clock without losing state', () => {
    const state = startTimer(initialState(), 'study', '', 10000);
    expect(() => startTimer(state, 'work', '', 11000)).toThrow('已有计时');
    expect(() => finishTimer(state, 9000)).toThrow('系统时间');
    expect(state.timer!.runningSince).toBe(10000);
  });
  it('preserves the activity rate and nature captured at timer start', () => {
    let state = startTimer(initialState(), 'study', '', 10000);
    state.activities[0].pointsPerHour = 500;
    state.activities[0].nature = 'negative';
    state = finishTimer(state, 10000 + hour);
    expect(recordPoints(state.records[0])).toBe(20);
    expect(state.records[0].nature).toBe('positive');
  });
});
describe('calendar and overlap semantics', () => {
  it('allocates a midnight-crossing record into the right local days', () => {
    const key = '2026-10-19',
      end = dayRange(key).end;
    const state = initialState();
    state.records = [record(end - hour, end + 2 * hour)];
    expect(stats(state, dayRange(key)).tracked).toBe(hour);
    expect(stats(state, dayRange('2026-10-20')).tracked).toBe(2 * hour);
    expect(stats(state, dayRange(key)).points).toBe(20);
  });
  it('uses calendar midnight rather than fixed 24-hour arithmetic on DST days', () => {
    const key = '2026-03-08';
    expect(shiftDay(key, 1)).toBe('2026-03-09');
    expect(dayKey(dayRange(key).end)).toBe('2026-03-09');
    // In America/New_York this is a 23-hour day; works in other host zones too.
    expect(dayRange(key).end - dayRange(key).start).toBe(
      new Date(2026, 2, 9).getTime() - new Date(2026, 2, 8).getTime(),
    );
    expect(dayRange(key).end - dayRange(key).start).toBe(23 * hour);
  });
  it('unions nested and adjacent spans without double counting daily totals', () => {
    expect(
      unionDuration([
        { start: 0, end: 10 },
        { start: 2, end: 3 },
        { start: 9, end: 20 },
        { start: 20, end: 25 },
      ]),
    ).toBe(25);
    const state = initialState(),
      start = dayStart('2026-10-19');
    state.records = [record(start, start + 2 * hour), record(start + hour, start + 3 * hour)];
    expect(stats(state, dayRange('2026-10-19')).tracked).toBe(3 * hour);
    expect(stats(state, dayRange('2026-10-19')).points).toBe(80);
  });
  it('calculates weekly goal progress from Monday and ignores deleted records', () => {
    const state = initialState(),
      start = dayStart('2026-10-19');
    state.records = [
      record(start, start + hour),
      record(start - 24 * hour, start - 23 * hour),
      record(start + hour, start + 2 * hour, { deletedAt: start + 3 * hour }),
    ];
    expect(dayKey(weekRange('2026-10-25').start)).toBe('2026-10-19');
    expect(
      goalProgress(
        state,
        {
          id: 'g',
          name: 'test',
          activityId: 'study',
          minutes: 100,
          period: 'week',
          archived: false,
          updatedAt: start,
        },
        '2026-10-25',
      ),
    ).toBe(60);
  });
});
describe('portable data and points', () => {
  it('roundtrips a complete backup including a running timer', () => {
    const state = startTimer(initialState(), 'work', 'notes', 10000);
    expect(parseBackup(JSON.stringify(makeBackup(state))).data).toEqual(state);
  });
  it('rejects native, dangling, duplicate and malformed data atomically', () => {
    expect(() => parseBackup('{"documents":[]}')).toThrow('UpTimer');
    const state = initialState();
    state.records.push(record(1000, 2000, { activityId: 'missing' }));
    expect(() => validateState(state)).toThrow('不存在');
    const duplicate = initialState();
    duplicate.activities.push(duplicate.activities[0]);
    expect(() => validateState(duplicate)).toThrow('重复');
    const bad = initialState();
    bad.records.push(record(1000, 900));
    expect(() => validateState(bad)).toThrow('结束时间');
  });
  it('merges newer edits and tombstones, preserving unrelated local records', () => {
    const local = validateState(initialState());
    local.records = [
      record(1000, 2000, { id: 'one', updatedAt: 10 }),
      record(3000, 4000, { id: 'two' }),
    ];
    const incoming = structuredClone(local);
    incoming.records = [{ ...local.records[0], deletedAt: 5000, updatedAt: 20 }];
    const merged = mergeBackup(local, incoming);
    expect(merged.records).toHaveLength(2);
    expect(merged.records[0].deletedAt).toBe(5000);
    expect(local.records[0].deletedAt).toBeNull();
    expect(mergeBackup(merged, incoming)).toEqual(merged);
  });
  it('refuses ambiguous equal-version conflicts and active-timer merges', () => {
    const local = validateState(initialState()),
      incoming = structuredClone(local);
    incoming.activities[0].name = 'changed';
    expect(() => mergeBackup(local, incoming)).toThrow('同一版本');
    expect(() => mergeBackup(startTimer(local, 'study', '', 10000), local)).toThrow('先');
  });
  it('protects CSV cells against spreadsheet formulas', () => {
    const state = initialState();
    state.records = [record(1000, 2000, { note: '=HYPERLINK("bad")' })];
    expect(toCsv(state)).toContain('"\'=HYPERLINK(""bad"")"');
  });
  it('prevents spending more than the current balance and retains reward cost', () => {
    let state = initialState();
    state.records = [record(1000, 1000 + hour)];
    state.rewards = [{ id: 'r', name: 'coffee', cost: 15, archived: false, updatedAt: 1000 }];
    state = redeem(state, 'r', 1000 + hour);
    expect(balance(state)).toBe(5);
    expect(() => redeem(state, 'r', 1000 + 2 * hour)).toThrow('不够');
    state.rewards[0].cost = 1;
    expect(balance(state)).toBe(5);
  });
});
