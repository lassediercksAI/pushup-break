import type { Timers } from '../infrastructure/youtube-player';

/** A hand-written clock and interval scheduler for adapter tests. */
export const fakeTimers = (start = 0) => {
  let now = start;
  let nextId = 0;
  const intervals = new Map<number, { callback: () => void; ms: number; due: number }>();

  const timers: Timers = {
    now: () => now,
    setInterval: (callback, ms) => {
      nextId += 1;
      intervals.set(nextId, { callback, ms, due: now + ms });
      return nextId;
    },
    clearInterval: (id) => {
      intervals.delete(id);
    },
  };

  /** Moves the clock forward, firing every interval that falls due on the way. */
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const next = [...intervals.entries()]
        .filter(([, interval]) => interval.due <= end)
        .sort(([, a], [, b]) => a.due - b.due)[0];
      if (!next) break;
      const [id, interval] = next;
      now = interval.due;
      intervals.set(id, { ...interval, due: interval.due + interval.ms });
      interval.callback();
    }
    now = end;
  };

  /** Jumps the clock like a sleeping laptop: missed intervals are skipped, not replayed. */
  const jump = (ms: number) => {
    now += ms;
    intervals.forEach((interval, id) => intervals.set(id, { ...interval, due: now + interval.ms }));
  };

  return { timers, advance, jump, activeIntervals: () => intervals.size };
};
