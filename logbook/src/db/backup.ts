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
  for (const t of db.tables) tables[t.name] = await t.toArray();
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
        await t.bulkPut(rows as never[]);
        imported[name] = rows.length;
      }
    },
  );
  return { imported, skipped };
}
