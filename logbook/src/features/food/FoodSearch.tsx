import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Food } from '../../db/types';
import { rankFoods } from '../../lib/parser';
import { OfflineError, searchOFF } from '../../lib/off';
import { useT } from '../../lib/i18n';
import { toggleFavorite } from '../../db/actions';
import { Button, IconButton } from '../../components/ui';
import { EmptyNote, FoodRow, SearchInput, SectionTitle } from './parts';

type OffState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; results: Food[] } | { status: 'error'; message: string };

/** Search my foods first, then Open Food Facts on request, then manual entry. */
export function FoodSearch({
  onPick,
  onCreate,
  header,
}: {
  onPick: (f: Food) => void;
  onCreate: (name: string) => void;
  header?: React.ReactNode;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const [off, setOff] = useState<OffState>({ status: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];

  useEffect(() => {
    abort.current?.abort();
    setOff({ status: 'idle' });
  }, [q]);

  const local = useMemo(() => (q.trim() ? rankFoods(q, foods, 30).map((r) => r.food) : []), [q, foods]);
  const favorites = useMemo(() => foods.filter((f) => f.favorite).sort((a, b) => a.name.localeCompare(b.name)), [foods]);
  const recent = useMemo(
    () => foods.filter((f) => f.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)).slice(0, 12),
    [foods],
  );
  const all = useMemo(() => [...foods].sort((a, b) => a.name.localeCompare(b.name)), [foods]);

  async function runOFF() {
    const query = q.trim();
    if (query.length < 2) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setOff({ status: 'loading' });
    try {
      const results = await searchOFF(query, ctrl.signal);
      const mine = new Set(foods.map((f) => f.id));
      setOff({ status: 'done', results: results.filter((r) => !mine.has(r.id)) });
    } catch (e) {
      if (ctrl.signal.aborted && !(e instanceof OfflineError)) return;
      setOff({
        status: 'error',
        message: e instanceof OfflineError ? t('Offline. Open Food Facts search needs a connection.') : t('Could not reach Open Food Facts'),
      });
    }
  }

  const star = (f: Food) => (
    <IconButton icon="star" label="Favorite" active={!!f.favorite} onClick={() => toggleFavorite(f)} className="-mr-3" />
  );

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 bg-card px-5 pb-3">
        <SearchInput value={q} onChange={setQ} onSubmit={runOFF} placeholder={t('Search my foods')} />
      </div>
      {header}
      {q.trim() ? (
        <>
          <SectionTitle>{t('My foods')}</SectionTitle>
          {local.length ? local.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} right={star(f)} />) : <EmptyNote>—</EmptyNote>}
          <div className="mt-4 space-y-2">
            {off.status === 'idle' && (
              <Button icon="search" className="w-full" onClick={runOFF}>
                {t('Search Open Food Facts')}
              </Button>
            )}
            {off.status === 'loading' && <EmptyNote>{t('Searching…')}</EmptyNote>}
            {off.status === 'error' && <EmptyNote>{off.message}</EmptyNote>}
          </div>
          {off.status === 'done' && (
            <>
              <SectionTitle>Open Food Facts</SectionTitle>
              {off.results.length ? (
                off.results.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)
              ) : (
                <EmptyNote>{t('No results online')}</EmptyNote>
              )}
            </>
          )}
          <Button icon="edit" variant="ghost" className="mt-3 w-full" onClick={() => onCreate(q.trim())}>
            {t('Create food')} “{q.trim()}”
          </Button>
        </>
      ) : (
        <>
          {favorites.length > 0 && (
            <>
              <SectionTitle>{t('Favorites')}</SectionTitle>
              {favorites.map((f) => (
                <FoodRow key={f.id} food={f} onClick={() => onPick(f)} right={star(f)} />
              ))}
            </>
          )}
          {recent.length > 0 && (
            <>
              <SectionTitle>{t('Recent')}</SectionTitle>
              {recent.map((f) => (
                <FoodRow key={f.id} food={f} onClick={() => onPick(f)} right={star(f)} />
              ))}
            </>
          )}
          <SectionTitle>{t('My foods')}</SectionTitle>
          {all.map((f) => (
            <FoodRow key={f.id} food={f} onClick={() => onPick(f)} right={star(f)} />
          ))}
        </>
      )}
    </div>
  );
}
