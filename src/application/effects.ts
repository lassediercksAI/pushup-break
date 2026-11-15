import type { BreakPolicy } from '../domain/break-policy';
import type { Exercise } from '../domain/exercise';
import { later, type Instant } from '../domain/values';
import type { DomainEvent } from '../domain/watch-session';

/** Side effects described as data; `run-effects.ts` is the only place that executes them. */
export type Effect =
  | { readonly type: 'PauseVideo' }
  | { readonly type: 'ResumeVideo' }
  | { readonly type: 'ShowOverlay'; readonly exercise: Exercise; readonly unlockAt: Instant }
  | { readonly type: 'HideOverlay' };

/** What the shell should do in response to one domain event. */
export const react =
  (policy: BreakPolicy) =>
  (event: DomainEvent): readonly Effect[] => {
    switch (event.type) {
      case 'WatchTimeRecorded':
        return [];
      case 'BreakStarted':
        return [
          { type: 'PauseVideo' },
          {
            type: 'ShowOverlay',
            exercise: event.exercise,
            unlockAt: later(event.at, policy.minBreak),
          },
        ];
      case 'PlaybackBlocked':
        return [{ type: 'PauseVideo' }];
      case 'BreakCompleted':
        return [{ type: 'HideOverlay' }, { type: 'ResumeVideo' }];
    }
  };
