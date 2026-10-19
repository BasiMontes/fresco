import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { describePlanning } from '@/lib/onboarding/wizard-options';
import { toPlanningSelection } from '@/lib/planning-selection';
import { MEAL_LABELS, MEAL_SLOTS } from './meal-labels';

/** FRESCO-1014 (A7-UI-09): one name for the midday meal, from one constant. */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { return sourceFiles(path); }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('MEAL_LABELS', () => {
  test('names the midday meal "Comida", not "Almuerzo"', () => {
    expect(MEAL_LABELS).toEqual({ desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena' });
    expect(MEAL_SLOTS).toEqual(['desayuno', 'comida', 'cena']);
  });

  test('the onboarding summary uses it', () => {
    const selection = toPlanningSelection(['lunes'], ['desayuno', 'comida', 'cena']);

    expect(describePlanning(selection).meals).toBe('Desayuno, Comida, Cena');
  });

  test('no screen, route or library file labels the midday meal "Almuerzo" any more', () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap(dir => sourceFiles(dir))
      .filter(file => /Almuerzo/.test(readFileSync(file, 'utf8')));

    expect(offenders).toEqual([]);
  });
});
