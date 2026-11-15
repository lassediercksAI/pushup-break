import type { BreakPolicy } from './break-policy';
import { pickExercise, type Exercise, type ExerciseId } from './exercise';
import { err, ok, type Result } from './result';
import {
  addSeconds,
  elapsed,
  intervalSeconds,
  remaining,
  ZERO_SECONDS,
  type Instant,
  type Roll,
  type Seconds,
} from './values';

/** One tab's state: watching (with its watch time) or on break. */
export type WatchSession =
  | {
      readonly status: 'watching';
      readonly watched: Seconds;
      readonly lastExercise: ExerciseId | null;
    }
  | {
      readonly status: 'onBreak';
      readonly exercise: Exercise;
      readonly startedAt: Instant;
    };

export type Command =
  | {
      readonly type: 'RecordPlayback';
      readonly seconds: Seconds;
      readonly at: Instant;
      readonly roll: Roll;
    }
  | { readonly type: 'AcknowledgeBreak'; readonly at: Instant };

export type DomainEvent =
  | { readonly type: 'WatchTimeRecorded'; readonly seconds: Seconds }
  | { readonly type: 'BreakStarted'; readonly exercise: Exercise; readonly at: Instant }
  | { readonly type: 'PlaybackBlocked' }
  | { readonly type: 'BreakCompleted' };

export type Rejection = 'NoActiveBreak' | 'BreakTooShort';

/** A fresh tab: no watch time yet and no previous exercise. */
export const initialSession: WatchSession = {
  status: 'watching',
  watched: ZERO_SECONDS,
  lastExercise: null,
};

const recordPlayback = (
  policy: BreakPolicy,
  session: WatchSession,
  command: Extract<Command, { type: 'RecordPlayback' }>,
): readonly DomainEvent[] => {
  switch (session.status) {
    case 'onBreak':
      return [{ type: 'PlaybackBlocked' }];
    case 'watching': {
      const limit = intervalSeconds(policy.watchInterval);
      const left = remaining(session.watched, limit);
      return command.seconds < left
        ? [{ type: 'WatchTimeRecorded', seconds: command.seconds }]
        : [
            { type: 'WatchTimeRecorded', seconds: left },
            {
              type: 'BreakStarted',
              exercise: pickExercise(policy.catalog, session.lastExercise, command.roll),
              at: command.at,
            },
          ];
    }
  }
};

const acknowledgeBreak = (
  policy: BreakPolicy,
  session: WatchSession,
  command: Extract<Command, { type: 'AcknowledgeBreak' }>,
): Result<readonly DomainEvent[], Rejection> => {
  switch (session.status) {
    case 'watching':
      return err('NoActiveBreak');
    case 'onBreak':
      return elapsed(session.startedAt, command.at) >= policy.minBreak
        ? ok([{ type: 'BreakCompleted' }])
        : err('BreakTooShort');
  }
};

/** Validates a command against the current session and returns what happened. */
export const decide = (
  policy: BreakPolicy,
  session: WatchSession,
  command: Command,
): Result<readonly DomainEvent[], Rejection> => {
  switch (command.type) {
    case 'RecordPlayback':
      return ok(recordPlayback(policy, session, command));
    case 'AcknowledgeBreak':
      return acknowledgeBreak(policy, session, command);
  }
};

/** Folds one event into the next session state. */
export const evolve = (session: WatchSession, event: DomainEvent): WatchSession => {
  switch (event.type) {
    case 'WatchTimeRecorded':
      return session.status === 'watching'
        ? { ...session, watched: addSeconds(session.watched, event.seconds) }
        : session;
    case 'BreakStarted':
      return { status: 'onBreak', exercise: event.exercise, startedAt: event.at };
    case 'PlaybackBlocked':
      return session;
    case 'BreakCompleted':
      return session.status === 'onBreak'
        ? { status: 'watching', watched: ZERO_SECONDS, lastExercise: session.exercise.id }
        : session;
  }
};
