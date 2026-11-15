import { describe, expect, it } from 'vitest';
import { defaultPolicy } from '../domain/break-policy';
import { defaultCatalog } from '../domain/exercise';
import type { Instant, Seconds } from '../domain/values';
import type { DomainEvent } from '../domain/watch-session';
import { react, type Effect } from './effects';

const [pushups] = defaultCatalog;

describe('react', () => {
  it.each<[DomainEvent, readonly Effect[]]>([
    [{ type: 'WatchTimeRecorded', seconds: 1 as Seconds }, []],
    [
      { type: 'BreakStarted', exercise: pushups, at: 5_000 as Instant },
      [
        { type: 'PauseVideo' },
        { type: 'ShowOverlay', exercise: pushups, unlockAt: 15_000 as Instant },
      ],
    ],
    [{ type: 'PlaybackBlocked' }, [{ type: 'PauseVideo' }]],
    [{ type: 'BreakCompleted' }, [{ type: 'HideOverlay' }, { type: 'ResumeVideo' }]],
  ])('maps %j to its effects', (event, effects) => {
    expect(react(defaultPolicy)(event)).toEqual(effects);
  });
});
