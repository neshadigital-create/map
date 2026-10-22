import { useMemo, useState } from 'react';
import { MUSCLES, type Exercise, type Muscle } from '../../db/types';
import { createExercise, useExercises } from '../../db/train';
import { normalize } from '../../lib/parser';
import { useT } from '../../lib/i18n';
import { haptic } from '../../lib/haptics';
import { Button, Label, Sheet } from '../../components/ui';
import { EmptyNote, SearchInput } from '../food/parts';

export function MusclePicker({ value, onChange }: { value: Muscle; onChange: (m: Muscle) => void }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {MUSCLES.map((m) => (
        <button
          key={m}
          onClick={() => {
            haptic();
            onChange(m);
          }}
          className={`tap min-h-10 rounded-full border px-3.5 text-[13px] capitalize ${value === m ? 'border-accent text-ink' : 'border-line text-ink-2'}`}
        >
          {t(m)}
        </button>
      ))}
    </div>
  );
}

/** Pick one of my exercises, or create a new one (name + muscle group). Nothing is pre-filled. */
export function ExercisePicker({ onPick, onClose, exclude = [] }: { onPick: (e: Exercise) => void; onClose: () => void; exclude?: string[] }) {
  const t = useT();
  const all = useExercises();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [muscle, setMuscle] = useState<Muscle>('glutes');
  const list = useMemo(() => {
    const n = normalize(q);
    return all.filter((e) => !exclude.includes(e.id) && (!n || normalize(e.name).includes(n) || e.muscle.includes(n)));
  }, [all, q, exclude]);

  return (
    <Sheet title={creating ? t('New exercise') : t('Add exercise')} onClose={onClose} tall>
      {creating ? (
        <div className="space-y-5 pt-1">
          <label className="block">
            <Label className="mb-2">{t('Name')}</Label>
            <input autoFocus className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hip thrust" />
          </label>
          <div>
            <Label className="mb-3">{t('Muscle group')}</Label>
            <MusclePicker value={muscle} onChange={setMuscle} />
          </div>
          <Button variant="primary" size="lg" className="w-full" disabled={!q.trim()} onClick={async () => onPick(await createExercise(q, muscle))}>
            {t('Add')}
          </Button>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-5 bg-card px-5 pb-3">
            <SearchInput value={q} onChange={setQ} placeholder={t('Search exercises')} autoFocus />
          </div>
          {list.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                haptic();
                onPick(e);
              }}
              className="tap flex min-h-14 w-full items-center justify-between border-b border-line text-left last:border-b-0"
            >
              <span className="text-[15px]">{e.name}</span>
              <span className="text-[12px] capitalize text-ink-3">{t(e.muscle)}</span>
            </button>
          ))}
          {list.length === 0 && <EmptyNote>{all.length ? '—' : t('Your exercise list is empty. Add your own.')}</EmptyNote>}
          <Button icon="plus" className="mt-4 w-full" onClick={() => setCreating(true)}>
            {q.trim() ? `${t('New exercise')} “${q.trim()}”` : t('New exercise')}
          </Button>
        </>
      )}
    </Sheet>
  );
}
