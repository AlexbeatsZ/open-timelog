import { openDB } from 'idb';
import { initialState, validateState, type State } from './domain';

const db = openDB('open-timelog', 1, {
  upgrade(database) {
    database.createObjectStore('state');
  },
});
const listeners = new Set<() => void>();
const channel =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('open-timelog-changes');
channel?.addEventListener('message', () => listeners.forEach((fn) => fn()));
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function readState(): Promise<State> {
  const database = await db;
  const tx = database.transaction('state', 'readwrite');
  const raw = await tx.store.get('current');
  const state = raw === undefined ? initialState() : validateState(raw);
  if (raw === undefined) await tx.store.put(state, 'current');
  await tx.done;
  return state;
}
// Read, transform, validate and write in one serialized IndexedDB transaction.
// Concurrent windows therefore see the most recently committed timer/points.
export async function mutateState(transform: (state: State) => State): Promise<State> {
  const database = await db;
  const tx = database.transaction('state', 'readwrite');
  try {
    const previous = await tx.store.get('current');
    const next = validateState(
      transform(previous === undefined ? initialState() : validateState(previous)),
    );
    if (previous !== undefined) await tx.store.put(previous, 'previous');
    await tx.store.put(next, 'current');
    await tx.done;
    listeners.forEach((fn) => fn());
    channel?.postMessage('changed');
    return next;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Transaction may already have aborted. */
    }
    await tx.done.catch(() => undefined);
    throw error;
  }
}
export async function readRawStorage(): Promise<string> {
  const database = await db;
  return JSON.stringify(
    {
      current: await database.get('state', 'current'),
      previous: await database.get('state', 'previous'),
    },
    null,
    2,
  );
}
export function download(name: string, data: string, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
