'use client';

import type { ShoppingListPasillo } from '@/lib/api/types';
import { Check, Copy, Download } from 'lucide-react';
import * as React from 'react';
import { buttonVariants } from '@/components/ui/button';
import { formatShoppingListAsCsv, formatShoppingListAsText, SUPERMARKET_LINKS } from '@/lib/grocery/export-shopping-list';
import { cn } from '@/lib/utils';

export interface ExportActionsProps {
  pasillos: ShoppingListPasillo[]
}

/**
 * FRESCO-345 (Pieza A — export estructurado). Fila de 3 acciones debajo del
 * `<h1>` de `/shopping-list`: "Copiar" (portapapeles, mismo patrón
 * `navigator.clipboard.writeText` + estado `copied`/timeout que
 * `components/qa/copy-button.tsx`, adaptado a un componente de dominio),
 * "Descargar" (CSV vía Blob + ancla temporal), y 3 enlaces "Abrir en
 * <súper>" que solo lanzan la app/web sin precargar nada.
 *
 * `pasillos` vacío deshabilita Copiar/Descargar (no tiene sentido copiar o
 * descargar una lista sin artículos — comportamiento menos sorprendente que
 * generar un archivo/texto vacío en silencio); los enlaces "Abrir en"
 * siguen siempre activos porque no dependen del contenido de la lista.
 */
export function ExportActions({ pasillos }: ExportActionsProps) {
  const [copied, setCopied] = React.useState(false);
  const isEmpty = pasillos.length === 0;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatShoppingListAsText(pasillos));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    catch {
      // Clipboard API puede rechazar (permisos / contexto no seguro) — fallo
      // silencioso per convención de utilidades del proyecto, el botón
      // simplemente se queda en "Copiar".
    }
  }

  function handleDownload() {
    const blob = new Blob([formatShoppingListAsCsv(pasillos)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'lista-compra.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div data-testid="shopping_list_export_actions" className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        data-testid="shopping_list_export_copy_button"
        disabled={isEmpty}
        onClick={() => {
          void handleCopy();
        }}
        className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
      >
        {copied
          ? (
              <>
                <Check className="size-3.5" aria-hidden="true" />
                Copiado
              </>
            )
          : (
              <>
                <Copy className="size-3.5" aria-hidden="true" />
                Copiar
              </>
            )}
      </button>

      <button
        type="button"
        data-testid="shopping_list_export_download_button"
        disabled={isEmpty}
        onClick={handleDownload}
        className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
      >
        <Download className="size-3.5" aria-hidden="true" />
        Descargar
      </button>

      {Object.entries(SUPERMARKET_LINKS).map(([key, link]) => (
        <a
          key={key}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`shopping_list_export_open_${key}_link`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
        >
          Abrir en
          {' '}
          {link.label}
        </a>
      ))}
    </div>
  );
}
