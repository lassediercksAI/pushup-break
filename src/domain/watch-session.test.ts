import { describe, expect, it } from 'vitest';
import { defaultPolicy, withWatchInterval, type BreakPolicy } from './break-policy';
import { defaultCatalog, type ExerciseId } from './exercise';
import { err, ok } from './result';
import type { Instant, Roll, Seconds, WatchInterval } from './values';
import {
  decide,
  evolve,
  initialSession,
  type Command,
  type DomainEvent,
  type WatchSession,
} from './watch-session';

const s = (n: number) => n as Seconds;
const t = (n: number) => n as Instant;
const r = (n: number) => n as Roll;
const [pushups, squats] = [defaultCatalog[0], defaultCatalog[1] ?? defaultCatalog[0]];

// Two-minute interval: a break is due after 120 s of playback.
const policy: BreakPolicy = withWatchInterval(defaultPolicy, 2 as WatchInterval);

const watching = (watched: number, lastExercise: ExerciseId | null = null): WatchSession => ({
  status: 'watching',
  watched: s(watched),
  lastExercise,
});

const onBreak = (startedAt: number, exercise = pushups): WatchSession => ({
  status: 'onBreak',
  exercise,
  startedAt: t(startedAt),
});

const playback = (seconds: number, at = 0, roll = 0): Command => ({
  type: 'RecordPlayback',
  seconds: s(seconds),
  at: t(at),
  roll: r(roll),
});

const acknowledge = (at: number): Command => ({ type: 'AcknowledgeBreak', at: t(at) });

describe('decide', () => {
  it.each<[string, WatchSession, Command, ReturnType<typeof decide>]>([
    [
      'records playback below the interval as watch time',
      watching(0),
      playback(1),
      ok([{ type: 'WatchTimeRecorded', seconds: s(1) }]),
    ],
    [
      'starts a break as soon as watch time reaches the interval',
      watching(119),
      playback(1, 5_000, 0),
      ok([
        { type: 'WatchTimeRecorded', seconds: s(1) },
        { type: 'BreakStarted', exercise: pushups, at: t(5_000) },
      ]),
    ],
    [
      'only records watch time up to the interval when a tick overshoots it',
      watching(119.5),
      playback(2, 5_000, 0),
      ok([
        { type: 'WatchTimeRecorded', seconds: s(0.5) },
        { type: 'BreakStarted', exercise: pushups, at: t(5_000) },
      ]),
    ],
    [
      'starts a break at once when the interval was lowered below the watch time',
      watching(600),
      playback(0, 5_000, 0),
      ok([
        { type: 'WatchTimeRecorded', seconds: s(0) },
        { type: 'BreakStarted', exercise: pushups, at: t(5_000) },
      ]),
    ],
    [
      'never picks the previous exercise for the next break',
      watching(119, 'pushups'),
      playback(1, 5_000, 0),
      ok([
        { type: 'WatchTimeRecorded', seconds: s(1) },
        { type: 'BreakStarted', exercise: squats, at: t(5_000) },
      ]),
    ],
    [
      'blocks playback during a break instead of recording watch time',
      onBreak(0),
      playback(1, 3_000),
      ok([{ type: 'PlaybackBlocked' }]),
    ],
    [
      'rejects an acknowledgement when there is no break',
      watching(10),
      acknowledge(1_000),
      err('NoActiveBreak'),
    ],
    [
      'rejects an acknowledgement before the minimum break length',
      onBreak(1_000),
      acknowledge(10_999),
      err('BreakTooShort'),
    ],
    [
      'completes the break once the minimum break length has passed',
      onBreak(1_000),
      acknowledge(11_000),
      ok([{ type: 'BreakCompleted' }]),
    ],
  ])('%s', (_, session, command, expected) => {
    expect(decide(policy, session, command)).toEqual(expected);
  });
});

describe('evolve', () => {
  it.each<[string, WatchSession, DomainEvent, WatchSession]>([
    [
      'adds recorded watch time while watching',
      watching(10),
      { type: 'WatchTimeRecorded', seconds: s(1) },
      watching(11),
    ],
    [
      'ignores watch time while on break',
      onBreak(0),
      { type: 'WatchTimeRecorded', seconds: s(1) },
      onBreak(0),
    ],
    [
      'enters the break with its exercise',
      watching(120),
      { type: 'BreakStarted', exercise: squats, at: t(9_000) },
      onBreak(9_000, squats),
    ],
    [
      'leaves the session alone when playback is blocked',
      onBreak(0),
      { type: 'PlaybackBlocked' },
      onBreak(0),
    ],
    [
      'returns to watching with zero watch time and remembers the exercise',
      onBreak(0, squats),
      { type: 'BreakCompleted' },
      watching(0, 'squats'),
    ],
    [
      'ignores a completion when not on break',
      watching(5),
      { type: 'BreakCompleted' },
      watching(5),
    ],
  ])('%s', (_, session, event, expected) => {
    expect(evolve(session, event)).toEqual(expected);
  });
});

describe('a full cycle', () => {
  const run = (session: WatchSession, command: Command): WatchSession => {
    const result = decide(policy, session, command);
    return result.ok ? result.value.reduce(evolve, session) : session;
  };

  it('watches, breaks, completes and starts the next cycle from zero', () => {
    const ticks = Array.from({ length: 120 }, (_, i) => playback(1, i * 1_000, 0));
    const afterWatching = ticks.reduce(run, initialSession);
    expect(afterWatching).toEqual(onBreak(119_000, pushups));

    const tooEarly = run(afterWatching, acknowledge(120_000));
    expect(tooEarly).toEqual(afterWatching);

    const afterBreak = run(afterWatching, acknowledge(129_000));
    expect(afterBreak).toEqual(watching(0, 'pushups'));

    const secondBreak = ticks.reduce(run, afterBreak);
    expect(secondBreak).toMatchObject({ status: 'onBreak', exercise: squats });
  });
});
