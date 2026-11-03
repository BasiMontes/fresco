import { describe, expect, test } from 'bun:test';
import { buildEnglishPrompt, INGREDIENTS_EN } from './photo-prompt-en.ts';

describe('buildEnglishPrompt', () => {
  test('builds a positive-only English prompt from the recipe fields', () => {
    const result = buildEnglishPrompt({
      nombre: 'Skyr con fresas y chía',
      ingredientes_principales: ['skyr', 'fresas', 'semillas de chía'],
      pasos_resumen: ['Servir el skyr en un bol'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    expect(result.prompt).toContain('creamy white skyr, sliced fresh strawberries and tiny black chia seeds');
    expect(result.prompt).toStartWith('Professional overhead food photograph of');
    expect(result.prompt).not.toMatch(/\b(no|without|sin)\b/i);
  });

  test('uses the dish type from the first word of the name', () => {
    const result = buildEnglishPrompt({
      nombre: 'Wrap de pavo y manzana',
      ingredientes_principales: ['tortilla de trigo', 'pechuga de pavo', 'manzana'],
      pasos_resumen: [],
    });

    expect(result.ok && result.prompt).toContain('a tortilla wrap rolled tightly');
  });

  test('picks a glass for smoothies and a bowl for soups', () => {
    const batido = buildEnglishPrompt({ nombre: 'Batido de fresas', ingredientes_principales: ['fresas'], pasos_resumen: [] });
    const sopa = buildEnglishPrompt({ nombre: 'Sopa de calabaza', ingredientes_principales: ['calabaza'], pasos_resumen: [] });

    expect(batido.ok && batido.prompt).toContain('Single white glass');
    expect(sopa.ok && sopa.prompt).toContain('Single white bowl');
  });

  test('leaves invisible ingredients (salt, stock, oil) out of the prompt', () => {
    const result = buildEnglishPrompt({
      nombre: 'Champiñones al ajillo',
      ingredientes_principales: ['champiñones', 'ajo', 'aceite de oliva', 'sal'],
      pasos_resumen: ['Saltear los champiñones'],
    });

    expect(result.ok && result.prompt).toContain('sliced white button mushrooms and golden garlic slices');
    expect(result.ok && result.prompt).not.toContain('oil');
  });

  test('adds the technique cue found in the steps', () => {
    const result = buildEnglishPrompt({
      nombre: 'Tofu revuelto estilo mexicano',
      ingredientes_principales: ['tofu', 'pimiento'],
      pasos_resumen: ['Desmenuzar el tofu en la sartén'],
    });

    expect(result.ok && result.prompt).toContain('crumbled into small irregular pieces');
  });

  test('crumbles an egg-less revuelto even when the steps never say desmenuzar', () => {
    const vegan = buildEnglishPrompt({ nombre: 'Revuelto de cúrcuma y ajo', ingredientes_principales: ['tofu', 'ajo'], pasos_resumen: ['Saltear el tofu con cúrcuma'] });
    const eggs = buildEnglishPrompt({ nombre: 'Revuelto de gambas', ingredientes_principales: ['huevo', 'gambas'], pasos_resumen: [] });

    expect(vegan.ok && vegan.prompt).toContain('finely crumbled');
    expect(vegan.ok && vegan.prompt).not.toContain('golden cubes');
    expect(eggs.ok && eggs.prompt).not.toContain('crumbled');
  });

  test('never mentions olive oil, which draws a branded bottle', () => {
    const result = buildEnglishPrompt({ nombre: 'Salmorejo cordobés', ingredientes_principales: ['tomate', 'pan', 'aceite de oliva'], pasos_resumen: [] });

    expect(result.ok && result.prompt).not.toMatch(/olive oil/i);
  });

  test('describes tinga as pulled mushrooms and gachas as a porridge', () => {
    const tinga = buildEnglishPrompt({ nombre: 'Tinga de setas', ingredientes_principales: ['setas', 'cebolla', 'tomate triturado'], pasos_resumen: [] });
    const gachas = buildEnglishPrompt({ nombre: 'Gachas dulces andaluzas', ingredientes_principales: ['harina', 'leche', 'canela'], pasos_resumen: [] });

    expect(tinga.ok && tinga.prompt).toContain('pulled shredded oyster mushrooms');
    expect(gachas.ok && gachas.prompt).toContain('thick creamy pale sweet porridge topped with a dusting of ground cinnamon');
  });

  test('does not ask for tofu cubes when the tofu is crumbled', () => {
    const crumbled = buildEnglishPrompt({ nombre: 'Tofu revuelto', ingredientes_principales: ['tofu'], pasos_resumen: ['Desmenuzar el tofu'] });
    const cubed = buildEnglishPrompt({ nombre: 'Tofu a la plancha', ingredientes_principales: ['tofu'], pasos_resumen: ['Cortar y dorar a la plancha'] });

    expect(crumbled.ok && crumbled.prompt).not.toContain('cubes');
    expect(cubed.ok && cubed.prompt).toContain('tofu as golden cubes');
  });

  test('describes an egg-less revuelto as a scramble, not as scrambled eggs', () => {
    const vegan = buildEnglishPrompt({ nombre: 'Revuelto de cúrcuma y ajo', ingredientes_principales: ['tofu', 'ajo'], pasos_resumen: [] });
    const eggs = buildEnglishPrompt({ nombre: 'Revuelto de gambas', ingredientes_principales: ['huevo', 'gambas'], pasos_resumen: [] });

    expect(vegan.ok && vegan.prompt).toContain('a soft golden scramble of');
    expect(eggs.ok && eggs.prompt).toContain('soft scrambled eggs with peeled prawns');
  });

  test('matches the most specific dish prefix and drops the ingredient it repeats', () => {
    const pudding = buildEnglishPrompt({ nombre: 'Arroz con leche', ingredientes_principales: ['arroz', 'leche', 'canela'], pasos_resumen: [] });
    const rice = buildEnglishPrompt({ nombre: 'Arroz con espinacas', ingredientes_principales: ['arroz', 'espinacas'], pasos_resumen: [] });

    expect(pudding.ok && pudding.prompt).toContain('a bowl of creamy rice pudding topped with a dusting of ground cinnamon');
    expect(rice.ok && rice.prompt).toContain('a plate of rice with fresh spinach leaves');
  });

  test('skips whole-dish technique cues for baked and set dishes', () => {
    const result = buildEnglishPrompt({ nombre: 'Bizcocho de naranja', ingredientes_principales: ['harina', 'naranja'], pasos_resumen: ['Hornear 30 minutos'] });

    expect(result.ok && result.prompt).not.toContain('oven-roasted');
  });

  test('keeps batter ingredients out of cakes so no fried egg is drawn', () => {
    const result = buildEnglishPrompt({ nombre: 'Bizcocho de naranja', ingredientes_principales: ['huevo', 'naranja', 'harina'], pasos_resumen: [] });

    expect(result.ok && result.prompt).toContain('a golden sponge cake slice flavored with orange slices');
    expect(result.ok && result.prompt).not.toContain('egg');
  });

  test('falls back to the dish alone when every listed ingredient is omitted', () => {
    const result = buildEnglishPrompt({ nombre: 'Bizcocho de yogur', ingredientes_principales: ['yogur', 'huevo', 'harina'], pasos_resumen: [] });

    expect(result.ok && result.prompt).toContain('a thick slice of plain golden sponge cake');
  });

  test('draws salmorejo as a cream, not as raw tomato slices and bread', () => {
    const result = buildEnglishPrompt({ nombre: 'Salmorejo cordobés', ingredientes_principales: ['tomate', 'pan', 'jamón serrano', 'huevo'], pasos_resumen: [] });

    expect(result.ok && result.prompt).toContain('thick smooth cold orange-pink tomato cream');
    expect(result.ok && result.prompt).not.toContain('sliced ripe tomato');
  });

  test('caps the ingredient list so the model keeps its focus', () => {
    const result = buildEnglishPrompt({
      nombre: 'Bowl grande',
      ingredientes_principales: ['quinoa', 'aguacate', 'tomate', 'pepino', 'zanahoria', 'maíz', 'lima'],
      pasos_resumen: [],
    });

    expect(result.ok && result.prompt).toContain('sliced carrot');
    expect(result.ok && result.prompt).not.toContain('sweet corn');
  });

  test('fails closed on an ingredient missing from the glossary', () => {
    const result = buildEnglishPrompt({
      nombre: 'Plato raro',
      ingredientes_principales: ['skyr', 'ingrediente inventado'],
      pasos_resumen: [],
    });

    expect(result).toEqual({ ok: false, missing: ['ingrediente inventado'] });
  });

  test('fails closed when nothing in the dish would be visible', () => {
    const result = buildEnglishPrompt({ nombre: 'Caldo', ingredientes_principales: ['sal', 'caldo'], pasos_resumen: [] });

    expect(result.ok).toBe(false);
  });
});

describe('INGREDIENTS_EN', () => {
  test('has lowercase keys only, so lookups by lowercased name work', () => {
    const offenders = Object.keys(INGREDIENTS_EN).filter(k => k !== k.toLowerCase().trim());

    expect(offenders).toEqual([]);
  });
});
