import { describe, expect, it } from 'vitest';
import { defaultPolicy, withWatchInterval } from '../domain/break-policy';
import { defaultCatalog } from '../domain/exercise';
import { err, type Result } from '../domain/result';
import type { Instant, Roll, Seconds, WatchInterval } from '../domain/values';
import { initialSession, type Command, type WatchSession } from '../domain/watch-session';
import { step, type StepOutcome } from './break-workflow';
import type { Effect } from './effects';

const policy = withWatchInterval(defaultPolicy, 2 as WatchInterval);
const [pushups] = defaultCatalog;
const squats = defaultCatalog[1] ?? pushups;

const tick = (at: number, roll = 0): Command => ({
  type: 'RecordPlayback',
  seconds: 1 as Seconds,
  at: at as Instant,
  roll: roll as Roll,
});
const done = (at: number): Command => ({ type: 'AcknowledgeBreak', at: at as Instant });

type Run = { readonly session: WatchSession; readonly effects: readonly Effect[] };

/** Runs commands through `step`, collecting every effect; rejected commands change nothing. */
const runAll = (session: WatchSession, commands: readonly Command[]): Run =>
  commands.reduce<Run>(
    (acc, command) => {
      const result: Result<StepOutcome, unknown> = step(policy, acc.session, command);
      return result.ok
        ? { session: result.value.session, effects: [...acc.effects, ...result.value.effects] }
        : acc;
    },
    { session, effects: [] },
  );

const watchFor = (seconds: number, from: number): readonly Command[] =>
  Array.from({ length: seconds }, (_, i) => tick(from + i * 1_000));

describe('step', () => {
  it('runs a full cycle and starts the second one', () => {
    const firstWatch = runAll(initialSession, watchFor(120, 0));
    expect(firstWatch.session).toEqual({
      status: 'onBreak',
      exercise: pushups,
      startedAt: 119_000,
    });
    expect(firstWatch.effects).toEqual([
      { type: 'PauseVideo' },
      { type: 'ShowOverlay', exercise: pushups, unlockAt: 129_000 },
    ]);

    const blocked = runAll(firstWatch.session, [tick(120_000)]);
    expect(blocked).toEqual({ session: firstWatch.session, effects: [{ type: 'PauseVideo' }] });

    const acknowledged = runAll(blocked.session, [done(129_000)]);
    expect(acknowledged).toEqual({
      session: { status: 'watching', watched: 0, lastExercise: 'pushups' },
      effects: [{ type: 'HideOverlay' }, { type: 'ResumeVideo' }],
    });

    const secondWatch = runAll(acknowledged.session, watchFor(120, 130_000));
    expect(secondWatch.session).toEqual({
      status: 'onBreak',
      exercise: squats,
      startedAt: 249_000,
    });
    expect(secondWatch.effects).toEqual([
      { type: 'PauseVideo' },
      { type: 'ShowOverlay', exercise: squats, unlockAt: 259_000 },
    ]);
  });

  it('passes a rejection through without a new session or effects', () => {
    const onBreak: WatchSession = { status: 'onBreak', exercise: pushups, startedAt: 0 as Instant };
    expect(step(policy, onBreak, done(9_999))).toEqual(err('BreakTooShort'));
    expect(step(policy, initialSession, done(0))).toEqual(err('NoActiveBreak'));
  });
});
