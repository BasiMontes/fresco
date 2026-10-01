import type { EstadoPermiso, SupermarketConnector } from './connector';
import type { ProductoSupermercado, ZonaId } from './types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';

/**
 * FRESCO-752 — an in-memory connector backed by synthetic products. It makes
 * the whole layer implementable and testable without touching any real
 * supermarket: the contract, the registry, the matcher and the refresh plan
 * all run against it.
 */

const OBSERVADO_EN = '2026-10-01T06:00:00.000Z';
const ZONA_FALSA: ZonaId = 'zona-1';

function producto(
  idExterno: string,
  nombre: string,
  envase: ProductoSupermercado['envase'],
  precioEnvase: number,
  extra: Partial<ProductoSupermercado> = {},
): ProductoSupermercado {
  return {
    cadena: 'tiendafalsa',
    idExterno,
    nombre,
    marca: null,
    envase,
    precioEnvase,
    url: `https://tienda.example/p/${idExterno}`,
    disponible: true,
    zona: ZONA_FALSA,
    observadoEn: OBSERVADO_EN,
    ...extra,
  };
}

/** Invented products, none taken from a real chain. */
export const PRODUCTOS_SINTETICOS: readonly ProductoSupermercado[] = [
  producto('p-001', 'Arroz redondo bolsa', { cantidad: 1000, unidad: 'g' }, 1.45),
  producto('p-002', 'Arroz basmati paquete', { cantidad: 500, unidad: 'g' }, 1.6),
  producto('p-003', 'Arroz integral bolsa', { cantidad: 1000, unidad: 'g' }, 1.9),
  producto('p-004', 'Leche entera brik', { cantidad: 1000, unidad: 'ml' }, 0.95),
  producto('p-005', 'Leche semidesnatada pack de 6', { cantidad: 6000, unidad: 'ml' }, 5.4),
  producto('p-006', 'Aceite de oliva virgen extra botella', { cantidad: 1000, unidad: 'ml' }, 8.9),
  producto('p-007', 'Aceite de girasol botella', { cantidad: 1000, unidad: 'ml' }, 2.1),
  producto('p-008', 'Tomate frito brik', { cantidad: 400, unidad: 'g' }, 0.89),
  producto('p-009', 'Salsa con tomate frito y cebolla', { cantidad: 350, unidad: 'g' }, 1.2),
  producto('p-010', 'Huevos camperos docena', { cantidad: 12, unidad: 'unidad' }, 3.1),
  producto('p-011', 'Pasta espagueti paquete', { cantidad: 500, unidad: 'g' }, 0.99, { disponible: false }),
];

interface OpcionesConectorFalso {
  cadena?: string
  permiso?: EstadoPermiso
  permisoRef?: string
  productos?: readonly ProductoSupermercado[]
}

export function crearConectorFalso(opciones: OpcionesConectorFalso = {}): SupermarketConnector {
  const productos = opciones.productos ?? PRODUCTOS_SINTETICOS;
  const cadena = opciones.cadena ?? 'tiendafalsa';

  return {
    cadena,
    permiso: opciones.permiso ?? 'concedido',
    permisoRef: opciones.permisoRef ?? 'FIXTURE-0',
    capacidades: { buscar: true, disponibilidad: true },
    async buscarProductos(termino, zona) {
      const aguja = normalizeNombre(termino);
      return productos.filter(
        p => p.zona === zona && normalizeNombre(p.nombre).includes(aguja),
      ).map(p => ({ ...p, cadena }));
    },
    async obtenerProducto(idExterno, zona) {
      const encontrado = productos.find(p => p.idExterno === idExterno && p.zona === zona);
      return encontrado ? { ...encontrado, cadena } : null;
    },
  };
}

export { ZONA_FALSA };
