import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { STEPS } from './how-it-works';
import { TIMELINE } from './learns-pro';
import { FREE_FEATURES, PRO_FEATURES } from './pricing';

/**
 * FRESCO-791 (A6-P3/P4) — copy-vs-feature contract for the landing.
 *
 * Every behavioural claim the landing makes (Pro learning timeline, the
 * menu and shopping-list steps, both pricing columns) needs a row here naming
 * the code that backs it. A new or reworded claim with no row fails the first test; a row
 * whose source no longer contains its evidence fails the second. Same family
 * as A4-H11 / A5-H7: the landing must not promise what the engine does not do.
 */

interface Source {
  file: string
  pattern: RegExp
}

const GENERATE = 'supabase/functions/generate-meal-plan/index.ts';
const SELECTOR = 'supabase/functions/generate-meal-plan/menu-selector.ts';
const PROFILE_FILTER: Source = { file: GENERATE, pattern: /selectMenu\(\{[\s\S]*?profile/ };
const EXCLUDE_MARKED: Source[] = [
  { file: GENERATE, pattern: /get_recent_recipe_marks[\s\S]*?p_weeks: 2/ },
  { file: GENERATE, pattern: /estado === 'cocinada' \|\| mark\.estado === 'descartada'/ },
  { file: SELECTOR, pattern: /excluded\.has\(r\.id\)/ },
];
const ENGAGEMENT: Source[] = [
  { file: SELECTOR, pattern: /engagement\.cocinada/ },
  { file: SELECTOR, pattern: /engagement\.descartada/ },
];
const EXPLANATION: Source = { file: GENERATE, pattern: /buildLearningExplanation\(/ };

const CLAIMS: Record<string, Source[]> = {
  // learns-pro.tsx — TIMELINE (Pro)
  'Generado desde tu perfil. Personalizado desde el primer día.': [PROFILE_FILTER],
  'Marca lo que cocinas y lo que descartas. La semana siguiente esas recetas no vuelven.': EXCLUDE_MARKED,
  'Las recetas que cocinas con frecuencia ganan peso en tu menú y las que descartas, lo pierden.': ENGAGEMENT,
  'Cada menú trae una nota con lo que Fresco ha tenido en cuenta de lo que cocinas.': [EXPLANATION],
  // how-it-works.tsx — STEPS (FRESCO-1134: the repeat-free claim of the removed impact-stats section
  // moved into step 2; the aisle claim was already step 3)
  '21 platos de lunes a domingo, ajustados a vosotros y sin comidas ni cenas repetidas en la misma semana. Cambia lo que no te convenza con un toque.': [
    PROFILE_FILTER,
    { file: SELECTOR, pattern: /usedLunchDinner\.has/ },
  ],
  'Ingredientes agrupados por pasillos. Marca lo que ya tienes. Ve al súper con la cabeza despejada.': [
    { file: 'supabase/functions/generate-shopping-list/index.ts', pattern: /pasillo|categoria/i },
  ],
  // pricing.tsx — FREE_FEATURES
  'Menú semanal completo': [{ file: GENERATE, pattern: /selectMenu\(/ }],
  'Lista de la compra automática': [{ file: 'supabase/functions/generate-shopping-list/index.ts', pattern: /./ }],
  'Filtros de dieta y alergias': [{ file: GENERATE, pattern: /get_filtered_recipes/ }],
  'Cambia cualquier receta y regenera el slot': [{ file: 'supabase/functions/update-recipe-status/index.ts', pattern: /sustituida/ }],
  // pricing.tsx — PRO_FEATURES
  'Aprende de lo que cocinas y lo que descartas': ENGAGEMENT,
  'No repite las recetas que cocinaste o descartaste hace poco': EXCLUDE_MARKED,
  'Te explica por qué eligió cada receta': [EXPLANATION],
};

const RENDERED_CLAIMS: string[] = [
  ...TIMELINE.map(item => item.description),
  STEPS[1].description,
  STEPS[2].description,
  ...FREE_FEATURES,
  ...PRO_FEATURES,
];

const read = (file: string) => readFileSync(file, 'utf8');

describe('landing copy vs feature', () => {
  test.each(RENDERED_CLAIMS)('claim has a row naming its source: %s', (claim) => {
    expect(Object.keys(CLAIMS)).toContain(claim);
  });

  test.each(Object.entries(CLAIMS))('claim is backed by code: %s', (_claim, sources) => {
    expect(sources.length).toBeGreaterThan(0);
    for (const { file, pattern } of sources) {
      expect(read(file)).toMatch(pattern);
    }
  });

  test('registry has no stale rows for copy that no longer exists', () => {
    for (const claim of Object.keys(CLAIMS)) {
      expect(RENDERED_CLAIMS).toContain(claim);
    }
  });
});
