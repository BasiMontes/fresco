import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { normalizeNombre } from '@/lib/text/normalize-nombre';

/**
 * FRESCO-826 — is the supermarket product linked to an ingredient compatible
 * with the shopper's diet and allergens? Pure, no I/O, and it takes only the
 * profile fields already loaded in the client, never an identity (ADR-0032).
 *
 * It complements `esProductoPlausible` (FRESCO-785), which is profile-blind.
 * The catalogs hold ONE product per canonical ingredient, so there is no other
 * candidate to fall back to: an incompatible product means the ingredient shows
 * no link and no catalog price, never a wrong product.
 *
 * It judges the product NAME. When the ingredient itself already names a
 * flagged word ("queso", "leche de almendra") the menu filter owns that
 * conflict, so only words the product adds are held against it.
 */

export interface PerfilCompra {
  vegetariano?: boolean
  vegano?: boolean
  halal?: boolean
  sinGluten?: boolean
  sinLactosa?: boolean
  sinHuevo?: boolean
  alergenos?: readonly string[]
}

type Prefs = Partial<Pick<OnboardingProfilePayload, 'dieta_vegetariano' | 'dieta_vegano' | 'dieta_halal' | 'dieta_sin_gluten' | 'dieta_sin_lactosa' | 'dieta_sin_huevo' | 'alergenos'>>;

/** The profile fields the product check reads, or `undefined` when there is nothing to check against. */
export function perfilCompraDesde(prefs: Prefs | null | undefined): PerfilCompra | undefined {
  if (!prefs) { return undefined; }
  return {
    vegetariano: prefs.dieta_vegetariano,
    vegano: prefs.dieta_vegano,
    halal: prefs.dieta_halal,
    sinGluten: prefs.dieta_sin_gluten,
    sinLactosa: prefs.dieta_sin_lactosa,
    sinHuevo: prefs.dieta_sin_huevo,
    alergenos: prefs.alergenos,
  };
}

const CARNE = ['carne', 'pollo', 'pavo', 'ternera', 'cerdo', 'cordero', 'conejo', 'buey', 'vacuno', 'pato', 'jamon', 'chorizo', 'salchicha', 'salchichon', 'mortadela', 'bacon', 'panceta', 'tocino', 'lomo', 'morcilla', 'higado', 'embutido', 'fiambre', 'hamburguesa', 'albondiga', 'mixta', 'mixto'];
const PESCADO = ['pescado', 'atun', 'salmon', 'merluza', 'bacalao', 'anchoa', 'sardina', 'caballa', 'bonito', 'lubina', 'dorada', 'rape', 'trucha', 'surimi'];
const CRUSTACEOS = ['gamba', 'langostino', 'cangrejo', 'cigala', 'langosta', 'bogavante', 'marisco'];
const MOLUSCOS = ['mejillon', 'calamar', 'pulpo', 'sepia', 'almeja', 'berberecho', 'vieira', 'caracol', 'marisco'];
const LACTEOS = ['leche', 'queso', 'yogur', 'yogurt', 'nata', 'mantequilla', 'requeson', 'kefir', 'mozzarella', 'parmesano', 'suero'];
const HUEVO = ['huevo', 'mayonesa', 'clara', 'yema'];
const GLUTEN = ['trigo', 'harina', 'pan', 'pasta', 'cebada', 'centeno', 'espelta', 'cuscus', 'semola', 'galleta', 'seitan'];
const FRUTOS_CASCARA = ['almendra', 'nuez', 'nueces', 'avellana', 'pistacho', 'anacardo', 'castana', 'pecana', 'macadamia', 'pinon'];
const SOJA = ['soja', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari'];
const CERDO_Y_ALCOHOL = ['cerdo', 'jamon', 'chorizo', 'panceta', 'tocino', 'bacon', 'morcilla', 'salchichon', 'mortadela', 'mixta', 'mixto', 'gelatina', 'vino', 'cerveza', 'licor', 'brandy', 'alcohol'];

/** Words a restriction forbids in a product name. */
const PALABRAS_POR_DIETA = {
  vegano: [...CARNE, ...PESCADO, ...CRUSTACEOS, ...MOLUSCOS, ...LACTEOS, ...HUEVO, 'miel'],
  vegetariano: [...CARNE, ...PESCADO, ...CRUSTACEOS, ...MOLUSCOS],
  halal: CERDO_Y_ALCOHOL,
  sinGluten: GLUTEN,
  sinLactosa: LACTEOS,
  sinHuevo: HUEVO,
} as const;

const PALABRAS_POR_ALERGENO: Readonly<Record<string, readonly string[]>> = {
  gluten: GLUTEN,
  lactosa: LACTEOS,
  huevo: HUEVO,
  frutos_de_cascara: FRUTOS_CASCARA,
  cacahuetes: ['cacahuete', 'mani'],
  soja: SOJA,
  pescado: PESCADO,
  crustaceos: CRUSTACEOS,
  moluscos: MOLUSCOS,
  sesamo: ['sesamo', 'tahini'],
  apio: ['apio'],
  sulfitos: ['vino', 'sulfitos'],
};

/** A product that says it is free of the thing ("sin lactosa", "sin gluten") is compatible with that restriction. */
const LIBRE_DE: Readonly<Record<string, string>> = {
  lacteos: 'sin lactosa',
  gluten: 'sin gluten',
  huevo: 'sin huevo',
};

function palabras(texto: string): Set<string> {
  return new Set(normalizeNombre(texto).split(/[^a-z0-9]+/).filter(Boolean));
}

function contiene(conjunto: Set<string>, termino: string): boolean {
  return conjunto.has(termino) || conjunto.has(`${termino}s`) || conjunto.has(`${termino}es`);
}

function infringe(lista: readonly string[], producto: Set<string>, ingrediente: Set<string>): boolean {
  return lista.some(t => contiene(producto, t) && !contiene(ingrediente, t));
}

/**
 * Compatible when no active restriction is violated by a word the product
 * adds. No profile, no restrictions, or no readable name all mean compatible
 * (nothing to judge against); the menu filter stays the allergen safety net.
 */
export function esProductoCompatible(
  ingrediente: string,
  nombreProducto: string,
  perfil: PerfilCompra | undefined,
): boolean {
  if (!perfil || !nombreProducto.trim()) { return true; }

  const producto = palabras(nombreProducto);
  const ing = palabras(ingrediente);
  const textoProducto = normalizeNombre(nombreProducto);
  const vegetal = producto.has('vegetal') || producto.has('vegano') || producto.has('vegana');
  const sinLactosa = textoProducto.includes(LIBRE_DE.lacteos);
  const sinGluten = textoProducto.includes(LIBRE_DE.gluten);
  const sinHuevo = textoProducto.includes(LIBRE_DE.huevo);

  const alergenos = new Set(perfil.alergenos ?? []);

  if (perfil.vegano && !vegetal && infringe(PALABRAS_POR_DIETA.vegano, producto, ing)) { return false; }
  if (perfil.vegetariano && !vegetal && infringe(PALABRAS_POR_DIETA.vegetariano, producto, ing)) { return false; }
  if (perfil.halal && infringe(PALABRAS_POR_DIETA.halal, producto, ing)) { return false; }
  if ((perfil.sinGluten || alergenos.has('gluten')) && !sinGluten && infringe(GLUTEN, producto, ing)) { return false; }
  if ((perfil.sinLactosa || alergenos.has('lactosa')) && !sinLactosa && infringe(LACTEOS, producto, ing)) { return false; }
  if ((perfil.sinHuevo || alergenos.has('huevo')) && !sinHuevo && infringe(HUEVO, producto, ing)) { return false; }

  for (const [alergeno, lista] of Object.entries(PALABRAS_POR_ALERGENO)) {
    if (['gluten', 'lactosa', 'huevo'].includes(alergeno)) { continue; } // handled above, with their "sin ..." escape
    if (alergenos.has(alergeno) && infringe(lista, producto, ing)) { return false; }
  }
  return true;
}

/**
 * The generated catalogs carry no product name, only a URL whose slug is the
 * name ("/product/4640/aceite-oliva-1o-hacendado-botella",
 * "/es/p/aceitunas-gordal-con-hueso/7447647"). An approximation, and the
 * reason this guard reads a name at all; a connector that returns a real name
 * (`ProductoSupermercado.nombre`) should be passed through instead.
 */
export function nombreProductoDesdeUrl(url: string | null): string {
  if (!url) { return ''; }
  const slug = url.match(/\/product\/\d+\/([^/?#]+)/)?.[1] ?? url.match(/\/p\/([^/?#]+)/)?.[1] ?? '';
  return slug.replace(/-/g, ' ');
}
