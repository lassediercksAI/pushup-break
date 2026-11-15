import type { BreakPolicy } from '../domain/break-policy';
import { map, type Result } from '../domain/result';
import {
  decide,
  evolve,
  type Command,
  type Rejection,
  type WatchSession,
} from '../domain/watch-session';
import { react, type Effect } from './effects';

export type StepOutcome = {
  readonly session: WatchSession;
  readonly effects: readonly Effect[];
};

/**
 * One step of the workflow: decide, fold the events into the next session,
 * and translate them into effects for the shell to run.
 */
export const step = (
  policy: BreakPolicy,
  session: WatchSession,
  command: Command,
): Result<StepOutcome, Rejection> =>
  map(decide(policy, session, command), (events) => ({
    session: events.reduce(evolve, session),
    effects: events.flatMap(react(policy)),
  }));
