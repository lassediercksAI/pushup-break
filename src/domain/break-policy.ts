import { defaultCatalog, type ExerciseCatalog } from './exercise';
import { DEFAULT_WATCH_INTERVAL, type Seconds, type WatchInterval } from './values';

/** When a break is due and when it may end. */
export type BreakPolicy = {
  readonly watchInterval: WatchInterval;
  readonly minBreak: Seconds;
  readonly catalog: ExerciseCatalog;
};

export const DEFAULT_MIN_BREAK = 10 as Seconds;

export const defaultPolicy: BreakPolicy = {
  watchInterval: DEFAULT_WATCH_INTERVAL as WatchInterval,
  minBreak: DEFAULT_MIN_BREAK,
  catalog: defaultCatalog,
};

/** The same policy with a different watch interval. */
export const withWatchInterval = (
  policy: BreakPolicy,
  watchInterval: WatchInterval,
): BreakPolicy => ({ ...policy, watchInterval });
