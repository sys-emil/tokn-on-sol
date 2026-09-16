import { describe, expect, it } from 'vitest';
import { formatCents, yearlyPerMonthCents, yearlySaving, yearlySavingLabel } from '../proPricing';

describe('yearlySaving', () => {
  it('290 € im Jahr gegen 29 € im Monat sind zwei Monate geschenkt', () => {
    const s = yearlySaving(2900, 29000);
    expect(s).toEqual({ monthsFree: 2, percent: 17 });
    expect(yearlySavingLabel(s)).toBe('2 Monate geschenkt');
  });

  it('ein voller Monat wird im Singular beschriftet', () => {
    expect(yearlySavingLabel(yearlySaving(2900, 31900))).toBe('1 Monat geschenkt');
  });

  it('krumme Preise ohne vollen Monat fallen auf Prozent zurück', () => {
    const s = yearlySaving(2900, 33000); // 11,38 Monate
    expect(s?.monthsFree).toBe(0);
    expect(yearlySavingLabel(s)).toBe('5 % günstiger');
  });

  it('ein Jahresabo, das nicht günstiger ist, wird nicht beworben', () => {
    expect(yearlySaving(2900, 34800)).toBeNull();
    expect(yearlySaving(2900, 40000)).toBeNull();
    expect(yearlySavingLabel(null)).toBeNull();
  });

  it('unbrauchbare Beträge ergeben null statt NaN', () => {
    expect(yearlySaving(0, 29000)).toBeNull();
    expect(yearlySaving(2900, 0)).toBeNull();
  });
});

describe('yearlyPerMonthCents', () => {
  it('rundet ab, nie auf', () => {
    expect(yearlyPerMonthCents(29000)).toBe(2416);
    expect(yearlyPerMonthCents(24000)).toBe(2000);
  });
});

describe('formatCents', () => {
  it('lässt Nullen nach dem Komma weg', () => {
    // Intl setzt ein geschütztes Leerzeichen vor das Währungszeichen.
    expect(formatCents(2900)).toBe('29\u00a0€');
    expect(formatCents(2416)).toBe('24,16\u00a0€');
  });
});
