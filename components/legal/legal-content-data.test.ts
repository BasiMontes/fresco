import { describe, expect, test } from 'bun:test';
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from './legal-content-data';

// FRESCO-790 (A6-P2): the shopping list shows supermarket prices, so the Terms
// must say they are indicative, where they come from and that the chain sets them.
describe('TERMS_SECTIONS — supermarket prices (FRESCO-790)', () => {
  const seccion = TERMS_SECTIONS.find(s => s.title === 'Precios y enlaces de supermercados');

  test('has a section on supermarket prices and links', () => {
    expect(seccion).toBeDefined();
  });

  test('says the prices are indicative, dated, and set by the chain', () => {
    expect(seccion!.body).toContain('a título orientativo');
    expect(seccion!.body).toContain('la fecha en que se observaron');
    expect(seccion!.body).toContain('la cadena es quien fija el precio');
  });

  test('names no specific chain, so switching one off needs no legal text change', () => {
    expect(seccion!.body).not.toMatch(/mercadona|consum/i);
  });
});

// FRESCO-1008 (audit 7b A7-PRIV-03..06): the privacy policy has to say what the code does.
describe('PRIVACY_SECTIONS — waitlist, guests and religious belief (FRESCO-1008)', () => {
  const section = (title: string) => PRIVACY_SECTIONS.find(s => s.title === title)!;

  test('has a Lista de Espera section: purpose, consent base, confirmation, retention and how to leave', () => {
    const body = section('Lista de Espera').body;

    expect(body).toContain('solo para avisarte del lanzamiento');
    expect(body).toContain('Art. 6.1.a');
    expect(body).toContain('enlace de confirmación');
    expect(body).toContain('a los 7 días');
    expect(body).toContain('12 meses');
    expect(body).toContain('darte de baja');
  });

  test('says guests are deleted 3 days after creation, with their PostHog data', () => {
    const body = section('Plazo de Conservación').body;

    expect(body).toContain('a los 3 días de haberse creado la sesión');
    expect(body).toContain('PostHog');
    expect(body).not.toContain('período de inactividad');
  });

  test('names the religious belief a halal diet can reveal, as special-category data', () => {
    expect(section('Información que Recopilamos').body).toContain('creencia religiosa');
    expect(section('Base Legal para Datos de Alergias').body).toContain('halal');
  });
});
