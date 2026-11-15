import { describe, expect, it } from 'vitest';
import {
  defaultCatalog,
  describeExercise,
  exerciseCatalog,
  pickExercise,
  type Exercise,
  type ExerciseCatalog,
} from './exercise';
import { err, ok } from './result';
import { reps, seconds, type Roll } from './values';

const r = (n: number) => n as Roll;
const nth = (i: number): Exercise => defaultCatalog[i] ?? defaultCatalog[0];
const [pushups, squats, lunges] = [nth(0), nth(1), nth(2)];

describe('default catalog', () => {
  it('has the 10 exercises from the plan, each once', () => {
    expect(defaultCatalog.map((e) => e.id)).toEqual([
      'pushups',
      'squats',
      'lunges',
      'situps',
      'burpees',
      'jumpingJacks',
      'mountainClimbers',
      'highKnees',
      'gluteBridges',
      'plank',
    ]);
  });

  it('only holds amounts the smart constructors accept', () => {
    for (const { amount } of defaultCatalog) {
      const checked = amount.kind === 'reps' ? reps(amount.count) : seconds(amount.duration);
      expect(checked.ok).toBe(true);
    }
  });
});

describe('exerciseCatalog', () => {
  it('rejects an empty list', () => {
    expect(exerciseCatalog([])).toEqual(err('EmptyCatalog'));
  });

  it('accepts a non-empty list', () => {
    expect(exerciseCatalog([pushups])).toEqual(ok([pushups]));
  });
});

describe('pickExercise', () => {
  const three: ExerciseCatalog = [pushups, squats, lunges];

  it('picks across the range of the roll', () => {
    expect(pickExercise(three, null, r(0))).toBe(pushups);
    expect(pickExercise(three, null, r(0.5))).toBe(squats);
    expect(pickExercise(three, null, r(0.999999))).toBe(lunges);
  });

  it('never repeats the previous exercise when there is a choice', () => {
    expect(pickExercise(three, 'pushups', r(0))).toBe(squats);
    expect(pickExercise(three, 'pushups', r(0.999999))).toBe(lunges);
    expect(pickExercise(three, 'lunges', r(0.999999))).toBe(squats);
  });

  it('repeats the only exercise of a one-entry catalog', () => {
    expect(pickExercise([pushups], 'pushups', r(0.7))).toBe(pushups);
  });

  it('falls back to the first candidate for a forged out-of-range roll', () => {
    expect(pickExercise(three, null, r(1))).toBe(pushups);
  });
});

describe('describeExercise', () => {
  it('describes reps and holds', () => {
    expect(describeExercise(pushups)).toBe('Do 5 pushups');
    expect(describeExercise(lunges)).toBe('Do 10 lunges (5 per leg)');
    const plank = defaultCatalog.find((e) => e.id === 'plank') as Exercise;
    expect(describeExercise(plank)).toBe('Hold a 30-second plank');
  });
});
