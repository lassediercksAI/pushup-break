import { expect, it } from 'vitest';
import type { Effect } from '../application/effects';
import { defaultCatalog, type Exercise } from '../domain/exercise';
import type { Instant } from '../domain/values';
import { runEffects } from './run-effects';

it('turns each effect into the matching port call, in order', () => {
  const calls: string[] = [];
  const run = runEffects({
    player: {
      pause: () => calls.push('pause'),
      resume: () => calls.push('resume'),
    },
    overlay: {
      show: (exercise: Exercise, unlockAt: Instant) =>
        calls.push(`show ${exercise.id} ${unlockAt}`),
      hide: () => calls.push('hide'),
    },
  });
  const effects: readonly Effect[] = [
    { type: 'PauseVideo' },
    { type: 'ShowOverlay', exercise: defaultCatalog[0], unlockAt: 10_000 as Instant },
    { type: 'HideOverlay' },
    { type: 'ResumeVideo' },
  ];

  run(effects);

  expect(calls).toEqual(['pause', 'show pushups 10000', 'hide', 'resume']);
});
