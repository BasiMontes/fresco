import { redirect } from 'next/navigation';

/**
 * FRESCO-1229: `/design-system` has no body of its own; the sidebar already lists every page, so the
 * entry point opens on the first foundation page. A redirect (not a second render of Colores) keeps
 * one source for that content and one URL for it, and old `/design-system` links keep working.
 */
export default function DesignSystemPage() {
  redirect('/design-system/foundation/colors');
}
