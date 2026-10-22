import { db } from './index';

export const BACKUP_APP = 'logbook';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: string;
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** Every table in the database, including ones added by later versions. */
export async function exportAll(): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  for (const t of db.tables) tables[t.name] = await Promise.all((await t.toArray()).map(encodeRow));
  await db.meta.put({ key: 'lastBackupAt', value: Date.now() });
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  imported: Record<string, number>;
  skipped: string[];
}

/**
 * Imports a backup. 'merge' upserts rows by id (nothing is deleted); 'replace' clears
 * the matching tables first. Unknown tables are reported, not dropped silently.
 */
export async function importBackup(raw: unknown, mode: 'merge' | 'replace' = 'merge'): Promise<ImportResult> {
  if (!raw || typeof raw !== 'object') throw new Error('Not a backup file');
  const data = raw as Partial<Backup>;
  const tables = data.tables && typeof data.tables === 'object' ? data.tables : (raw as Record<string, unknown[]>);
  const known = new Map(db.tables.map((t) => [t.name, t]));
  const imported: Record<string, number> = {};
  const skipped: string[] = [];
  const usable = Object.entries(tables).filter(([name, rows]) => {
    if (!known.has(name) || !Array.isArray(rows)) {
      skipped.push(name);
      return false;
    }
    return true;
  });
  if (usable.length === 0) throw new Error('No Logbook data found in this file');
  await db.transaction(
    'rw',
    usable.map(([n]) => known.get(n)!),
    async () => {
      for (const [name, rows] of usable) {
        const t = known.get(name)!;
        if (mode === 'replace') await t.clear();
        await t.bulkPut((await Promise.all(rows.map(decodeRow))) as never[]);
        imported[name] = rows.length;
      }
    },
  );
  return { imported, skipped };
}

/* Blobs (progress photos) travel as base64 so the backup stays plain JSON. */

async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function encodeRow(row: unknown): Promise<unknown> {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Blob ? { __blob: await blobToBase64(v), type: v.type } : v;
  return out;
}

async function decodeRow(row: unknown): Promise<unknown> {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const b = v as { __blob?: string; type?: string } | null;
    out[k] = b && typeof b === 'object' && typeof b.__blob === 'string' ? base64ToBlob(b.__blob, b.type ?? 'image/jpeg') : v;
  }
  return out;
}
