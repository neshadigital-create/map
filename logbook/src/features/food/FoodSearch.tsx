import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Food } from '../../db/types';
import { rankFoods } from '../../lib/parser';
import { OfflineError, searchOFF } from '../../lib/off';
import { loadCiqual } from '../../lib/ciqual';
import { useUI } from '../../store/ui';
import { useT } from '../../lib/i18n';
import { toggleFavorite } from '../../db/actions';
import { Button, IconButton } from '../../components/ui';
import { EmptyNote, FoodRow, SearchInput, SectionTitle } from './parts';

type OffState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; results: Food[] } | { status: 'error'; message: string };

/**
 * One search box, three sources in order: my foods, generic foods (CIQUAL, offline),
 * then packaged products from Open Food Facts (online, starts by itself after a pause).
 */
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
  const lang = useUI((st) => st.lang);
  const [generic, setGeneric] = useState<Food[]>([]);
  const [showAllGeneric, setShowAllGeneric] = useState(false);

  useEffect(() => {
    loadCiqual(lang).then(setGeneric);
  }, [lang]);

  // Open Food Facts runs on its own after a short pause in typing (3+ letters).
  useEffect(() => {
    abort.current?.abort();
    setOff({ status: 'idle' });
    setShowAllGeneric(false);
    if (q.trim().length < 3) return;
    const id = setTimeout(() => runOFF(), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const local = useMemo(() => (q.trim() ? rankFoods(q, foods, 30).map((r) => r.food) : []), [q, foods]);
  const mineIds = useMemo(() => new Set(foods.map((f) => f.id)), [foods]);
  const genericHits = useMemo(
    () => (q.trim().length >= 2 ? rankFoods(q, generic, 40).filter((r) => r.score >= 0.4 && !mineIds.has(r.food.id)).map((r) => r.food) : []),
    [q, generic, mineIds],
  );
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
        <SearchInput value={q} onChange={setQ} onSubmit={runOFF} placeholder={t('Search any food')} />
      </div>
      {header}
      {q.trim() ? (
        <>
          {local.length > 0 && (
            <>
              <SectionTitle>{t('My foods')}</SectionTitle>
              {local.slice(0, 8).map((f) => (
                <FoodRow key={f.id} food={f} onClick={() => onPick(f)} right={star(f)} />
              ))}
            </>
          )}
          {genericHits.length > 0 && (
            <>
              <SectionTitle right={<span className="text-[11px] text-ink-3">ANSES-CIQUAL</span>}>{t('Generic foods')}</SectionTitle>
              {(showAllGeneric ? genericHits : genericHits.slice(0, 6)).map((f) => (
                <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />
              ))}
              {!showAllGeneric && genericHits.length > 6 && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllGeneric(true)}>
                  {t('Show {n} more', { n: genericHits.length - 6 })}
                </Button>
              )}
            </>
          )}
          <SectionTitle right={<span className="text-[11px] text-ink-3">Open Food Facts</span>}>{t('Products')}</SectionTitle>
          {off.status === 'idle' &&
            (q.trim().length < 3 ? (
              <EmptyNote>{t('Type 3 letters or more to search products.')}</EmptyNote>
            ) : (
              <EmptyNote>{t('Searching…')}</EmptyNote>
            ))}
          {off.status === 'loading' && <EmptyNote>{t('Searching…')}</EmptyNote>}
          {off.status === 'error' && (
            <div className="py-4 text-center">
              <div className="text-[13px] text-ink-3">{off.message}</div>
              <Button size="sm" variant="ghost" icon="search" className="mt-1" onClick={runOFF}>
                {t('Try again')}
              </Button>
            </div>
          )}
          {off.status === 'done' &&
            (off.results.length ? (
              off.results.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)
            ) : (
              <EmptyNote>{t('No results online')}</EmptyNote>
            ))}
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
