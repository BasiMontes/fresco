import type { ComponentType } from 'react';
import AlertBannerExample from './examples/alert-banner.example';
import ButtonExample from './examples/button.example';
import CardExample from './examples/card.example';
import EmptyStateExample from './examples/empty-state.example';
import InputExample from './examples/input.example';
import TagExample from './examples/tag.example';

export interface RegistryEntry {
  /** File under `components/ui`, without extension. */
  source: string
  title: string
  description: string
  Example: ComponentType
}

/** FRESCO-1207: the documented components. The slug is the URL segment and the key of the generated API and source. */
export const REGISTRY = {
  'button': { source: 'button', title: 'Botón', description: 'Acción principal o secundaria, en cuatro variantes y tres tamaños.', Example: ButtonExample },
  'card': { source: 'card', title: 'Tarjeta', description: 'Contenedor con borde y sombra para agrupar un contenido.', Example: CardExample },
  'tag': { source: 'tag', title: 'Etiqueta', description: 'Pastilla breve para clasificar o filtrar, con una variante para alérgenos.', Example: TagExample },
  'input': { source: 'input', title: 'Campo de texto', description: 'Campo de formulario con forma de pastilla y tamaño táctil de 44 píxeles.', Example: InputExample },
  'alert-banner': { source: 'alert-banner', title: 'Aviso', description: 'Lista de advertencias siempre visible que no desaparece sola.', Example: AlertBannerExample },
  'empty-state': { source: 'empty-state', title: 'Estado vacío', description: 'Mensaje con acción opcional cuando una pantalla aún no tiene contenido.', Example: EmptyStateExample },
} as const satisfies Record<string, RegistryEntry>;

export type RegistrySlug = keyof typeof REGISTRY;

export function registrySlugs(): RegistrySlug[] {
  return Object.keys(REGISTRY) as RegistrySlug[];
}
