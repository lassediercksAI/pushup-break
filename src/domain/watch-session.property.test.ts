import fc from 'fast-check';
import { describe, it } from 'vitest';
import { defaultPolicy, withWatchInterval, type BreakPolicy } from './break-policy';
import { defaultCatalog, type ExerciseCatalog } from './exercise';
import {
  intervalSeconds,
  MAX_WATCH_INTERVAL,
  MIN_WATCH_INTERVAL,
  type Instant,
  type Roll,
  type Seconds,
  type WatchInterval,
} from './values';
import { decide, evolve, initialSession, type Command, type WatchSession } from './watch-session';

/** A command shape without a timestamp; time is added as a running clock. */
type Step =
  | { readonly type: 'play'; readonly seconds: number; readonly roll: number }
  | { readonly type: 'ack'; readonly afterSeconds: number };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      type: fc.constant('play' as const),
      seconds: fc.double({ min: 0, max: 90, noNaN: true }),
      roll: fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('ack' as const),
      afterSeconds: fc.double({ min: 0, max: 30, noNaN: true }),
    }),
  },
);

const policyArb: fc.Arbitrary<BreakPolicy> = fc
  .tuple(
    fc.integer({ min: MIN_WATCH_INTERVAL, max: MAX_WATCH_INTERVAL }),
    fc.subarray([...defaultCatalog], { minLength: 1 }),
  )
  .map(([minutes, exercises]) => ({
    ...withWatchInterval(defaultPolicy, minutes as WatchInterval),
    catalog: exercises as unknown as ExerciseCatalog,
  }));

type Trace = {
  readonly states: readonly WatchSession[];
  readonly times: readonly number[];
  readonly policy: BreakPolicy;
};

const simulate = (policy: BreakPolicy, steps: readonly Step[]): Trace => {
  const start = { session: initialSession, now: 0, states: [initialSession], times: [0] };
  const end = steps.reduce((acc, step) => {
    const now = acc.now + (step.type === 'play' ? step.seconds : step.afterSeconds) * 1000;
    const command: Command =
      step.type === 'play'
        ? {
            type: 'RecordPlayback',
            seconds: step.seconds as Seconds,
            at: now as Instant,
            roll: step.roll as Roll,
          }
        : { type: 'AcknowledgeBreak', at: now as Instant };
    const result = decide(policy, acc.session, command);
    const session = result.ok ? result.value.reduce(evolve, acc.session) : acc.session;
    return { session, now, states: [...acc.states, session], times: [...acc.times, now] };
  }, start);
  return { states: end.states, times: end.times, policy };
};

const traceArb = fc
  .tuple(policyArb, fc.array(stepArb, { maxLength: 200 }))
  .map(([policy, steps]) => simulate(policy, steps));

describe('watch session properties', () => {
  it('watch time never exceeds the watch interval', () => {
    fc.assert(
      fc.property(traceArb, ({ states, policy }) => {
        const limit = intervalSeconds(policy.watchInterval);
        return states.every((s) => s.status !== 'watching' || s.watched <= limit + 1e-9);
      }),
    );
  });

  it('no exercise repeats back to back when the catalog has a choice', () => {
    fc.assert(
      fc.property(traceArb, ({ states, policy }) => {
        const exercises = states.flatMap((s, i) =>
          s.status === 'onBreak' && states[i - 1]?.status === 'watching' ? [s.exercise.id] : [],
        );
        return (
          policy.catalog.length === 1 ||
          exercises.every((id, i) => i === 0 || id !== exercises[i - 1])
        );
      }),
    );
  });

  it('the session is always a valid state', () => {
    fc.assert(
      fc.property(traceArb, ({ states, policy }) => {
        const ids = new Set(policy.catalog.map((e) => e.id));
        return states.every((s) =>
          s.status === 'watching'
            ? Number.isFinite(s.watched) &&
              s.watched >= 0 &&
              (s.lastExercise === null || ids.has(s.lastExercise))
            : ids.has(s.exercise.id) && Number.isFinite(s.startedAt),
        );
      }),
    );
  });

  it('a break ends only after the minimum break length has passed', () => {
    fc.assert(
      fc.property(traceArb, ({ states, times, policy }) =>
        states.every((s, i) => {
          const before = states[i - 1];
          const endsBreak = before?.status === 'onBreak' && s.status === 'watching';
          return !endsBreak || (times[i] ?? 0) - before.startedAt >= policy.minBreak * 1000;
        }),
      ),
    );
  });

  it('every break asks for an exercise from the catalog', () => {
    fc.assert(
      fc.property(traceArb, ({ states, policy }) => {
        const ids = new Set(policy.catalog.map((e) => e.id));
        return states.every((s) => s.status === 'watching' || ids.has(s.exercise.id));
      }),
    );
  });
});
