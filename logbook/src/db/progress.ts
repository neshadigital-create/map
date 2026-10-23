import { db } from './index';
import type { Measurement } from './types';
import { uid } from '../lib/id';
import { updateSettings } from './actions';

/** Logs a weigh-in and keeps the profile weight current (targets follow if auto). */
export async function addWeight(day: string, kg: number) {
  await db.weights.add({ id: uid(), day, kg, at: Date.now() });
  const latest = await db.weights.orderBy('day').last();
  if (latest && latest.day === day) await updateSettings({ weightKg: kg });
}

export async function deleteWeight(id: string) {
  await db.weights.delete(id);
}

export async function saveMeasurement(m: Omit<Measurement, 'id' | 'at'> & { id?: string }) {
  await db.measurements.put({ ...m, id: m.id ?? uid(), at: Date.now() });
}

export async function deleteMeasurement(id: string) {
  await db.measurements.delete(id);
}

export async function resize(file: Blob, max: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', quality));
}

/** Stores a progress photo on this device only, downscaled to keep storage small. */
export async function addPhoto(day: string, file: File) {
  const [image, thumb] = await Promise.all([resize(file, 1600, 0.85), resize(file, 360, 0.75)]);
  await db.photos.add({ id: uid(), day, image, thumb, at: Date.now() });
}

export async function deletePhoto(id: string) {
  await db.photos.delete(id);
}
