import { useEffect, useRef, useState } from 'react';
import { setFlag } from '../../lib/prefs';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSettings } from '../../db/hooks';
import { updateSettings } from '../../db/actions';
import { downloadJSON, exportAll, importBackup } from '../../db/backup';
import { suggestTargets, MIN_KCAL } from '../../lib/targets';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { dayKey } from '../../lib/dates';
import type { ActivityLevel, Goal, Lang, Settings, Targets } from '../../db/types';
import { Button, Label, NumField, Segmented, Sheet, Toggle } from '../../components/ui';
import { uid } from '../../lib/id';

function StorageInfo() {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const info = useLiveQuery(async () => {
    const est = await navigator.storage?.estimate?.().catch(() => undefined);
    const persisted = await navigator.storage?.persisted?.().catch(() => false);
    const last = (await db.meta.get('lastBackupAt'))?.value as number | undefined;
    return { used: est?.usage, persisted, last };
  }, []);
  if (!info) return null;
  return (
    <div className="space-y-1 text-[12px] text-ink-3">
      {info.used !== undefined && (
        <div>
          {t('Storage used')}: {(info.used / 1024 / 1024).toFixed(1)} MB{info.persisted ? ` · ${t('protected from clean-up')}` : ''}
        </div>
      )}
      <div>
        {t('Last backup')}: {info.last ? new Date(info.last).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '—'}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line py-5 last:border-b-0">
      <Label className="mb-4">{title}</Label>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function SettingsSheet() {
  const t = useT();
  const { close, notify } = useUI();
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const sug = suggestTargets(s);
  useEffect(() => setFlag('targets-checked'), []);
  const save = (patch: Partial<Settings>) => updateSettings(patch);
  const setTarget = (k: keyof Targets, v: number | undefined) => {
    if (v === undefined) return;
    const val = k === 'kcal' ? Math.max(MIN_KCAL, v) : Math.max(0, v);
    save({ autoTargets: false, targets: { ...s.targets, [k]: val } });
  };

  return (
    <Sheet title={t('Settings')} onClose={close} tall>
      <Section title={t('Appearance')}>
        <Segmented<'auto' | 'light' | 'dark'>
          value={s.theme ?? 'auto'}
          onChange={(theme) => save({ theme })}
          options={[
            { value: 'auto', label: t('Auto') },
            { value: 'light', label: t('Daylight') },
            { value: 'dark', label: t('Night') },
          ]}
        />
        <div className="text-[13px] text-ink-3">{t('Auto follows your iPhone’s light and dark mode.')}</div>
      </Section>

      <Section title={t('Language')}>
        <Segmented<Lang>
          value={s.lang}
          onChange={(lang) => save({ lang })}
          options={[
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'Français' },
          ]}
        />
        <div className="text-[13px] text-ink-3">
          {t('Units')}: {t('Metric (g, ml, kg, cm, °C)')}
        </div>
      </Section>

      <Section title={t('Targets')}>
        <Toggle checked={s.autoTargets} onChange={(autoTargets) => save({ autoTargets })} label={t('Auto-suggest')} />
        <div className="rounded-2xl border border-line p-4 text-[13px] leading-relaxed text-ink-2">
          <div>{t('Maintenance about {n} kcal', { n: sug.tdee })}</div>
          <div className="text-protein">{t('Suggested protein range {a}–{b} g', { a: sug.proteinRange[0], b: sug.proteinRange[1] })}</div>
          <div className="text-ink-3">
            {sug.targets.kcal} kcal · P {sug.targets.protein} · C {sug.targets.carbs} · F {sug.targets.fat}
          </div>
          {!s.autoTargets && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => save({ autoTargets: true })}>
              {t('Auto-suggest')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField lazy label={t('Calories')} unit="kcal" value={s.targets.kcal} onChange={(v) => setTarget('kcal', v)} step="50" />
          <NumField lazy label={t('Protein')} unit="g" value={s.targets.protein} onChange={(v) => setTarget('protein', v)} step="5" />
          <NumField lazy label={t('Carbs')} unit="g" value={s.targets.carbs} onChange={(v) => setTarget('carbs', v)} step="5" />
          <NumField lazy label={t('Fat')} unit="g" value={s.targets.fat} onChange={(v) => setTarget('fat', v)} step="5" />
          <NumField lazy label={t('Fiber')} unit="g" value={s.targets.fiber} onChange={(v) => setTarget('fiber', v)} />
        </div>
        <div className="text-[12px] text-ink-3">{t('Targets never go below 1,200 kcal.')}</div>
      </Section>

      <Section title={t('Profile')}>
        <Segmented
          value={s.sex}
          onChange={(sex) => save({ sex })}
          options={[
            { value: 'female', label: t('Female') },
            { value: 'male', label: t('Male') },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumField lazy label={t('Age')} value={s.age} onChange={(v) => v && save({ age: v })} />
          <NumField lazy label={t('Height')} unit="cm" value={s.heightCm} onChange={(v) => v && save({ heightCm: v })} />
          <NumField lazy label={t('Weight')} unit="kg" value={s.weightKg} onChange={(v) => v && save({ weightKg: v })} />
          <NumField lazy label={t('Goal weight')} unit="kg" value={s.goalWeightKg} onChange={(v) => v && save({ goalWeightKg: v })} />
        </div>
        <div>
          <Label className="mb-2">{t('Goal')}</Label>
          <Segmented<Goal>
            value={s.goal}
            onChange={(goal) => save({ goal })}
            options={[
              { value: 'recomp', label: t('Recomposition') },
              { value: 'lose', label: t('Fat loss') },
              { value: 'maintain', label: t('Maintain') },
            ]}
          />
        </div>
        <div>
          <Label className="mb-2">{t('Activity')}</Label>
          <Segmented<ActivityLevel>
            value={s.activity}
            onChange={(activity) => save({ activity })}
            options={[
              { value: 'light', label: t('Light') },
              { value: 'moderate', label: t('Moderate') },
              { value: 'high', label: t('High') },
            ]}
          />
        </div>
      </Section>

      <Section title={t('Eating window')}>
        <Toggle
          checked={s.eatingWindow.enabled}
          onChange={(enabled) => save({ eatingWindow: { ...s.eatingWindow, enabled } })}
          label={t('Show eating window')}
        />
        <div className="grid grid-cols-2 gap-3">
          <label>
            <Label className="mb-2">{t('First meal')}</Label>
            <input type="time" className="field" value={s.eatingWindow.start} onChange={(e) => save({ eatingWindow: { ...s.eatingWindow, start: e.target.value } })} />
          </label>
          <label>
            <Label className="mb-2">{t('Last meal')}</Label>
            <input type="time" className="field" value={s.eatingWindow.end} onChange={(e) => save({ eatingWindow: { ...s.eatingWindow, end: e.target.value } })} />
          </label>
        </div>
      </Section>

      <Section title={t('Meals')}>
        {s.meals.map((m, i) => (
          <div key={m.id} className="flex gap-2">
            <input
              className="field"
              defaultValue={m.name}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== m.name) save({ meals: s.meals.map((x) => (x.id === m.id ? { ...x, name } : x)) });
              }}
            />
            {s.meals.length > 1 && i === s.meals.length - 1 && (
              <Button variant="ghost" icon="minus" aria-label={t('Delete')} onClick={() => save({ meals: s.meals.slice(0, -1) })} />
            )}
          </div>
        ))}
        {s.meals.length < 6 && (
          <Button icon="plus" variant="ghost" onClick={() => save({ meals: [...s.meals, { id: `meal-${uid()}`, name: `Meal ${s.meals.length + 1}` }] })}>
            {t('Add')}
          </Button>
        )}
      </Section>

      <Section title={`${t('Water goal')} · ${t('Rest timer')}`}>
        <div className="grid grid-cols-2 gap-3">
          <NumField lazy label={t('Water goal')} unit="ml" value={s.waterGoalMl} step="250" onChange={(v) => v && save({ waterGoalMl: v })} />
          <NumField lazy label={t('Rest timer')} unit="s" value={s.restTimerSec} step="15" onChange={(v) => v && save({ restTimerSec: v })} />
        </div>
      </Section>

      <Section title={t('Backup')}>
        <div className="grid grid-cols-2 gap-2">
          <Button
            icon="download"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                downloadJSON(await exportAll(), `logbook-backup-${dayKey()}.json`);
                notify(t('Backup saved'));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('Export JSON')}
          </Button>
          <Button icon="upload" disabled={busy} onClick={() => fileRef.current?.click()}>
            {t('Import JSON')}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            try {
              const res = await importBackup(JSON.parse(await file.text()), 'merge');
              const n = Object.values(res.imported).reduce((a, b) => a + b, 0);
              notify(t('Imported {n} rows', { n }));
            } catch {
              notify(t('Import failed'));
            } finally {
              setBusy(false);
            }
          }}
        />
        <div className="text-[12px] text-ink-3">{t('Import merges by id. Nothing is deleted.')}</div>
        <StorageInfo />
      </Section>
      <Section title={t('Data sources')}>
        <div className="text-[12px] leading-relaxed text-ink-3">
          {t('Generic foods: ANSES-CIQUAL 2020 (Licence Ouverte Etalab 2.0). Products: Open Food Facts (ODbL).')}
        </div>
      </Section>
      <div className="pb-6 pt-2 text-center text-[11px] text-ink-3">Logbook 1.0</div>
    </Sheet>
  );
}
