import { err, ok, type Result } from './result';
import type { Reps, Roll, Seconds } from './values';

export type Amount =
  | { readonly kind: 'reps'; readonly count: Reps }
  | { readonly kind: 'hold'; readonly duration: Seconds };

export type ExerciseId =
  | 'pushups'
  | 'squats'
  | 'lunges'
  | 'situps'
  | 'burpees'
  | 'jumpingJacks'
  | 'mountainClimbers'
  | 'highKnees'
  | 'gluteBridges'
  | 'plank';

export type Exercise = {
  readonly id: ExerciseId;
  readonly name: string;
  readonly amount: Amount;
};

/** The exercises a break can ask for. Never empty. */
export type ExerciseCatalog = readonly [Exercise, ...Exercise[]];

const isNonEmpty = <T>(items: readonly T[]): items is readonly [T, ...T[]] => items.length > 0;

/** Smart constructor: a catalog needs at least one exercise. */
export const exerciseCatalog = (
  exercises: readonly Exercise[],
): Result<ExerciseCatalog, 'EmptyCatalog'> =>
  isNonEmpty(exercises) ? ok(exercises) : err('EmptyCatalog');

// The literals below are checked against the smart constructors in exercise.test.ts.
const doReps = (id: ExerciseId, name: string, count: number): Exercise => ({
  id,
  name,
  amount: { kind: 'reps', count: count as Reps },
});

const hold = (id: ExerciseId, name: string, duration: number): Exercise => ({
  id,
  name,
  amount: { kind: 'hold', duration: duration as Seconds },
});

/** The built-in catalog: common exercises that need no equipment and take well under a minute. */
export const defaultCatalog: ExerciseCatalog = [
  doReps('pushups', 'Pushups', 5),
  doReps('squats', 'Squats', 10),
  doReps('lunges', 'Lunges (5 per leg)', 10),
  doReps('situps', 'Sit-ups', 10),
  doReps('burpees', 'Burpees', 5),
  doReps('jumpingJacks', 'Jumping jacks', 20),
  doReps('mountainClimbers', 'Mountain climbers', 20),
  doReps('highKnees', 'High knees', 20),
  doReps('gluteBridges', 'Glute bridges', 10),
  hold('plank', 'Plank', 30),
];

/**
 * Picks an exercise at random, never the previous one when the catalog has
 * more than one entry. `roll` in [0, 1) selects among the candidates.
 */
export const pickExercise = (
  catalog: ExerciseCatalog,
  last: ExerciseId | null,
  roll: Roll,
): Exercise => {
  const others = catalog.filter((exercise) => exercise.id !== last);
  const pool: ExerciseCatalog = isNonEmpty(others) ? others : catalog;
  // A valid Roll always lands inside the pool; the fallback only guards a forged one.
  return pool[Math.floor(roll * pool.length)] ?? pool[0];
};

/** The instruction shown to the viewer, e.g. "Do 5 pushups" or "Hold a 30-second plank". */
export const describeExercise = ({ name, amount }: Exercise): string => {
  switch (amount.kind) {
    case 'reps':
      return `Do ${amount.count} ${name.toLowerCase()}`;
    case 'hold':
      return `Hold a ${amount.duration}-second ${name.toLowerCase()}`;
  }
};
