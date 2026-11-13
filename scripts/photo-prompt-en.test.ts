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
    expect(result.prompt).toStartWith('Natural overhead food photograph of');
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

    expect(batido.ok && batido.prompt).toContain('eye-level');
    expect(batido.ok && batido.prompt).toContain('drinking glass');
    expect(sopa.ok && sopa.prompt).toContain('overhead');
    expect(sopa.ok && sopa.prompt).toMatch(/Served in a [^,]*bowl/);
  });

  test('does not read as a studio shot: no professional or restaurant wording, home-cooked cues instead', () => {
    const result = buildEnglishPrompt({ nombre: 'Ensalada griega', ingredientes_principales: ['tomate', 'pepino', 'queso feta'], pasos_resumen: [] });

    expect(result.ok && result.prompt).not.toMatch(/professional|restaurant|single white/i);
    expect(result.ok && result.prompt).toContain('home-cooked plating');
    expect(result.ok && result.prompt).toContain('off-center');
  });

  test('varies the tableware and surface across recipes but never for the same recipe', () => {
    const names = ['Tortilla de patatas', 'Ensalada griega', 'Pasta con tomate', 'Pollo asado', 'Lentejas con arroz', 'Tarta de queso', 'Pisto con huevo', 'Merluza en salsa verde'];
    const build = (nombre: string) => {
      const result = buildEnglishPrompt({ nombre, ingredientes_principales: ['tomate'], pasos_resumen: [] });
      return result.ok ? result.prompt.split('. Served in ')[1] : '';
    };

    expect(build('Ensalada griega')).toBe(build('Ensalada griega'));
    expect(new Set(names.map(build)).size).toBeGreaterThan(3);
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

  // FRESCO-1132, 2026-11-06 batch review: each of these came out as the wrong dish or the wrong ingredient
  // because the ingredient list alone does not say the dish's shape.
  describe('dishes whose shape the ingredient list does not give', () => {
    const cases: { nombre: string, ingredientes: string[], expected: string[], forbidden?: string[] }[] = [
      { nombre: 'Buñuelos de manzana', ingredientes: ['manzana', 'huevo', 'canela'], expected: ['round puffy golden fried fritters', 'filled with diced red apple'], forbidden: ['egg'] },
      { nombre: 'Galletas de avena y plátano', ingredientes: ['avena', 'plátano', 'canela'], expected: ['baked oat cookies', 'sliced banana rounds'], forbidden: ['rolled oats'] },
      { nombre: 'Merluza a la romana', ingredientes: ['merluza', 'huevo'], expected: ['battered fried hake pieces'], forbidden: ['egg', 'white hake fillet'] },
      { nombre: 'Albondigas en salsa', ingredientes: ['ternera picada', 'tomate', 'cebolla'], expected: ['six round browned meatballs', 'sliced onion'], forbidden: ['ground beef', 'sliced ripe tomato'] },
      { nombre: 'Huevos poché con espárragos', ingredientes: ['huevo', 'espárragos trigueros'], expected: ['poached egg', 'runny yolk', 'wild green asparagus spears'], forbidden: ['sauteed'] },
      { nombre: 'Bacalao a la vizcaína', ingredientes: ['bacalao', 'pimiento choricero', 'tomate'], expected: ['deep red-orange pepper sauce', 'sliced ripe tomato'], forbidden: ['pulp'] },
      { nombre: 'Sopa de ajo con huevo', ingredientes: ['pan', 'ajo', 'huevo'], expected: ['clear amber garlic soup', 'poached egg'], forbidden: ['golden garlic slices'] },
      { nombre: 'Coca de pimiento rojo y anchoas', ingredientes: ['pimiento rojo', 'cebolla', 'anchoas'], expected: ['thin crisp flatbread', 'thin silvery-brown anchovy fillets'] },
      { nombre: 'Escalivada con anchoas', ingredientes: ['berenjena', 'pimiento', 'anchoas'], expected: ['roasted vegetable strips', 'thin silvery-brown anchovy fillets'] },
      { nombre: 'Champiñones rellenos de ajo con cilantro', ingredientes: ['champiñones', 'tempeh', 'ajo', 'cilantro'], expected: ['whole mushroom caps stuffed with'], forbidden: ['porous block', 'sliced white button mushrooms'] },
      { nombre: 'Tofu al curry verde con aceitunas', ingredientes: ['tofu', 'calabacín', 'aceitunas'], expected: ['creamy pale green coconut curry sauce', 'whole green olives'], forbidden: ['smooth surface'] },
      { nombre: 'Marmitako de bonito', ingredientes: ['bonito', 'patata', 'cebolla'], expected: ['hearty stew', 'chunks of tuna fish with pink-red flesh'], forbidden: ['tuna loin'] },
      { nombre: 'Fabada asturiana', ingredientes: ['fabes', 'chorizo', 'morcilla'], expected: ['hearty stew', 'white fabes beans'] },
      { nombre: 'Panzanella de tomate y pepino', ingredientes: ['pan', 'tomate', 'pepino'], expected: ['toasted bread cubes', 'sliced ripe tomato'], forbidden: ['crusty bread'] },
      { nombre: 'Ensalada de pasta con mozzarella', ingredientes: ['pasta', 'tomate cherry', 'mozzarella'], expected: ['cold pasta salad of fusilli', 'fresh white mozzarella balls'], forbidden: ['melted'] },
      { nombre: 'Batido de cacao y plátano', ingredientes: ['plátano', 'cacao'], expected: ['dark chocolate-brown smoothie'] },
    ];

    for (const { nombre, ingredientes, expected, forbidden = [] } of cases) {
      test(`${nombre}`, () => {
        const result = buildEnglishPrompt({ nombre, ingredientes_principales: ingredientes, pasos_resumen: ['Hornear y saltear'] });

        expect(result.ok).toBe(true);
        if (!result.ok) { return; }
        for (const text of expected) { expect(result.prompt).toContain(text); }
        for (const text of forbidden) { expect(result.prompt).not.toContain(text); }
        expect(result.prompt).not.toMatch(/\b(no|without|sin)\b/i);
        expect(result.prompt.length).toBeLessThan(2048);
      });
    }
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

describe('buildEnglishPrompt in the clay style', () => {
  const sopa = { nombre: 'Sopa de calabaza', ingredientes_principales: ['calabaza'], pasos_resumen: [] };
  const batido = { nombre: 'Batido de fresas', ingredientes_principales: ['fresas'], pasos_resumen: [] };
  const ensalada = { nombre: 'Ensalada griega', ingredientes_principales: ['tomate', 'pepino', 'queso feta'], pasos_resumen: [] };

  test('frames the dish as a matte clay 3D icon, with no photograph, tableware or table', () => {
    const result = buildEnglishPrompt(ensalada, 'clay');

    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    expect(result.prompt).toStartWith('Soft matte clay 3D icon of');
    expect(result.prompt).toContain('feta');
    expect(result.prompt).not.toMatch(/photograph|Served in|tablecloth|window|grain/i);
    expect(result.prompt).toContain('the object fills most of the frame');
  });

  test('keeps the palette in the background only, so the food keeps its natural colors', () => {
    const result = buildEnglishPrompt(sopa, 'clay');

    expect(result.ok && result.prompt).toContain('natural food colors');
    expect(result.ok && result.prompt).toContain('soft cream background with a faint warm green glow');
    expect(result.ok && result.prompt).not.toMatch(/\b(orange|green) (soup|dish|food)\b/i);
  });

  test('avoids the wording of the two style prompts Cloudflare rejected as NSFW, and stays positive-only', () => {
    for (const recipe of [sopa, batido, ensalada]) {
      const result = buildEnglishPrompt(recipe, 'clay');
      expect(result.ok).toBe(true);
      if (!result.ok) { continue; }
      expect(result.prompt).not.toMatch(/\b(inflated|plump|jelly|glossy|highlights)\b/i);
      expect(result.prompt).not.toMatch(/\b(no|without|sin)\b/i);
      expect(result.prompt.length).toBeLessThanOrEqual(2048);
    }
  });

  test('still fails closed on an ingredient missing from the glossary', () => {
    const result = buildEnglishPrompt({ nombre: 'Sopa rara', ingredientes_principales: ['ingrediente-que-no-existe'], pasos_resumen: [] }, 'clay');

    expect(result.ok).toBe(false);
  });

  test('leaves the photo prompt untouched when no style is given', () => {
    expect(buildEnglishPrompt(ensalada)).toEqual(buildEnglishPrompt(ensalada, 'photo'));
    const photo = buildEnglishPrompt(ensalada);
    expect(photo.ok && photo.prompt).toStartWith('Natural overhead food photograph of');
  });
});

/** FRESCO-1206: the words Cloudflare's input filter rejected (FRESCO-1146, owner) plus the ones kept out as a precaution. */
const FILTER_WORDS = /glaz|drizzl|whipped|silky|glossy|creamy|melted|juicy|moist|dripping|oozing/i;

describe('buildEnglishPrompt: the scrambled-egg cue (FRESCO-1206)', () => {
  test('is not added to a dish where only one ingredient is crumbled', () => {
    const feta = buildEnglishPrompt({ nombre: 'Pasta integral con calabacín y feta', ingredientes_principales: ['pasta integral', 'calabacín', 'queso feta'], pasos_resumen: ['Cocer la pasta', 'Desmenuzar el feta por encima'] }, 'clay');
    const fish = buildEnglishPrompt({ nombre: 'Tacos de pescado con repollo', ingredientes_principales: ['pescado blanco', 'repollo', 'lima', 'tortilla de maíz'], pasos_resumen: ['Desmenuzar el pescado cocinado'] }, 'clay');

    expect(feta.ok).toBe(true);
    expect(fish.ok).toBe(true);
    expect(feta.ok && feta.prompt).not.toContain('scrambled egg');
    expect(fish.ok && fish.prompt).not.toContain('scrambled egg');
  });

  test('is still added when the dish is crumbled tofu, tempeh or an egg-less revuelto', () => {
    const tofu = buildEnglishPrompt({ nombre: 'Tofu salteado', ingredientes_principales: ['tofu', 'pimiento'], pasos_resumen: ['Desmenuzar el tofu'] }, 'clay');
    const tempeh = buildEnglishPrompt({ nombre: 'Tempeh al horno', ingredientes_principales: ['tempeh', 'cebolla'], pasos_resumen: ['Desmenuzar el tempeh'] }, 'clay');
    const revuelto = buildEnglishPrompt({ nombre: 'Revuelto de cúrcuma y ajo', ingredientes_principales: ['tofu', 'ajo'], pasos_resumen: [] }, 'clay');

    expect(tofu.ok && tofu.prompt).toContain('scrambled egg');
    expect(tempeh.ok && tempeh.prompt).toContain('scrambled egg');
    expect(revuelto.ok && revuelto.prompt).toContain('scrambled egg');
  });
});

describe('buildEnglishPrompt in the clay style: wording the Cloudflare filter rejects (FRESCO-1206)', () => {
  test('no glossary entry reaches a clay prompt with a filtered word', () => {
    const offenders = Object.keys(INGREDIENTS_EN).flatMap((ingredient) => {
      const result = buildEnglishPrompt({ nombre: 'Plato de prueba', ingredientes_principales: [ingredient], pasos_resumen: [] }, 'clay');
      return result.ok && FILTER_WORDS.test(result.prompt) ? [`${ingredient}: ${result.prompt}`] : [];
    });

    expect(offenders).toEqual([]);
  });

  test('dishes whose own lead wording is filtered are cleaned too', () => {
    const dishes = ['Salmorejo cordobés', 'Gazpacho andaluz con pepino', 'Bacalao a la vizcaína', 'Gachas dulces andaluzas', 'Pizza margarita casera'];
    const offenders = dishes.flatMap((nombre) => {
      const result = buildEnglishPrompt({ nombre, ingredientes_principales: ['tomate', 'pimiento', 'leche', 'harina', 'mozzarella'], pasos_resumen: [] }, 'clay');
      // A prompt that was not built would pass the check below for the wrong reason.
      if (!result.ok) { return [`${nombre}: no prompt (missing ${result.missing.join(', ')})`]; }
      return FILTER_WORDS.test(result.prompt) ? [`${nombre}: ${result.prompt}`] : [];
    });

    expect(offenders).toEqual([]);
  });

  test('says the replacement words instead, so the dish keeps its meaning', () => {
    const eggplant = buildEnglishPrompt({ nombre: 'Berenjena asada', ingredientes_principales: ['berenjena'], pasos_resumen: [] }, 'clay');
    const honey = buildEnglishPrompt({ nombre: 'Torrijas', ingredientes_principales: ['miel'], pasos_resumen: [] }, 'clay');

    expect(eggplant.ok && eggplant.prompt).toContain('smooth roasted eggplant');
    expect(honey.ok && honey.prompt).toContain('a little honey');
  });

  test('leaves the photo style untouched', () => {
    const gachas = buildEnglishPrompt({ nombre: 'Gachas dulces andaluzas', ingredientes_principales: ['harina', 'leche', 'canela'], pasos_resumen: [] });

    expect(gachas.ok && gachas.prompt).toContain('thick creamy pale sweet porridge');
  });
});

describe('INGREDIENTS_EN', () => {
  test('has lowercase keys only, so lookups by lowercased name work', () => {
    const offenders = Object.keys(INGREDIENTS_EN).filter(k => k !== k.toLowerCase().trim());

    expect(offenders).toEqual([]);
  });
});
