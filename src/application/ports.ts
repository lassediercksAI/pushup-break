import type { Exercise } from '../domain/exercise';
import type { Instant, Roll } from '../domain/values';

/**
 * Ports are plain function types. The entrypoint passes the adapters in as
 * arguments; there is no container.
 */
export type PauseVideo = () => void;
export type ResumeVideo = () => void;

export type VideoPlayer = {
  readonly pause: PauseVideo;
  readonly resume: ResumeVideo;
};

export type ShowOverlay = (exercise: Exercise, unlockAt: Instant) => void;
export type HideOverlay = () => void;

export type Overlay = {
  readonly show: ShowOverlay;
  readonly hide: HideOverlay;
};

export type Unsubscribe = () => void;

/** Raw stored settings are `unknown` until `parseSettings` has looked at them. */
export type SettingsStore = {
  readonly load: () => Promise<unknown>;
  readonly save: (settings: unknown) => Promise<void>;
  readonly subscribe: (listener: (settings: unknown) => void) => Unsubscribe;
};

export type Clock = () => Instant;
export type Random = () => Roll;
