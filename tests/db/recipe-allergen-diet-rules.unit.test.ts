import type { RecipeTags } from './recipe-allergen-diet-rules';
import { describe, expect, test } from 'bun:test';
import { auditRecipe, auditRecipeFindings, textHasAllergen } from './recipe-allergen-diet-rules';

/**
 * FRESCO-943 — the exceptions list of the allergen/diet audit must not mask the real cases
 * (jamón, queso, trigo), and the word boundaries must not invent false ones.
 * FRESCO-999 (audit 7b, A7-TEST-01) — one row per gap the oracle used to be blind to: steps,
 * the full EU vocabulary, compound products and the reverse diet check. No stack needed.
 */

const DIET = { halal: true, kosher: true, sin_gluten: true, sin_lactosa: true, sin_huevo: true };
/** The default recipe claims only halal and kosher, so a test about a missing tag is not also a test about a free-of flag. */
const RELIGIOUS = { halal: true, kosher: true };

function recipe(ingredients: string[], overrides: Partial<RecipeTags> = {}): RecipeTags {
  return { nombre: 'Receta', alergenos: [], dieta: { ...RELIGIOUS }, ingredientes_principales: ingredients, ...overrides };
}

/** True when some finding message contains `text`. */
const reports = (r: RecipeTags, text: string) => auditRecipe(r).some(message => message.includes(text));

describe('allergen keywords catch the audit cases', () => {
  test('queso, yogur and leche require lactosa, even next to an exception-looking word', () => {
    expect(auditRecipe(recipe(['queso feta']))).toEqual(['Receta: falta lactosa (ingrediente: queso feta)']);
    expect(auditRecipe(recipe(['yogur griego']))).toHaveLength(1);
    expect(auditRecipe(recipe(['leche de coco', 'leche']))).toEqual(['Receta: falta lactosa (ingrediente: leche)']);
  });

  test('mostaza and altramuz require their own tag (FRESCO-912)', () => {
    expect(auditRecipe(recipe(['mostaza de Dijon']))).toEqual(['Receta: falta mostaza (ingrediente: mostaza de Dijon)']);
    expect(auditRecipe(recipe(['altramuces en salmuera']))).toEqual(['Receta: falta altramuces (ingrediente: altramuces en salmuera)']);
    expect(auditRecipe(recipe(['mostaza'], { alergenos: ['mostaza'] }))).toEqual([]);
  });

  test('tortilla de trigo requires gluten', () => {
    expect(auditRecipe(recipe(['tortilla de trigo']))).toEqual(['Receta: falta gluten (ingrediente: tortilla de trigo)']);
  });

  test('jamón breaks halal and kosher; wine breaks halal and needs sulfitos', () => {
    const ham = auditRecipe(recipe(['jamón serrano']));
    expect(ham.some(m => m.includes('halal'))).toBe(true);
    expect(ham.some(m => m.includes('kosher'))).toBe(true);
    const wine = auditRecipe(recipe(['vino blanco']));
    expect(wine.some(m => m.includes('falta sulfitos'))).toBe(true);
    expect(wine.some(m => m.includes('halal'))).toBe(true);
  });

  test('rabbit, shellfish and meat with dairy break kosher', () => {
    expect(auditRecipe(recipe(['conejo'])).some(m => m.includes('kosher'))).toBe(true);
    expect(auditRecipe(recipe(['gambas'])).some(m => m.includes('kosher'))).toBe(true);
    expect(auditRecipe(recipe(['ternera', 'queso'], { alergenos: ['lactosa'], dieta: { ...DIET, sin_lactosa: false } }))
      .some(m => m.includes('carne y lácteo'))).toBe(true);
  });

  test('a tag that says the allergen is present contradicts the diet flag', () => {
    const problems = auditRecipe(recipe([], { alergenos: ['gluten', 'lactosa', 'huevo'], dieta: { ...DIET } }));
    expect(problems).toHaveLength(3);
  });
});

describe('exceptions and word boundaries do not invent allergens', () => {
  test.each([
    ['lactosa', 'leche de coco'],
    ['lactosa', 'bebida de almendra'],
    ['lactosa', 'leche de avena'],
    ['lactosa', 'nata de coco'],
    ['lactosa', 'bebida de soja'],
    ['frutos_de_cascara', 'nuez moscada'],
    ['frutos_de_cascara', 'bebida de almendra'],
    ['gluten', 'harina de maíz'],
    ['gluten', 'fideos de arroz'],
    ['gluten', 'pan sin gluten'],
    ['gluten', 'panceta'],
    ['frutos_de_cascara', 'champiñones'],
    ['soja', 'brotes de soja'],
  ])('%s is not required by "%s"', (allergen, ingredient) => {
    expect(textHasAllergen(ingredient, allergen)).toBe(false);
  });

  test.each([
    ['lactosa', 'queso'],
    ['lactosa', 'queso crema'],
    ['gluten', 'pan integral'],
    ['gluten', 'tortilla de trigo'],
    ['gluten', 'harina de trigo'],
    ['frutos_de_cascara', 'nueces'],
    ['frutos_de_cascara', 'piñones'],
    ['soja', 'tofu'],
    ['sulfitos', 'vino tinto'],
  ])('%s is still required by "%s"', (allergen, ingredient) => {
    expect(textHasAllergen(ingredient, allergen)).toBe(true);
  });

  test('a coherent recipe has no findings', () => {
    const dieta = { ...DIET, halal: false, kosher: false };
    expect(auditRecipe(recipe(['leche de coco', 'champiñones', 'panceta'], { dieta }))).toEqual([]);
  });
});

describe('the oracle reads the steps together with the ingredients (A7-TEST-01)', () => {
  test('an ingredient that only a step names is still an allergen: pad thai with "salsa de soja"', () => {
    const padThai = recipe(['fideos de arroz', 'gambas', 'huevo', 'cacahuetes'], {
      alergenos: ['crustaceos', 'huevo', 'cacahuetes'],
      dieta: { sin_gluten: true },
      pasos_resumen: ['Saltear las gambas', 'Mezclar todo con salsa de soja y cacahuetes'],
    });
    expect(reports(padThai, 'falta soja (paso: "Mezclar todo con salsa de soja y cacahuetes")')).toBe(true);
    expect(reports(padThai, 'falta gluten (paso:')).toBe(true);
    expect(reports(padThai, 'sin_gluten es true con gluten en el texto')).toBe(true);
  });

  test('a sub-recipe named only in a step is found: "crema de limón" needs huevo, "bechamel" needs gluten', () => {
    expect(reports(recipe(['limón', 'harina', 'mantequilla'], { alergenos: ['gluten', 'lactosa'], pasos_resumen: ['Añadir la crema de limón y hornear'] }), 'falta huevo (paso:')).toBe(true);
    expect(reports(recipe(['berenjena', 'ternera'], { alergenos: ['lactosa'], pasos_resumen: ['Montar capas con bechamel y hornear'] }), 'falta gluten (paso:')).toBe(true);
  });

  test('a step is not evidence when the ingredient list already clears the same word', () => {
    const riceNoodles = recipe(['fideos de arroz', 'gambas'], { alergenos: ['crustaceos'], pasos_resumen: ['Añadir los fideos y la salsa'] });
    expect(reports(riceNoodles, 'falta gluten')).toBe(false);
    const coconut = recipe(['leche de coco', 'pollo'], { pasos_resumen: ['Añadir la leche y cocer'] });
    expect(reports(coconut, 'falta lactosa')).toBe(false);
  });

  test('a step adjective or a generic dough is not a fish or a flour: "dorada", "masa"', () => {
    const browned = recipe(['coliflor'], { pasos_resumen: ['Hornear hasta que esté dorada'] });
    expect(reports(browned, 'falta pescado')).toBe(false);
    const arepa = recipe(['harina de maíz', 'queso'], { alergenos: ['lactosa'], pasos_resumen: ['Preparar la masa y formar la arepa'] });
    expect(reports(arepa, 'falta gluten')).toBe(false);
  });
});

describe('vocabulary the oracle used to miss (A7-TEST-01)', () => {
  test.each([
    ['sesamo', 'hummus'],
    ['sesamo', 'humus casero'],
    ['soja', 'salsa de soja'],
    ['gluten', 'salsa de soja'],
    ['apio', 'caldo de verduras'],
    ['sulfitos', 'vinagre de manzana'],
    ['sulfitos', 'pasas'],
    ['mostaza', 'curry en polvo'],
    ['mostaza', 'mayonesa'],
    ['mostaza', 'salsa barbacoa'],
    ['sulfitos', 'mayonesa'],
    ['sulfitos', 'salsa barbacoa'],
    ['sulfitos', 'cerveza'],
    ['sulfitos', 'arroz de sushi'],
    ['soja', 'miso blanco'],
    ['soja', 'tamari'],
    ['pescado', 'lubina'],
    ['pescado', 'pez espada'],
    ['moluscos', 'chipirones'],
    ['moluscos', 'vieiras'],
    ['crustaceos', 'cigalas'],
    ['crustaceos', 'centollo'],
    ['gluten', 'bulgur'],
    ['gluten', 'espelta'],
    ['gluten', 'gnocchi'],
    ['huevo', 'crepes'],
    ['huevo', 'crema de limón'],
  ])('%s is required by "%s"', (allergen, text) => {
    expect(textHasAllergen(text, allergen)).toBe(true);
  });

  test.each([
    ['sulfitos', 'vinagre de arroz'],
    ['gluten', 'pasta de curry'],
    ['gluten', 'salsa de soja sin gluten'],
  ])('%s is not required by "%s"', (allergen, text) => {
    expect(textHasAllergen(text, allergen)).toBe(false);
  });
});

describe('the reverse check: a diet flag that the text breaks (A7-TEST-01)', () => {
  test('sin_gluten true with tamari or miso is flagged (miso is gluten by rule), unless the text says "sin gluten"', () => {
    expect(reports(recipe(['tofu', 'tamari'], { alergenos: ['soja'], dieta: { sin_gluten: true } }), 'sin_gluten es true con un producto que suele llevar trigo o cebada (ingrediente: tamari)')).toBe(true);
    expect(reports(recipe(['tofu', 'miso'], { alergenos: ['soja'], dieta: { sin_gluten: true } }), 'sin_gluten es true con gluten en el texto (ingrediente: miso)')).toBe(true);
    expect(reports(recipe(['tofu', 'tamari sin gluten'], { alergenos: ['soja'], dieta: { sin_gluten: true } }), 'sin_gluten es true con un producto')).toBe(false);
  });

  test('sin_gluten true with nachos is flagged unless the text says "nachos sin gluten" (FRESCO-997)', () => {
    expect(reports(recipe(['aguacate', 'nachos'], { dieta: { sin_gluten: true } }), 'sin_gluten es true con un producto que suele llevar trigo o cebada (ingrediente: nachos)')).toBe(true);
    expect(reports(recipe(['aguacate', 'nachos sin gluten'], { pasos_resumen: ['Servir con nachos sin gluten'], dieta: { sin_gluten: true } }), 'sin_gluten es true')).toBe(false);
  });

  test('sin_huevo true with a dish that implies egg is flagged even though no ingredient says huevo', () => {
    expect(reports(recipe(['espinacas', 'harina'], { alergenos: ['gluten'], dieta: { sin_huevo: true }, pasos_resumen: ['Preparar la masa de crepes'] }), 'sin_huevo es true con huevo en el texto')).toBe(true);
  });

  test('vegano or vegetariano true with meat, fish or a step that adds them is flagged; "sin carne" is not meat', () => {
    expect(reports(recipe(['arroz'], { dieta: { vegetariano: true }, pasos_resumen: ['Añadir jamón picado'] }), 'vegetariano es true con carne o pescado (paso:')).toBe(true);
    expect(reports(recipe(['arroz', 'lubina'], { alergenos: ['pescado'], dieta: { vegano: true } }), 'vegano es true con carne o pescado')).toBe(true);
    expect(reports(recipe(['arroz', 'queso'], { alergenos: ['lactosa'], dieta: { vegano: true } }), 'vegano es true con lácteo, huevo o miel')).toBe(true);
    expect(reports(recipe(['arroz'], { dieta: { vegetariano: true }, pasos_resumen: ['Servir sin carne'] }), 'vegetariano')).toBe(false);
  });

  test('halal and kosher also read the steps: wine in a step breaks halal', () => {
    expect(reports(recipe(['arroz'], { dieta: { halal: true }, pasos_resumen: ['Añadir un chorro de vino blanco'] }), 'halal es true con cerdo o alcohol')).toBe(true);
  });
});

describe('findings carry a stable key for the ratchet', () => {
  test('the key is the slug (two rows can share a nombre) plus the rule, not the wording', () => {
    const keys = auditRecipeFindings(recipe(['hummus'], { slug: 'tostada-hummus-pepino' })).map(finding => finding.key);
    expect(keys).toContain('tostada-hummus-pepino|falta:sesamo');
  });
});

describe('stock and miso (FRESCO-996)', () => {
  test('every caldo requires apio, except the beans\' own cooking liquid ("su caldo")', () => {
    expect(textHasAllergen('caldo de pollo', 'apio')).toBe(true);
    expect(textHasAllergen('Añadir el caldo y cocer', 'apio')).toBe(true);
    expect(textHasAllergen('Añadir las alubias con parte de su caldo', 'apio')).toBe(false);
  });

  test('miso requires gluten and soja, unless the text says "miso sin gluten"', () => {
    expect(textHasAllergen('miso (30 g)', 'gluten')).toBe(true);
    expect(textHasAllergen('miso', 'soja')).toBe(true);
    expect(textHasAllergen('miso sin gluten', 'gluten')).toBe(false);
    expect(reports(recipe(['miso', 'edamame'], { alergenos: ['soja'], dieta: { sin_gluten: true } }), 'falta gluten (ingrediente: miso)')).toBe(true);
  });

  test('two miso recipes with the same ingredient give the same gluten result', () => {
    const tagged = recipe(['miso', 'tofu'], { alergenos: ['soja', 'gluten'], dieta: { sin_gluten: false } });
    const untagged = recipe(['miso', 'tofu'], { alergenos: ['soja'], dieta: { sin_gluten: true } });
    expect(auditRecipe(tagged)).toEqual([]);
    expect(auditRecipe(untagged).length).toBeGreaterThan(0);
  });

  test('a vegetarian or vegan recipe with an unspecified stock is flagged, with the text that proves it', () => {
    const risotto = recipe(['arroz', 'champiñones'], { dieta: { vegetariano: true }, pasos_resumen: ['Añadir el arroz y el caldo poco a poco'] });
    expect(reports(risotto, 'vegetariano es true con un caldo sin especificar')).toBe(true);
    const miso = recipe(['miso', 'tofu'], { alergenos: ['soja', 'gluten'], dieta: { vegano: true }, pasos_resumen: ['Disolver el miso en caldo caliente'] });
    expect(reports(miso, 'vegano es true con un caldo sin especificar')).toBe(true);
  });

  test('naming the vegetable stock in the ingredients clears the vegetarian check, and a non-vegetarian recipe is not asked', () => {
    const named = recipe(['arroz', 'champiñones', 'caldo de verduras'], { alergenos: ['apio'], dieta: { vegetariano: true }, pasos_resumen: ['Añadir el arroz y el caldo poco a poco'] });
    expect(reports(named, 'caldo sin especificar')).toBe(false);
    const stew = recipe(['pollo', 'arroz'], { alergenos: ['apio'], pasos_resumen: ['Añadir el caldo'] });
    expect(reports(stew, 'caldo sin especificar')).toBe(false);
  });

  test('a legume\'s own broth is not an unspecified stock', () => {
    const beans = recipe(['alubias', 'zanahoria'], { dieta: { vegano: true }, pasos_resumen: ['Añadir las alubias con parte de su caldo'] });
    expect(reports(beans, 'caldo sin especificar')).toBe(false);
  });
});
