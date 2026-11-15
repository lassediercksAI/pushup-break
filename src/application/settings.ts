import { defaultPolicy, withWatchInterval, type BreakPolicy } from '../domain/break-policy';
import { map, getOrElse } from '../domain/result';
import { watchInterval, type WatchInterval } from '../domain/values';

/** The shape written to browser storage. */
export type StoredSettings = { readonly watchIntervalMinutes: number };

export const SETTINGS_KEY = 'settings';

const readMinutes = (raw: unknown): unknown =>
  typeof raw === 'object' && raw !== null && 'watchIntervalMinutes' in raw
    ? raw.watchIntervalMinutes
    : undefined;

/**
 * Anti-corruption layer at the storage boundary: anything stored is
 * `unknown` and only becomes a policy through the domain's smart
 * constructors. Missing or invalid input falls back to the default.
 */
export const parseSettings = (raw: unknown): BreakPolicy => {
  const minutes = readMinutes(raw);
  return typeof minutes === 'number'
    ? getOrElse(
        map(watchInterval(minutes), (interval) => withWatchInterval(defaultPolicy, interval)),
        defaultPolicy,
      )
    : defaultPolicy;
};

export const toStoredSettings = (interval: WatchInterval): StoredSettings => ({
  watchIntervalMinutes: interval,
});
