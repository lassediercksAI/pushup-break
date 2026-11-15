import type { Effect } from '../application/effects';
import type { Overlay, VideoPlayer } from '../application/ports';

export type EffectPorts = {
  readonly player: VideoPlayer;
  readonly overlay: Overlay;
};

/** The interpreter: the one place where effects described as data turn into port calls. */
export const runEffects =
  ({ player, overlay }: EffectPorts) =>
  (effects: readonly Effect[]): void => {
    effects.forEach((effect) => {
      switch (effect.type) {
        case 'PauseVideo':
          player.pause();
          return;
        case 'ResumeVideo':
          player.resume();
          return;
        case 'ShowOverlay':
          overlay.show(effect.exercise, effect.unlockAt);
          return;
        case 'HideOverlay':
          overlay.hide();
          return;
      }
    });
  };
