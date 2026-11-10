import { useEffect, useState } from 'react';
import { guestHasMenu } from '@/lib/client-api/guest-menu';

/**
 * FRESCO-1173 — does the visitor of `/signup` have a menu to keep? True only for a guest (anonymous
 * session) that already has this week's menu; a visitor with no session, or a guest with no menu,
 * gets the generic copy. Starts `false` and fails closed: until the check ends, and on any error, the
 * page makes no claim about a menu the visitor may not have.
 */
export function useGuestMenu(): boolean {
  const [hasMenu, setHasMenu] = useState(false);

  useEffect(() => {
    let cancelled = false;
    guestHasMenu()
      .then((result) => { if (!cancelled) { setHasMenu(result); } })
      .catch(() => { /* Fail closed: keep the generic copy. */ });
    return () => { cancelled = true; };
  }, []);

  return hasMenu;
}
