// FRESCO-1084 — English photo prompts for FLUX-class image models.
//
// Why English and positive-only: live test 2026-11-03 on Cloudflare FLUX.1
// schnell. The old long Spanish prompt with negations ("SIN personas, SIN
// manos, no anadir ingredientes") gave 1/8 usable photos; a short English
// prompt that only says what should be visible gave 6-7/8 on the same recipes.
// Diffusion models do not understand negation (naming hands or props makes
// them appear) and read Spanish ingredient names badly (champinones -> scallops).
//
// Ingredients come from a fixed glossary instead of a translation call: the
// catalogue has ~220 distinct `ingredientes_principales`, so a lookup is free,
// deterministic and reviewable. An ingredient missing from the glossary is
// reported, never guessed: the recipe is skipped (fail-closed).

interface DishType {
  /** Word-aligned prefixes of the accent-stripped, lowercased recipe name. */
  prefixes: string[]
  /** English opening of the subject; ingredients are appended after it. */
  lead: string
  vessel: 'plate' | 'bowl' | 'glass'
  /** Replaces `lead` when the recipe does not list this ingredient (egg-less "revuelto"). */
  leadWithout?: { ingredient: string, lead: string }
  /** Ingredients the lead already implies (egg in "scrambled eggs"); left out of the list. */
  omit?: string[]
  /** Baked or set dishes: a cooking-technique cue would only misdescribe them. */
  plain?: boolean
  /** Whole subject, used when every listed ingredient was omitted (plain sponge cake, salmorejo). */
  alone?: string
}

interface Cue {
  pattern: RegExp
  cue: string
  /** The cue is dropped when the steps match this (tofu cubes vs crumbled tofu). */
  unlessSteps?: RegExp
}

export interface PhotoRecipe {
  nombre: string
  ingredientes_principales: string[]
  pasos_resumen: string[]
}

export type EnglishPromptResult
  = | { ok: true, prompt: string }
    | { ok: false, missing: string[] };

/** An empty string means "not visible in the dish": it is left out of the prompt. */
export const INGREDIENTS_EN: Record<string, string> = {
  'aceite de oliva': '',
  'aceitunas': 'whole green olives',
  'aguacate': 'sliced ripe avocado',
  'ajetes': 'sliced tender green garlic shoots',
  'ají amarillo': 'yellow aji pepper sauce',
  'ajo': 'golden garlic slices',
  'albahaca': 'fresh basil leaves',
  'alcachofas': 'artichoke hearts',
  'alcaparras': 'capers',
  'algas': 'seaweed',
  'almejas': 'clams in their shells',
  'almendras': 'sliced almonds',
  'alubias blancas': 'white beans',
  'alubias negras': 'black beans',
  'alubias rojas': 'red kidney beans',
  'anchoas': 'anchovy fillets',
  'apio': 'chopped celery',
  'arándanos': 'fresh blueberries',
  'arroz': 'cooked white rice',
  'arroz redondo': 'cooked short-grain rice',
  'atún': 'seared tuna',
  'atún en lata': 'flaked canned tuna',
  'avena': 'rolled oats',
  'azafrán': 'saffron threads',
  'azúcar': '',
  'bacalao': 'cod fillet',
  'bacalao desalado': 'cod fillet',
  'bebida de almendra': '',
  'bechamel': 'creamy bechamel sauce',
  'berenjena': 'roasted eggplant',
  'berza': 'cooked collard greens',
  'boniato': 'roasted sweet potato cubes',
  'bonito': 'tuna loin',
  'boquerones': 'fresh anchovies',
  'brócoli': 'broccoli florets',
  'cacahuetes': 'peanuts',
  'cacao': 'cocoa powder',
  'calabacín': 'sliced zucchini',
  'calabaza': 'roasted pumpkin',
  'calamar': 'squid rings',
  'calamares': 'squid rings',
  'caldo': '',
  'caldo de carne': '',
  'caldo de pollo': '',
  'caldo de verduras': '',
  'canela': 'a dusting of ground cinnamon',
  'carne': 'cooked meat',
  'carne picada': 'browned ground meat',
  'carne picada de ternera': 'browned ground beef',
  'cebolla': 'sliced onion',
  'cebolla morada': 'thin red onion slices',
  'cerveza': '',
  'champiñones': 'sliced white button mushrooms',
  'chorizo': 'sliced chorizo',
  'cilantro': 'fresh cilantro leaves',
  'clara de huevo': 'cooked egg white',
  'coco': 'coconut flakes',
  'coco rallado': 'grated coconut',
  'codornices': 'roasted quail',
  'coles de bruselas': 'halved roasted Brussels sprouts',
  'coliflor': 'cauliflower florets',
  'comino': '',
  'cordero': 'lamb',
  'costillas de cerdo': 'glazed pork ribs',
  'curry en polvo': 'a golden curry sauce',
  'cuscús': 'couscous',
  'eneldo': 'fresh dill',
  'espaguetis': 'spaghetti',
  'espárragos': 'green asparagus spears',
  'espárragos trigueros': 'wild green asparagus spears',
  'especias tikka': 'a red-orange tikka marinade',
  'espinaca': 'fresh spinach leaves',
  'espinacas': 'fresh spinach leaves',
  'fabes': 'white fabes beans',
  'fideos': 'thin noodles',
  'fideos de arroz': 'rice noodles',
  'fideos para fideua': 'short golden noodles',
  'fresas': 'sliced fresh strawberries',
  'frijoles': 'black beans',
  'frutos rojos': 'mixed red berries',
  'galleta': 'crumbled biscuit',
  'gambas': 'peeled prawns',
  'garbanzos': 'chickpeas',
  'garbanzos cocidos': 'chickpeas',
  'guisantes': 'green peas',
  'habas': 'green fava beans',
  'harina': '',
  'harina de maíz': '',
  'harina de trigo': '',
  'harina integral': '',
  'huevo': 'egg',
  'hummus': 'smooth hummus',
  'jamón': 'sliced ham',
  'jamón cocido': 'sliced cooked ham',
  'jamón ibérico': 'thin slices of Iberian ham',
  'jamón serrano': 'thin slices of serrano ham',
  'jengibre': 'thin ginger slivers',
  'judías': 'green beans',
  'judías pintas': 'pinto beans',
  'judías verdes': 'green beans',
  'judiones': 'large white beans',
  'kale': 'kale leaves',
  'laurel': '',
  'leche': '',
  'leche de coco': '',
  'lechuga': 'fresh lettuce leaves',
  'lechuga romana': 'romaine lettuce leaves',
  'lentejas': 'cooked lentils',
  'lentejas pardinas': 'cooked brown lentils',
  'levadura nutricional': '',
  'levadura química': '',
  'lima': 'lime wedges',
  'limón': 'lemon wedges',
  'lomo de cerdo': 'sliced pork loin',
  'maíz': 'sweet corn kernels',
  'maíz blanco': 'white corn kernels',
  'mango': 'diced ripe mango',
  'mantequilla': '',
  'manzana': 'diced red apple',
  'masa': '',
  'mayonesa': '',
  'mejillones': 'mussels in their shells',
  'melón': 'melon slices',
  'menta': 'fresh mint leaves',
  'merluza': 'white hake fillet',
  'miel': 'a drizzle of honey',
  'miso': '',
  'morcilla': 'sliced black pudding',
  'morcillo': 'braised beef shank',
  'mozzarella': 'melted mozzarella',
  'muslos de pollo': 'roasted chicken thighs',
  'naranja': 'orange slices',
  'nata': 'whipped cream',
  'nueces': 'chopped walnuts',
  'orégano': 'dried oregano',
  'pan': 'crusty bread',
  'pan de centeno': 'rye bread',
  'pan integral': 'whole grain bread',
  'pan rallado': 'golden breadcrumbs',
  'pan sin gluten': 'sliced bread',
  'panceta': 'crispy bacon strips',
  'parmesano': 'shaved parmesan',
  'pasas': 'raisins',
  'pasta': 'cooked pasta',
  'pasta integral': 'cooked whole wheat pasta',
  'patata': 'diced potato',
  'pato': 'roasted duck',
  'pechuga de pavo': 'sliced turkey breast',
  'pechuga de pollo': 'sliced chicken breast',
  'pepino': 'sliced cucumber',
  'pera': 'diced ripe pear',
  'perejil': 'chopped fresh parsley',
  'pescado blanco': 'white fish fillet',
  'pimentón': 'a dusting of paprika',
  'pimentón dulce': 'a dusting of sweet paprika',
  'pimentón picante': 'a dusting of hot paprika',
  'pimiento': 'sliced bell pepper',
  'pimiento choricero': 'red choricero pepper pulp',
  'pimiento rojo': 'sliced red bell pepper',
  'pimiento verde': 'sliced green bell pepper',
  'piña': 'pineapple chunks',
  'placas de canelones': 'cannelloni pasta tubes',
  'plátano': 'sliced banana rounds',
  'plátano macho': 'fried plantain slices',
  'pochas': 'fresh white pochas beans',
  'pollo': 'roasted chicken',
  'portobello': 'grilled portobello mushrooms',
  'puerro': 'sliced leek',
  'pulpo': 'sliced octopus',
  'queso': 'melted cheese',
  'queso azul': 'crumbled blue cheese',
  'queso crema': 'smooth cream cheese',
  'queso feta': 'crumbled feta cheese',
  'queso fresco': 'white fresh cheese',
  'queso parmesano': 'shaved parmesan',
  'queso rallado': 'grated cheese',
  'quinoa': 'cooked quinoa',
  'rabo de toro': 'braised oxtail',
  'remolacha': 'sliced roasted beetroot',
  'repollo': 'shredded green cabbage',
  'ricotta': 'creamy ricotta',
  'romero': 'a sprig of rosemary',
  'rúcula': 'fresh arugula leaves',
  'sal': '',
  'salmón': 'salmon fillet',
  'salmón ahumado': 'slices of smoked salmon',
  'salsa de soja': '',
  'salsa verde': 'green sauce',
  'sardinas': 'grilled sardines',
  'semillas de calabaza': 'pumpkin seeds',
  'semillas de chía': 'tiny black chia seeds',
  'semillas de girasol': 'sunflower seeds',
  'semillas de lino': 'flax seeds',
  'sémola de trigo': '',
  'sésamo': 'sesame seeds',
  'setas': 'sliced oyster mushrooms',
  'setas shiitake': 'sliced shiitake mushrooms',
  'skyr': 'creamy white skyr',
  'tamari sin gluten': '',
  'tempeh': 'tempeh',
  'ternera': 'sliced beef',
  'ternera para guisar': 'braised beef chunks',
  'ternera picada': 'browned ground beef',
  'tocino': 'crispy bacon strips',
  'tofu': 'tofu',
  'tomate': 'sliced ripe tomato',
  'tomate cherry': 'halved cherry tomatoes',
  'tomate triturado': 'a rich tomato sauce',
  'tomates cherry': 'halved cherry tomatoes',
  'tomillo': 'fresh thyme sprigs',
  'tortellini': 'tortellini',
  'tortilla de maíz': 'corn tortillas',
  'tortilla de trigo': 'a flour tortilla',
  'uvas': 'fresh grapes',
  'vainilla': '',
  'vinagre': '',
  'vino blanco': '',
  'vino tinto': '',
  'yogur': 'thick white yogurt',
  'yogur griego': 'thick Greek yogurt',
  'yogur natural': 'thick white plain yogurt',
  'zanahoria': 'sliced carrot',
};

const BATTER = ['huevo', 'yogur', 'yogur natural', 'yogur griego'];

// The first match wins, so the more specific prefix ("arroz con leche") goes
// before the general one ("arroz"). A name that matches none falls back to
// DEFAULT_DISH.
const DISH_TYPES: DishType[] = [
  { prefixes: ['tostada', 'tostadas'], lead: 'open-faced toasted bread slices topped with', vessel: 'plate' },
  { prefixes: ['sandwich', 'bocadillo'], lead: 'a sandwich cut in half showing the filling, filled with', vessel: 'plate' },
  { prefixes: ['wrap'], lead: 'a tortilla wrap rolled tightly and cut in half showing the cross section, filled with', vessel: 'plate' },
  { prefixes: ['tacos'], lead: 'three small soft tacos filled with', vessel: 'plate' },
  { prefixes: ['fajitas'], lead: 'fajitas served with warm tortillas and', vessel: 'plate' },
  { prefixes: ['quesadillas'], lead: 'a cut quesadilla filled with', vessel: 'plate' },
  { prefixes: ['bowl', 'bol', 'boles'], lead: 'a colorful bowl with', vessel: 'bowl' },
  { prefixes: ['sopa'], lead: 'a bowl of hot soup with', vessel: 'bowl' },
  { prefixes: ['crema'], lead: 'a bowl of smooth creamy pureed soup made from', vessel: 'bowl' },
  { prefixes: ['ensalada'], lead: 'a fresh salad of', vessel: 'plate' },
  { prefixes: ['batido', 'zumo'], lead: 'a tall glass of smoothie made from', vessel: 'glass' },
  { prefixes: ['tortilla'], lead: 'a thick slice of Spanish omelette with', vessel: 'plate', omit: ['huevo'] },
  {
    prefixes: ['revuelto'],
    lead: 'soft scrambled eggs with',
    leadWithout: { ingredient: 'huevo', lead: 'a soft golden scramble of' },
    vessel: 'plate',
    omit: ['huevo'],
  },
  { prefixes: ['arroz con leche'], lead: 'a bowl of creamy rice pudding topped with', vessel: 'bowl', plain: true, omit: ['arroz', 'arroz redondo'] },
  { prefixes: ['arroz', 'risotto'], lead: 'a plate of rice with', vessel: 'plate', omit: ['arroz', 'arroz redondo'] },
  { prefixes: ['pasta', 'espaguetis'], lead: 'a plate of pasta with', vessel: 'plate', omit: ['pasta', 'pasta integral', 'espaguetis'] },
  { prefixes: ['pizza'], lead: 'a pizza topped with', vessel: 'plate', plain: true },
  // Batter ingredients (egg, yogurt) are mixed in: listing them makes the model
  // draw a fried egg or a yogurt pot on the plate (live-found 2026-11-03).
  { prefixes: ['bizcocho'], lead: 'a golden sponge cake slice flavored with', alone: 'a thick slice of plain golden sponge cake', vessel: 'plate', plain: true, omit: BATTER },
  { prefixes: ['magdalenas'], lead: 'golden muffins flavored with', alone: 'three golden domed muffins', vessel: 'plate', plain: true, omit: BATTER },
  { prefixes: ['pastel'], lead: 'a slice of layered cake with', vessel: 'plate', plain: true, omit: BATTER },
  { prefixes: ['tarta'], lead: 'a slice of tart with', vessel: 'plate', plain: true, omit: BATTER },
  { prefixes: ['torrijas'], lead: 'golden fried French toast slices with', vessel: 'plate', plain: true, omit: BATTER },
  { prefixes: ['rosquillas'], lead: 'ring-shaped golden doughnuts with', vessel: 'plate', plain: true, omit: BATTER },
  { prefixes: ['panqueques'], lead: 'a stack of fluffy pancakes with', vessel: 'plate', plain: true, omit: BATTER },
  { prefixes: ['pudding', 'natillas'], lead: 'a small bowl of creamy pudding with', vessel: 'bowl', plain: true },
  { prefixes: ['gachas'], lead: 'a bowl of thick creamy pale sweet porridge topped with', alone: 'a bowl of thick creamy pale sweet porridge', vessel: 'bowl', plain: true, omit: ['harina', 'leche'] },
  // Tinga is a pulled, saucy dish; whole sliced mushrooms looked like snails.
  { prefixes: ['tinga de setas'], lead: 'a rustic bowl of pulled shredded oyster mushrooms in a smoky red tomato sauce with', alone: 'a rustic bowl of pulled shredded oyster mushrooms in a smoky red tomato sauce', vessel: 'bowl', omit: ['setas', 'tomate triturado'] },
  // Cold blended soups are tomato or potato PUREE: the glossary phrases for the
  // raw vegetables would draw them on the side (live-found: salmorejo = tomato
  // slices and bread), so the base ingredients are left out.
  // No "olive oil" wording in these prompts: "drizzled with olive oil" made the
  // model draw a bottle with a readable brand label (live-found 2026-11-03).
  { prefixes: ['salmorejo'], lead: 'a bowl of thick smooth cold orange-pink tomato cream topped with', alone: 'a bowl of thick smooth cold orange-pink tomato cream with a glossy surface', vessel: 'bowl', plain: true, omit: ['tomate', 'pan'] },
  { prefixes: ['gazpacho'], lead: 'a bowl of smooth cold red tomato soup with', alone: 'a bowl of smooth cold red tomato soup with a glossy surface', vessel: 'bowl', plain: true, omit: ['tomate', 'pan', 'pepino', 'pimiento'] },
  { prefixes: ['vichyssoise'], lead: 'a bowl of smooth cold creamy leek and potato soup topped with', alone: 'a bowl of smooth cold creamy leek and potato soup with chives', vessel: 'bowl', plain: true, omit: ['patata', 'puerro'] },
  {
    prefixes: ['cocido', 'potaje', 'pozole', 'marmitako', 'chili', 'dal', 'seco', 'lentejas', 'alubias', 'judiones', 'pochas', 'fabes'],
    lead: 'a bowl of hearty stew with',
    vessel: 'bowl',
  },
  { prefixes: ['lassi'], lead: 'a tall glass of creamy lassi made from', vessel: 'glass', plain: true },
  { prefixes: ['yogur'], lead: 'a bowl of', vessel: 'bowl' },
  { prefixes: ['fideua'], lead: 'a shallow pan of golden noodle paella with', vessel: 'plate', plain: true },
  { prefixes: ['migas'], lead: 'a plate of crispy fried breadcrumbs with', vessel: 'plate' },
];

const DEFAULT_DISH: DishType = { prefixes: [], lead: 'a plated dish of', vessel: 'plate' };

// Cooking-technique cues that change how the WHOLE dish looks, matched on the
// accent-stripped, lowercased steps. Same idea as TEXTURE_CUES in the old
// Spanish builder (found live on a "tofu revuelto" miss), rewritten as
// positive English. Prep verbs on a single ingredient (picar, rallar, batir
// huevos) are left out on purpose: they would describe the whole plate wrong.
const CRUMBLE_CUE = 'finely crumbled into small irregular pieces like scrambled egg';

const TECHNIQUE_CUES: Cue[] = [
  { pattern: /\bplancha/, cue: 'seared with visible grill marks' },
  { pattern: /\bhorno|\bhornea|\basad[oa]/, cue: 'oven-roasted with a golden browned surface' },
  { pattern: /\bguisa|\bestofad[oa]/, cue: 'stewed in a thick sauce' },
  { pattern: /\bsalte/, cue: 'sauteed with a light golden color' },
];

// Base-form cues for ingredients the model confuses (tempeh as toast, tofu as
// cheese). Live-found 2026-09-12; kept, translated, positive-only.
const SHAPE_CUES: Cue[] = [
  { pattern: /\btempeh\b/, cue: 'tempeh as a compact porous block with small irregular holes and a dense fibrous texture' },
  { pattern: /\btofu\b/, cue: 'tofu as golden cubes with a smooth surface', unlessSteps: /\bdesmenuza/ },
];

// Long ingredient lists dilute the model's attention; the catalogue lists the
// main ingredients first, so the first few carry the dish.
const MAX_VISIBLE_INGREDIENTS = 5;

const STYLE_SUFFIX = 'soft natural window light, shallow depth of field, sharp realistic texture, restaurant quality.';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function pickDish(nombre: string): DishType {
  const name = normalize(nombre);
  return DISH_TYPES.find(d => d.prefixes.some(p => name === p || name.startsWith(`${p} `))) ?? DEFAULT_DISH;
}

function firstCue(table: Cue[], text: string, steps = ''): string | null {
  return table.find(({ pattern, unlessSteps }) => pattern.test(text) && !unlessSteps?.test(steps))?.cue ?? null;
}

function frame(subject: string, vessel: DishType['vessel']): string {
  return `Professional overhead food photograph of ${subject}. Single white ${vessel} on a plain light grey surface, ${STYLE_SUFFIX}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) { return items.join(''); }
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export function buildEnglishPrompt(recipe: PhotoRecipe): EnglishPromptResult {
  const ingredients = recipe.ingredientes_principales ?? [];
  const missing = ingredients.filter(i => !(i.toLowerCase().trim() in INGREDIENTS_EN));
  if (missing.length > 0) { return { ok: false, missing }; }

  const dish = pickDish(recipe.nombre);
  const visible = ingredients
    .filter(i => !dish.omit?.includes(i.toLowerCase().trim()))
    .map(i => INGREDIENTS_EN[i.toLowerCase().trim()])
    .filter((phrase): phrase is string => Boolean(phrase))
    .slice(0, MAX_VISIBLE_INGREDIENTS);
  if (visible.length === 0) {
    if (!dish.alone) { return { ok: false, missing: ['(no visible ingredient)'] }; }
    return { ok: true, prompt: frame(dish.alone, dish.vessel) };
  }

  const steps = normalize((recipe.pasos_resumen ?? []).join(' '));
  // An egg-less "revuelto" is a tofu scramble even when its steps never say
  // "desmenuzar": without this the model kept drawing tofu cubes.
  const hasEgg = ingredients.some(i => i.toLowerCase().trim() === 'huevo');
  const crumbled = /\bdesmenuza/.test(steps) || (/\brevuelto/.test(normalize(recipe.nombre)) && !hasEgg);
  const technique = dish.plain ? null : crumbled ? CRUMBLE_CUE : firstCue(TECHNIQUE_CUES, steps);
  const cues = [technique, firstCue(SHAPE_CUES, normalize(ingredients.join(' ')), crumbled ? 'desmenuza' : steps)]
    .filter((c): c is string => c !== null);

  const hasLeadIngredient = !dish.leadWithout || ingredients.some(i => i.toLowerCase().trim() === dish.leadWithout!.ingredient);
  const lead = hasLeadIngredient ? dish.lead : dish.leadWithout!.lead;
  const subject = `${lead} ${joinList(visible)}${cues.length ? `, ${cues.join(', ')}` : ''}`;
  return { ok: true, prompt: frame(subject, dish.vessel) };
}
