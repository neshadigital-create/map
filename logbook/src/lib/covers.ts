import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { resize } from '../db/progress';
import { normalize } from './parser';

/** Same cover for every day with the same name (e.g. both "Lower Body" days, across phases). */
export const dayCoverId = (name: string) => `day:${normalize(name)}`;
export const exerciseCoverId = (exerciseId: string) => `ex:${exerciseId}`;

export async function setCover(id: string, file: File) {
  const image = await resize(file, 1400, 0.82);
  await db.covers.put({ id, image, at: Date.now() });
}

export async function removeCover(id: string) {
  await db.covers.delete(id);
}

/** Object URL for a cover photo, or undefined when none is set. */
export function useCover(id: string | undefined): string | undefined {
  const cover = useLiveQuery(async () => (id ? db.covers.get(id) : undefined), [id]);
  const url = useMemo(() => (cover ? URL.createObjectURL(cover.image) : undefined), [cover]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}
