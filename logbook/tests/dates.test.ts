import { describe, expect, it } from 'vitest';
import { addDays, dayKey, eatingWindowState, weekStart, weekdayMon0, weekDays, trainingWeekStart, trainingWeekDays } from '../src/lib/dates';

describe('dates', () => {
  it('uses Europe/Paris for the day key', () => {
    // 23:30 UTC on 21 Oct is 01:30 on 22 Oct in Paris (CEST)
    expect(dayKey(new Date('2026-10-21T23:30:00Z'))).toBe('2026-10-22');
  });
  it('weeks start on Monday', () => {
    expect(weekdayMon0('2026-10-19')).toBe(0); // Monday
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday -> Monday before
    expect(weekDays('2026-10-22')[6]).toBe('2026-10-25');
  });
  it('training weeks start on Sunday by default, Monday optionally', () => {
    expect(trainingWeekStart('2026-10-23')).toBe('2026-10-18'); // Friday -> Sunday before
    expect(trainingWeekStart('2026-10-25')).toBe('2026-10-25'); // Sunday is day one
    expect(trainingWeekDays('2026-10-25')[6]).toBe('2026-10-31');
    expect(trainingWeekStart('2026-10-25', 1)).toBe('2026-10-19');
  });
  it('adds days across month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
  });
  it('eating window states', () => {
    expect(eatingWindowState(9 * 60, '11:30', '20:00')).toMatchObject({ phase: 'before', minutesToOpen: 150 });
    expect(eatingWindowState(12 * 60, '11:30', '20:00')).toMatchObject({ phase: 'open', minutesToClose: 480 });
    expect(eatingWindowState(21 * 60, '11:30', '20:00')).toMatchObject({ phase: 'after', minutesToOpen: 870 });
    expect(eatingWindowState(23 * 60, '22:00', '02:00')).toMatchObject({ phase: 'open', minutesToClose: 180 });
  });
});
