import { err, ok, type Result } from './result';

/**
 * Branded numbers. A brand can only be obtained through the smart
 * constructors below, so a `WatchInterval` in hand is always 2 to 30 whole
 * minutes, a `Roll` always lies in [0, 1), and so on.
 */
export type Seconds = number & { readonly __brand: 'Seconds' };
export type Reps = number & { readonly __brand: 'Reps' };
export type Instant = number & { readonly __brand: 'Instant' }; // epoch ms
export type WatchInterval = number & { readonly __brand: 'WatchInterval' }; // whole minutes
export type Roll = number & { readonly __brand: 'Roll' }; // [0, 1)

export type ValueError =
  'InvalidSeconds' | 'InvalidReps' | 'InvalidInstant' | 'InvalidWatchInterval' | 'InvalidRoll';

export const MIN_WATCH_INTERVAL = 2;
export const MAX_WATCH_INTERVAL = 30;
export const DEFAULT_WATCH_INTERVAL = 20;

const isNonNegativeFinite = (n: number): boolean => Number.isFinite(n) && n >= 0;

/** A non-negative, finite number of seconds. */
export const seconds = (n: number): Result<Seconds, ValueError> =>
  isNonNegativeFinite(n) ? ok(n as Seconds) : err('InvalidSeconds');

/** A whole number of repetitions, at least 1. */
export const reps = (n: number): Result<Reps, ValueError> =>
  Number.isInteger(n) && n >= 1 ? ok(n as Reps) : err('InvalidReps');

/** A point in time as non-negative epoch milliseconds. */
export const instant = (n: number): Result<Instant, ValueError> =>
  isNonNegativeFinite(n) ? ok(n as Instant) : err('InvalidInstant');

/** Whole minutes from 2 to 30. */
export const watchInterval = (n: number): Result<WatchInterval, ValueError> =>
  Number.isInteger(n) && n >= MIN_WATCH_INTERVAL && n <= MAX_WATCH_INTERVAL
    ? ok(n as WatchInterval)
    : err('InvalidWatchInterval');

/** A random number in [0, 1). */
export const roll = (n: number): Result<Roll, ValueError> =>
  Number.isFinite(n) && n >= 0 && n < 1 ? ok(n as Roll) : err('InvalidRoll');

export const ZERO_SECONDS = 0 as Seconds;

export const addSeconds = (a: Seconds, b: Seconds): Seconds => (a + b) as Seconds;

/** The time left until `limit`, never negative. */
export const remaining = (watched: Seconds, limit: Seconds): Seconds =>
  Math.max(0, limit - watched) as Seconds;

export const intervalSeconds = (interval: WatchInterval): Seconds => (interval * 60) as Seconds;

/** Seconds from `from` to `to`; negative spans (a clock going backwards) count as zero. */
export const elapsed = (from: Instant, to: Instant): Seconds =>
  Math.max(0, (to - from) / 1000) as Seconds;

export const later = (at: Instant, by: Seconds): Instant => (at + by * 1000) as Instant;
