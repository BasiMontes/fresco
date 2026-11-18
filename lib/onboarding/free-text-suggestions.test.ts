import { describe, expect, test } from 'bun:test';
import { ALERGENO_OPTIONS, ALERGENO_VALUES, INGREDIENTE_ODIADO_OPTIONS, INGREDIENTE_ODIADO_VALUES } from '@/lib/constants/dietary-options';
import { ALERGENO_SYNONYMS, findSuggestions, INGREDIENTE_SYNONYMS } from './free-text-suggestions';

// Distinct values: two typed words can name the same allergen; the UI shows one chip per value.
const allergens = (text: string) =>
  [...new Set(findSuggestions(text, { kinds: ['alergeno'] }).flatMap(s => s.values))].sort();
const ingredients = (text: string) =>
  [...new Set(findSuggestions(text, { kinds: ['ingrediente'] }).flatMap(s => s.values))].sort();

describe('findSuggestions — allergen phrase table (FRESCO-1228)', () => {
  test.each<[string, string[]]>([
    // synonyms and Latin American variants
    ['maní', ['cacahuetes']],
    ['cacahuete', ['cacahuetes']],
    ['cacahuates', ['cacahuetes']],
    ['manís', ['cacahuetes']],
    ['cachuete', ['cacahuetes']],
    ['marisco', ['crustaceos', 'moluscos']],
    ['MARISCOS', ['crustaceos', 'moluscos']],
    ['camarones', ['crustaceos']],
    ['gambas', ['crustaceos']],
    ['mejillones', ['moluscos']],
    ['calamar', ['moluscos']],
    ['ajonjolí', ['sesamo']],
    ['Sésamo', ['sesamo']],
    ['sesamo', ['sesamo']],
    ['soja', ['soja']],
    ['soya', ['soja']],
    ['trigo', ['gluten']],
    ['avena', ['gluten']],
    ['soy celíaca', ['gluten']],
    ['sin gluten', ['gluten']],
    ['leche', ['lactosa']],
    ['QUESO', ['lactosa']],
    ['lactoza', ['lactosa']],
    ['huevos', ['huevo']],
    ['pescado azul', ['pescado']],
    ['salmón', ['pescado']],
    ['mostaza', ['mostaza']],
    ['apio', ['apio']],
    ['sulfitos', ['sulfitos']],
    ['altramuces', ['altramuces']],
    ['lupino', ['altramuces']],
    ['nueces', ['frutos_de_cascara']],
    ['almendras y avellanas', ['frutos_de_cascara']],
    ['frutos secos', ['cacahuetes', 'frutos_de_cascara']],
    // several mentions in one sentence
    ['alergia a la leche, el maní y el pescado', ['cacahuetes', 'lactosa', 'pescado']],
  ])('%j suggests %j', (text, expected) => {
    expect(allergens(text)).toEqual(expected);
  });

  test('marisco is ONE suggestion carrying BOTH crustaceos and moluscos (one click, never half-protected)', () => {
    const found = findSuggestions('marisco', { kinds: ['alergeno'] });
    expect(found).toHaveLength(1);
    expect(found[0].values).toEqual(['crustaceos', 'moluscos']);
    expect(found[0].typed).toBe('marisco');
  });

  test('frutos secos is ONE suggestion carrying frutos_de_cascara and cacahuetes', () => {
    const found = findSuggestions('frutos secos', { kinds: ['alergeno'] });
    expect(found).toHaveLength(1);
    expect(found[0].values.sort()).toEqual(['cacahuetes', 'frutos_de_cascara']);
  });

  // FRESCO-1228 review: words a person with the allergy types, with plurals, accents and ñ.
  test.each<[string, string[]]>([
    ['pan', ['gluten']],
    ['pasta', ['gluten']],
    ['harina', ['gluten']],
    ['cerveza', ['gluten']],
    ['malta', ['gluten']],
    ['sémola', ['gluten']],
    ['cuscús', ['gluten']],
    ['fideos', ['gluten']],
    ['galletas', ['gluten']],
    ['empanado', ['gluten']],
    ['rebozado', ['gluten']],
    ['turrón', ['frutos_de_cascara']],
    ['turrones', ['frutos_de_cascara']],
    ['mazapán', ['frutos_de_cascara']],
    ['praliné', ['frutos_de_cascara']],
    ['almendrado', ['frutos_de_cascara']],
    ['pacanas', ['frutos_de_cascara']],
    ['lenguado', ['pescado']],
    ['bonito', ['pescado']],
    ['surimi', ['pescado']],
    ['tilapia', ['pescado']],
    ['rape', ['pescado']],
    ['rodaballo', ['pescado']],
    ['pescadilla', ['pescado']],
    ['pez espada', ['pescado']],
    ['pez', []], // alone: too ambiguous, documented
    ['clara', ['huevo']],
    ['yemas', ['huevo']],
    ['mayonesa', ['huevo']],
    ['merengue', ['huevo']],
    ['albúmina', ['huevo']],
    ['ovoalbúmina', ['huevo']],
    ['tortilla', []], // corn or egg: ambiguous, documented
    ['helado', ['lactosa']],
    ['suero', ['lactosa']],
    ['lactosuero', ['lactosa']],
    ['requesón', ['lactosa']],
    ['mascarpone', ['lactosa']],
    ['flan', ['lactosa']],
    ['bechamel', ['lactosa']],
    ['besamel', ['lactosa']],
    ['cuajada', ['lactosa']],
    ['kéfir', ['lactosa']],
    ['crema pastelera', ['lactosa']],
    ['crema catalana', ['lactosa']],
    ['crema de calabacín', []], // crema alone is not dairy
    ['carabinero', ['crustaceos']],
    ['nécora', ['crustaceos']],
    ['centolla', ['crustaceos']],
    ['jaiba', ['crustaceos']],
    ['gambones', ['crustaceos']],
    ['navajas', ['moluscos']],
    ['navaja', []], // a knife
    ['zamburiñas', ['moluscos']],
    ['coquinas', ['moluscos']],
    ['choco', ['moluscos']],
    ['jibia', ['moluscos']],
    ['pota', ['moluscos']],
    // compounds that are not the allergen
    ['trigo sarraceno', []],
    ['nata de coco', []],
    ['queso vegano', []],
    ['queso de soja', ['soja']],
    ['harina de maíz', []],
    ['harina de almendra', ['frutos_de_cascara']],
    ['sin gluten', ['gluten']],
  ])('%j suggests %j', (text, expected) => {
    expect(allergens(text)).toEqual(expected);
  });

  test('keeps what the person typed, with its own case and accents', () => {
    expect(findSuggestions('Alérgico al Maní', { kinds: ['alergeno'] })[0].typed).toBe('Maní');
  });
});

describe('findSuggestions — false positives and negations', () => {
  test.each<[string, string[]]>([
    ['no soy alérgico a nada', []],
    ['ninguna', []],
    ['', []],
    ['   ', []],
    ['soy vegetariano', []], // "soy" is the verb, never soja
    ['natación y atún', ['pescado']], // word boundaries: "nata" inside "natación" does not match
    ['mantequilla de cacahuete', ['cacahuetes']], // never lactosa
    ['leche de coco', []],
    ['leche de arroz', []],
    ['leche de avena', ['gluten']],
    ['leche de almendras', ['frutos_de_cascara']],
    ['leche de soja', ['soja']],
    ['nuez moscada', []],
    ['manteca de cacao', []],
    ['castañas y piñones', []], // not on the EU frutos de cascara list
  ])('%j suggests %j', (text, expected) => {
    expect(allergens(text)).toEqual(expected);
  });

  test('a negation does NOT suppress a mention: when in doubt, suggest (nothing applies without a click)', () => {
    expect(allergens('no tengo alergia al marisco')).toEqual(['crustaceos', 'moluscos']);
    expect(allergens('sin cacahuete')).toEqual(['cacahuetes']);
    expect(allergens('no me gusta el apio')).toEqual(['apio']);
  });

  test('the same word twice gives one suggestion', () => {
    expect(findSuggestions('leche leche', { kinds: ['alergeno'] })).toHaveLength(1);
  });
});

describe('findSuggestions — ingredients to avoid', () => {
  test.each<[string, string[]]>([
    ['cebollas', ['cebolla']],
    ['no me gustan los champiñones', ['champiñones']],
    ['Champinones', ['champiñones']],
    ['setas', ['setas']],
    ['judías verdes', ['judias verdes']],
    ['pimiento rojo', ['pimiento rojo']],
    ['pimiento verde y chorizo', ['chorizo', 'pimiento verde']],
    ['pimiento', []], // ambiguous (rojo/verde), the SQL compares full names
    ['berenjena', []], // not in the closed list: stays unfiltered with the warning
    ['cacahuete', []], // an allergen, not an ingredient suggestion
  ])('%j suggests %j', (text, expected) => {
    expect(ingredients(text)).toEqual(expected);
  });

  test('apio is both an allergen and an ingredient: two separate suggestions', () => {
    const found = findSuggestions('apio', { kinds: ['alergeno', 'ingrediente'] });
    expect(found.map(s => s.kind).sort()).toEqual(['alergeno', 'ingrediente']);
  });

  test('a box only gets the kinds it asks for', () => {
    expect(findSuggestions('cebolla y maní', { kinds: ['alergeno'] }).flatMap(s => s.values)).toEqual(['cacahuetes']);
  });
});

describe('vocabulary integrity', () => {
  test('every allergen key is a value the profile and the filter accept', () => {
    for (const value of Object.keys(ALERGENO_SYNONYMS)) {
      expect(ALERGENO_VALUES.has(value)).toBe(true);
    }
  });

  test('every key exists in the option lists the chips render and upsertUserProfile validates against', () => {
    // `upsertUserProfile` allow-lists with ALERGENO_VALUES / INGREDIENTE_ODIADO_VALUES, built from these arrays.
    const alergenoOptions = ALERGENO_OPTIONS.map(o => o.value);
    const ingredienteOptions = INGREDIENTE_ODIADO_OPTIONS.map(o => o.value);
    for (const key of Object.keys(ALERGENO_SYNONYMS)) { expect(alergenoOptions).toContain(key); }
    for (const key of Object.keys(INGREDIENTE_SYNONYMS)) { expect(ingredienteOptions).toContain(key); }
  });

  test('every value a suggestion can carry is valid for its kind', () => {
    const samples = ['marisco', 'frutos secos', 'queso de soja', 'harina de almendra', 'cebollas', 'apio'];
    for (const s of samples.flatMap(t => findSuggestions(t, { kinds: ['alergeno', 'ingrediente'] }))) {
      const valid = s.kind === 'alergeno' ? ALERGENO_VALUES : INGREDIENTE_ODIADO_VALUES;
      s.values.forEach(v => expect(valid.has(v)).toBe(true));
    }
  });

  test('all 14 EU allergens are covered', () => {
    expect(new Set(Object.keys(ALERGENO_SYNONYMS))).toEqual(ALERGENO_VALUES);
  });

  test('every ingredient key is one of the names the SQL filter is offered', () => {
    for (const value of Object.keys(INGREDIENTE_SYNONYMS)) {
      expect(INGREDIENTE_ODIADO_VALUES.has(value)).toBe(true);
    }
  });

  test('every vocabulary phrase is already normalized (lowercase, no accents)', () => {
    for (const phrase of [...Object.values(ALERGENO_SYNONYMS), ...Object.values(INGREDIENTE_SYNONYMS)].flat()) {
      expect(phrase).toBe(phrase.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase());
    }
  });
});
