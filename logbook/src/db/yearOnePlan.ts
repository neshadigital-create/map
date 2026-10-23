import type { Muscle } from './types';

/**
 * My Year One Challenge plan as written in the book (pages 181-182 and 225-226).
 * Hard sets are 8-10 reps (plank: held for time); deload sets are 3 x 5 at the last hard-set weight.
 */
export interface PlanExercise {
  name: string;
  muscle: Muscle;
  sets: number;
  reps: string;
  warmup?: boolean;
  note?: string;
  measure?: 'seconds';
}
export interface PlanDay {
  name: string;
  exercises: PlanExercise[];
}
export interface PlanBlock {
  name: string;
  kind: 'training' | 'deload';
  weeks: number;
  days: PlanDay[];
}

const LAST = 'with last hard set weight';
export const HARD_REPS = '8-10';
const d = (name: string, muscle: Muscle, warmup = false): PlanExercise => ({ name, muscle, sets: 3, reps: '5', warmup, note: LAST });
const h = (name: string, muscle: Muscle, warmup = false, extra: Partial<PlanExercise> = {}): PlanExercise => ({
  name,
  muscle,
  sets: 3,
  reps: extra.measure === 'seconds' ? '' : HARD_REPS,
  warmup,
  ...extra,
});

export const DELOAD_1: PlanBlock = {
  name: 'Deload 1',
  kind: 'deload',
  weeks: 1,
  days: [
    { name: 'Deload Legs', exercises: [d('Barbell Squat', 'quads', true), d('Romanian Deadlift', 'hamstrings'), d('Hip Thrust', 'glutes')] },
    { name: 'Deload Push', exercises: [d('Barbell Bench Press', 'chest', true), d('Seated Dumbbell Press', 'shoulders'), d('Dumbbell Side Lateral Raise', 'shoulders')] },
    { name: 'Deload Pull', exercises: [d('Barbell Deadlift', 'back', true), d('Barbell Row', 'back'), d('Lat Pulldown (Wide-Grip)', 'back')] },
  ],
};

export const PHASE_2: PlanBlock = {
  name: 'Phase 2',
  kind: 'training',
  weeks: 8,
  days: [
    {
      name: 'Lower Body (Legs and Glutes)',
      exercises: [
        h('Barbell Squat', 'quads', true),
        h('Dumbbell Lunge (In-Place)', 'quads'),
        h('Leg Curl (Lying or Seated)', 'hamstrings'),
        h('Dumbbell Step-Up', 'glutes'),
      ],
    },
    {
      name: 'Push and Core',
      exercises: [
        h('Barbell Bench Press', 'chest', true),
        h('Arnold Dumbbell Press', 'shoulders'),
        h('Dumbbell Bench Press', 'chest'),
        h('Barbell Rear Delt Row', 'shoulders'),
        h('Captain’s Chair Leg Raise', 'abs'),
      ],
    },
    {
      name: 'Pull',
      exercises: [
        h('Barbell Deadlift', 'back', true),
        h('Barbell Row', 'back'),
        h('Seated Cable Row (Wide-Grip)', 'back'),
        h('Dumbbell Hammer Curl', 'biceps'),
      ],
    },
    {
      name: 'Upper Body and Core',
      exercises: [
        h('Arnold Dumbbell Press', 'shoulders', true),
        h('Close-Grip Bench Press', 'triceps'),
        h('Dumbbell Side Lateral Raise', 'shoulders'),
        h('Lying Triceps Extension', 'triceps'),
        h('Plank', 'abs', false, { measure: 'seconds' }),
      ],
    },
    {
      name: 'Lower Body (Legs and Glutes)',
      exercises: [
        h('Barbell Front Squat', 'quads', true),
        h('Dumbbell Single-Leg Split Squat', 'quads'),
        h('Romanian Deadlift', 'hamstrings'),
        h('Hip Thrust', 'glutes'),
      ],
    },
  ],
};
