import { describe, expect, test } from 'bun:test';
import { CONTACT_EMAIL, TERMS_SECTIONS } from './legal-content-data';

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

// FRESCO-1004 (A7-LAUNCH-05): the Terms grant the 14-day withdrawal; they must also say how to exercise it.
describe('TERMS_SECTIONS — how to withdraw (FRESCO-1004)', () => {
  const seccion = TERMS_SECTIONS.find(s => s.title === 'Cómo ejercer el derecho de desistimiento');

  test('has its own section, right after the subscription one', () => {
    const titles = TERMS_SECTIONS.map(s => s.title);

    expect(seccion).toBeDefined();
    expect(titles.indexOf(seccion!.title)).toBe(titles.indexOf('Suscripción, Renovación y Derecho de Desistimiento') + 1);
  });

  test('says the channel, the deadline, the refund and gives a model text', () => {
    expect(seccion!.body).toContain(CONTACT_EMAIL);
    expect(seccion!.body).toContain('14 días naturales');
    expect(seccion!.body).toContain('te devolvemos todo lo que pagaste');
    expect(seccion!.body).toContain('A la atención de Fresco');
  });

  test('says that cancelling from the profile is not the withdrawal notice', () => {
    expect(seccion!.body).toContain('no sustituye este aviso');
  });
});
