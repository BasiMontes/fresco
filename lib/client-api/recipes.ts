import { createRecetaPropia as createRecetaPropiaFor, deleteRecetaPropia as deleteRecetaPropiaFor, updateRecetaPropia as updateRecetaPropiaFor } from '@/lib/api/recipes';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: the own-recipes writes of `lib/api/recipes`, bound to the signed-in browser session. */

export async function createRecetaPropia(input: Parameters<typeof createRecetaPropiaFor>[1]) {
  return createRecetaPropiaFor(createClient(), input);
}

export async function updateRecetaPropia(args: Parameters<typeof updateRecetaPropiaFor>[1]) {
  return updateRecetaPropiaFor(createClient(), args);
}

export async function deleteRecetaPropia(id: Parameters<typeof deleteRecetaPropiaFor>[1]) {
  return deleteRecetaPropiaFor(createClient(), id);
}
