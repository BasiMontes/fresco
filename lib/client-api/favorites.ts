import { addFavorite as addFavoriteFor, removeFavorite as removeFavoriteFor } from '@/lib/api/favorites';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: `lib/api/favorites` bound to the signed-in browser session. */

export async function addFavorite(args: Parameters<typeof addFavoriteFor>[1]) {
  return addFavoriteFor(createClient(), args);
}

export async function removeFavorite(args: Parameters<typeof removeFavoriteFor>[1]) {
  return removeFavoriteFor(createClient(), args);
}
