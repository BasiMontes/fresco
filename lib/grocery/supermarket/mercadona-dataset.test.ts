import type { ProductoDatasetMercadona } from './mercadona-dataset';
import { describe, expect, test } from 'bun:test';
import { MERCADONA_CATALOG_MATCH } from '../mercadona-catalog.generated';
import { conectorMercadona, idMercadonaDeUrl, ZONA_CATALOGO } from './catalog-connectors';
import { puedeEjecutarse } from './connector';
import { crearConectorMercadonaDataset, productoDeDataset, ZONA_DATASET } from './mercadona-dataset';

const FECHA = '2026-09-28T04:30:00.000Z';

function dataset(
  id: string,
  pi: Partial<ProductoDatasetMercadona['price_instructions']> = {},
  nombre = `Producto ${id}`,
): ProductoDatasetMercadona {
  return {
    id,
    display_name: nombre,
    share_url: `https://tienda.example/product/${id}/producto`,
    price_instructions: { reference_price: '4.440', reference_format: 'kg', unit_size: 0.45, size_format: 'kg', ...pi },
  };
}

describe('productoDeDataset', () => {
  test('a weight product: the pack in grams and the price of the whole pack', () => {
    const p = productoDeDataset(dataset('1', { unit_size: 0.45, reference_price: '4.440', reference_format: 'kg' }), { observadoEn: FECHA });
    expect(p).toMatchObject({ cadena: 'mercadona', idExterno: '1', envase: { cantidad: 450, unidad: 'g' }, observadoEn: FECHA, zona: ZONA_DATASET });
    expect(p?.precioEnvase).toBe(2); // 4.44 EUR/kg x 0.45 kg = 1.998, rounded to the cent
  });

  test('a volume product: the pack in millilitres', () => {
    const p = productoDeDataset(dataset('2', { unit_size: 1, size_format: 'l', reference_price: '3.900', reference_format: 'L' }), { observadoEn: FECHA });
    expect(p?.envase).toEqual({ cantidad: 1000, unidad: 'ml' });
    expect(p?.precioEnvase).toBeCloseTo(3.9, 5);
  });

  test('a price per 100 g is converted to the whole pack', () => {
    const p = productoDeDataset(dataset('3', { unit_size: 0.4, reference_price: '0.500', reference_format: '100 g' }), { observadoEn: FECHA });
    expect(p?.precioEnvase).toBeCloseTo(2, 5);
  });

  test('a count reference ("ud") is the price of the whole pack, as in the static connector', () => {
    const p = productoDeDataset(dataset('4', { unit_size: 0.485, reference_price: '4.000', reference_format: 'ud' }), { observadoEn: FECHA });
    expect(p?.precioEnvase).toBe(4);
  });

  test.each([
    ['a size that is not weight or volume', { size_format: 'ud' }],
    ['no size unit', { size_format: null }],
    ['no pack size', { unit_size: null }],
    ['a zero pack size', { unit_size: 0 }],
    ['a pack that rounds to zero grams', { unit_size: 0.0001 }],
    ['a zero price', { reference_price: '0.000' }],
    ['a price that is not a number', { reference_price: 'n/d' }],
    ['a reference format that cannot be converted', { reference_format: '???' }],
  ])('drops a product with %s', (_motivo, pi) => {
    expect(productoDeDataset(dataset('x', pi), { observadoEn: FECHA })).toBeNull();
  });
});

describe('the dataset connector prices what the static connector prices today', () => {
  // The static connector is the oracle: for every ingredient of the committed
  // catalog, a dataset product with the same pack and reference price must give
  // the same id, pack and price of the whole pack.
  const claves = Object.keys(MERCADONA_CATALOG_MATCH);

  test('the catalog is not empty', () => {
    expect(claves.length).toBeGreaterThan(0);
  });

  test.each(claves.map(c => [c] as const))('%s', async (clave) => {
    const match = MERCADONA_CATALOG_MATCH[clave];
    const id = idMercadonaDeUrl(match.shareUrl);
    expect(id).not.toBeNull();

    const conector = crearConectorMercadonaDataset({
      cargarCatalogo: async () => [{
        id: id!,
        display_name: clave,
        share_url: match.shareUrl,
        price_instructions: {
          reference_price: String(match.precioMercadona.precioReferencia),
          reference_format: match.precioMercadona.formatoReferencia,
          unit_size: match.envaseVenta.cantidad / 1000,
          size_format: match.envaseVenta.unidad === 'g' ? 'kg' : 'l',
        },
      }],
      fechaSnapshot: async () => FECHA,
    });

    const vivo = await conector.obtenerProducto(id!, ZONA_DATASET);
    const estatico = await conectorMercadona.obtenerProducto(clave, ZONA_CATALOGO);
    expect(vivo).not.toBeNull();
    expect(vivo?.envase).toEqual(estatico?.envase);
    expect(vivo?.url).toBe(estatico?.url);
    expect(Math.abs((vivo?.precioEnvase ?? 0) - (estatico?.precioEnvase ?? 0))).toBeLessThan(0.005);
  });
});

describe('crearConectorMercadonaDataset', () => {
  function fuente(productos: ProductoDatasetMercadona[] = [dataset('10'), dataset('11')]) {
    const llamadas = { catalogo: 0, fecha: 0 };
    return {
      llamadas,
      fuente: {
        cargarCatalogo: async () => { llamadas.catalogo++; return productos; },
        fechaSnapshot: async () => { llamadas.fecha++; return FECHA; },
      },
    };
  }

  test('looks a product up by Mercadona\'s own id and reports the snapshot date', async () => {
    const conector = crearConectorMercadonaDataset(fuente().fuente);
    const p = await conector.obtenerProducto('11', ZONA_DATASET);
    expect(p).toMatchObject({ idExterno: '11', observadoEn: FECHA, zona: ZONA_DATASET });
  });

  test('loads the dataset once, however many products are asked for', async () => {
    const { fuente: f, llamadas } = fuente();
    const conector = crearConectorMercadonaDataset(f);
    await Promise.all([conector.obtenerProducto('10', ZONA_DATASET), conector.obtenerProducto('11', ZONA_DATASET)]);
    await conector.obtenerProducto('10', ZONA_DATASET);
    await conector.buscarProductos('producto', ZONA_DATASET);
    expect(llamadas).toEqual({ catalogo: 1, fecha: 1 });
  });

  test('an unknown id is null, and so is another zone, without loading anything', async () => {
    const { fuente: f, llamadas } = fuente();
    const conector = crearConectorMercadonaDataset(f);
    expect(await conector.obtenerProducto('999', ZONA_DATASET)).toBeNull();
    expect(llamadas.catalogo).toBe(1);

    const otra = fuente();
    const sinCargar = crearConectorMercadonaDataset(otra.fuente);
    expect(await sinCargar.obtenerProducto('10', 'otra-zona')).toBeNull();
    expect(await sinCargar.buscarProductos('producto', 'otra-zona')).toEqual([]);
    expect(await sinCargar.buscarProductos('   ', ZONA_DATASET)).toEqual([]);
    expect(otra.llamadas.catalogo).toBe(0);
  });

  test('a failed download is asked for once: every later request fails the same way', async () => {
    let intentos = 0;
    const conector = crearConectorMercadonaDataset({
      cargarCatalogo: async () => { intentos++; throw new Error('huggingface down'); },
      fechaSnapshot: async () => FECHA,
    });
    await expect(conector.obtenerProducto('10', ZONA_DATASET)).rejects.toThrow('huggingface down');
    await expect(conector.obtenerProducto('11', ZONA_DATASET)).rejects.toThrow('huggingface down');
    expect(intentos).toBe(1);
  });

  test('a snapshot date that is not a valid instant is refused, not stored as a price date', async () => {
    const conector = crearConectorMercadonaDataset({ cargarCatalogo: async () => [dataset('10')], fechaSnapshot: async () => 'ayer' });
    await expect(conector.obtenerProducto('10', ZONA_DATASET)).rejects.toThrow('not a valid instant');
  });

  test('products it cannot price are not served', async () => {
    const conector = crearConectorMercadonaDataset(fuente([dataset('10'), dataset('12', { size_format: 'ud' })]).fuente);
    expect(await conector.obtenerProducto('12', ZONA_DATASET)).toBeNull();
    expect(await conector.obtenerProducto('10', ZONA_DATASET)).not.toBeNull();
  });

  test('search matches the start of a word, not the middle of one', async () => {
    const conector = crearConectorMercadonaDataset(fuente([
      dataset('20', {}, 'Arroz redondo Hacendado'),
      dataset('21', {}, 'Leche de arroz'),
      dataset('22', {}, 'Tarro de miel'),
    ]).fuente);
    const encontrados = await conector.buscarProductos('Arroz', ZONA_DATASET);
    expect(encontrados.map(p => p.idExterno)).toEqual(['20', '21']);
    expect(await conector.buscarProductos('rroz', ZONA_DATASET)).toEqual([]);
  });

  test('carries the same legal state as the static connector, and may run', () => {
    const conector = crearConectorMercadonaDataset(fuente().fuente);
    expect(conector.cadena).toBe('mercadona');
    expect(conector.permiso).toBe(conectorMercadona.permiso);
    expect(conector.permisoRef).toBe(conectorMercadona.permisoRef);
    expect(puedeEjecutarse(conector)).toBe(true);
  });
});
