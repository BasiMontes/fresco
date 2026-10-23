import { describe, expect, test } from 'bun:test';
import { CONTACT_EMAIL, PRIVACY_SECTIONS, TERMS_SECTIONS } from './legal-content-data';

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

// FRESCO-1049 (AI-assisted legal analysis, ADR-0066): a liability cap on what a consumer paid can be an abusive clause,
// and the refund rule had to say when the money comes back in full and when only the unused part does.
describe('TERMS_SECTIONS — liability and refund wording (FRESCO-1049)', () => {
  const body = (title: string) => TERMS_SECTIONS.find(s => s.title === title)!.body;

  test('the liability clause has no cap tied to what the user paid', () => {
    const liability = body('Limitación de Responsabilidad');

    expect(liability).not.toContain('últimos 12 meses');
    expect(liability).not.toMatch(/se limita a lo que hayas pagado/);
  });

  test('the liability clause keeps the consumer-law and wilful-misconduct carve-outs', () => {
    const liability = body('Limitación de Responsabilidad');

    expect(liability).toContain('normativa de protección de consumidores');
    expect(liability).toContain('dolo o negligencia grave');
    expect(liability).toContain('daños personales');
  });

  test('the withdrawal clause says when the refund is full and when it is proportional', () => {
    const withdrawal = body('Suscripción, Renovación y Derecho de Desistimiento');

    expect(withdrawal).toContain('te devolvemos el importe íntegro');
    expect(withdrawal).toContain('abonas la parte del servicio ya prestada');
    expect(withdrawal).toContain('te devolvemos el resto');
  });
});
