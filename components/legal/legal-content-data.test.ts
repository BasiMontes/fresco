import { describe, expect, test } from 'bun:test';
import { TERMS_SECTIONS } from './legal-content-data';

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
