import { describe, expect, test } from 'bun:test';
import { ALERGENOS_RECORDATORIO, TEXTO_LIBRE_SIN_FILTRO } from '@/lib/constants/dietary-options';
import { FAQS } from './faq-data';

/**
 * FRESCO-1000 (audit 7b A7-LAUNCH-03) — copy lint for what the app promises about allergens.
 *
 * Fresco filters recipes by the allergens each recipe DECLARES. The catalogue is not reviewed
 * by a person, traces are not modelled, and information can be wrong, so no public text may
 * say "nunca" or "absoluto" about allergens, and the FAQ must tell the person to read the label.
 */

const OVERPROMISE = /\bnunca\b|\babsolut/i;

describe('landing FAQ copy', () => {
  test.each(FAQS.map(item => [item.question, item]))('"%s" does not over-promise', (_question, item) => {
    expect(item.question).not.toMatch(OVERPROMISE);
    expect(item.answer).not.toMatch(OVERPROMISE);
  });

  test('the allergy answer says what is excluded and that the label must be read', () => {
    const allergy = FAQS.find(item => item.question.includes('alergias'));

    expect(allergy).toBeDefined();
    expect(allergy!.answer).toContain('14');
    expect(allergy!.answer).toMatch(/etiqueta/i);
    expect(allergy!.answer).toMatch(/declare/i);
  });
});

describe('allergen texts shown in the app', () => {
  test.each([['ALERGENOS_RECORDATORIO', ALERGENOS_RECORDATORIO], ['TEXTO_LIBRE_SIN_FILTRO', TEXTO_LIBRE_SIN_FILTRO]])('%s does not over-promise', (_name, text) => {
    expect(text).not.toMatch(OVERPROMISE);
  });

  test('the reminder tells the person to check ingredients and labels', () => {
    expect(ALERGENOS_RECORDATORIO).toMatch(/ingredientes/i);
    expect(ALERGENOS_RECORDATORIO).toMatch(/etiquetas/i);
  });

  test('the free-text note says it is not used to filter and points to the options above', () => {
    expect(TEXTO_LIBRE_SIN_FILTRO).toMatch(/no se usa para filtrar/i);
    expect(TEXTO_LIBRE_SIN_FILTRO).toMatch(/arriba/i);
  });
});
