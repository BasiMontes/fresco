import Link from 'next/link';

/**
 * FRESCO-1010 (audit 7b A7-LOGIC-07) — what the flows that change the menu after the list was built
 * (adding a recipe to the week, an ingredient substitution, discarding a dish) tell the person about the
 * list: it exists, it does not have this change yet, and where to update it.
 */
export function StaleListNotice({ className }: { className?: string }) {
  return (
    <p className={className} role="status" data-testid="stale_list_notice">
      Tu lista de la compra ya estaba generada y todavía no incluye este cambio.
      {' '}
      <Link href="/shopping-list" className="font-semibold text-primary underline" data-testid="stale_list_notice_link">
        Ábrela y pulsa «Actualizar lista»
      </Link>
      .
    </p>
  );
}
