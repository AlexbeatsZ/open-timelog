import { expect, it } from 'vitest';
import { dayRange, initialState, type TimeRecord } from './domain';
import { adjacentGap, buildTimeline, fillAdjacentGap } from './timeline';
const day = '2026-10-19',
  start = dayRange(day).start,
  hour = 3600000;
function fixture() {
  const state = initialState();
  state.records = [
    {
      id: 'one',
      activityId: 'study',
      note: '',
      tags: [],
      spans: [{ start: start + 8 * hour, end: start + 9 * hour }],
      pointsPerHour: 20,
      nature: 'positive',
      deletedAt: null,
      updatedAt: 1,
    },
    {
      id: 'two',
      activityId: 'work',
      note: '',
      tags: [],
      spans: [{ start: start + 10 * hour, end: start + 11 * hour }],
      pointsPerHour: 15,
      nature: 'positive',
      deletedAt: null,
      updatedAt: 1,
    },
  ] as TimeRecord[];
  return state;
}
it('renders latest first and includes uncovered elapsed time rather than future time', () => {
  const entries = buildTimeline(fixture(), day, start + 12 * hour);
  expect(entries.map((row) => (row.kind === 'record' ? row.record.id : 'gap'))).toEqual([
    'gap',
    'two',
    'gap',
    'one',
    'gap',
  ]);
  expect(entries[0]).toMatchObject({ start: start + 11 * hour, end: start + 12 * hour });
  expect(entries.at(-1)).toMatchObject({ start, end: start + 8 * hour });
});
it('fills the upper or lower gap to its nearest boundary and retains the original rate', () => {
  const state = fixture();
  const filled = fillAdjacentGap(state, 'one', 0, 1, day, 'up', start + 12 * hour);
  expect(filled.records[0].spans[0].end).toBe(start + 10 * hour);
  expect(filled.records[0].pointsPerHour).toBe(20);
  const lower = fillAdjacentGap(state, 'two', 0, 1, day, 'down', start + 12 * hour);
  expect(lower.records[1].spans[0].start).toBe(start + 9 * hour);
  expect(state.records[0].spans[0].end).toBe(start + 9 * hour);
});
it('rejects stale writes and never fills across another record', () => {
  const state = fixture();
  expect(() => fillAdjacentGap(state, 'one', 0, 0, day, 'up', start + 12 * hour)).toThrow(
    '发生变化',
  );
  state.records[1].spans[0].start = start + 9 * hour;
  expect(() => fillAdjacentGap(state, 'one', 0, 1, day, 'up', start + 12 * hour)).toThrow('相邻');
});
it('keeps pause gaps and merges active intervals when a pause gap is filled', () => {
  const state = fixture();
  state.records = state.records.slice(0, 1);
  state.records[0].spans.push({ start: start + 10 * hour, end: start + 11 * hour });
  const filled = fillAdjacentGap(state, 'one', 0, 1, day, 'up', start + 12 * hour);
  expect(filled.records[0].spans).toEqual([{ start: start + 8 * hour, end: start + 11 * hour }]);
});
it('clips overnight records and optionally exposes sub-minute gaps', () => {
  const state = fixture();
  state.records = [{ ...state.records[0], spans: [{ start: start - hour, end: start + hour }] }];
  const rows = buildTimeline(state, day, start + hour + 30000);
  expect(rows).toHaveLength(1);
  const short = buildTimeline(state, day, start + hour + 30000, true);
  expect(short[0].kind).toBe('gap');
  expect(rows[0].start).toBe(start);
});
