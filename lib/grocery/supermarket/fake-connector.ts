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

function producto({ idExterno, nombre, envase, precioEnvase, extra = {} }: {
  idExterno: string
  nombre: string
  envase: ProductoSupermercado['envase']
  precioEnvase: number
  extra?: Partial<ProductoSupermercado>
}): ProductoSupermercado {
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
  producto({ idExterno: 'p-001', nombre: 'Arroz redondo bolsa', envase: { cantidad: 1000, unidad: 'g' }, precioEnvase: 1.45 }),
  producto({ idExterno: 'p-002', nombre: 'Arroz basmati paquete', envase: { cantidad: 500, unidad: 'g' }, precioEnvase: 1.6 }),
  producto({ idExterno: 'p-003', nombre: 'Arroz integral bolsa', envase: { cantidad: 1000, unidad: 'g' }, precioEnvase: 1.9 }),
  producto({ idExterno: 'p-004', nombre: 'Leche entera brik', envase: { cantidad: 1000, unidad: 'ml' }, precioEnvase: 0.95 }),
  producto({ idExterno: 'p-005', nombre: 'Leche semidesnatada pack de 6', envase: { cantidad: 6000, unidad: 'ml' }, precioEnvase: 5.4 }),
  producto({ idExterno: 'p-006', nombre: 'Aceite de oliva virgen extra botella', envase: { cantidad: 1000, unidad: 'ml' }, precioEnvase: 8.9 }),
  producto({ idExterno: 'p-007', nombre: 'Aceite de girasol botella', envase: { cantidad: 1000, unidad: 'ml' }, precioEnvase: 2.1 }),
  producto({ idExterno: 'p-008', nombre: 'Tomate frito brik', envase: { cantidad: 400, unidad: 'g' }, precioEnvase: 0.89 }),
  producto({ idExterno: 'p-009', nombre: 'Salsa con tomate frito y cebolla', envase: { cantidad: 350, unidad: 'g' }, precioEnvase: 1.2 }),
  producto({ idExterno: 'p-010', nombre: 'Huevos camperos docena', envase: { cantidad: 12, unidad: 'unidad' }, precioEnvase: 3.1 }),
  producto({ idExterno: 'p-011', nombre: 'Pasta espagueti paquete', envase: { cantidad: 500, unidad: 'g' }, precioEnvase: 0.99, extra: { disponible: false } }),
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
