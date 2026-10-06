import { updateNombre as updateNombreFor, upsertUserProfile as upsertUserProfileFor } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: `lib/api/user-profile` bound to the signed-in browser session. */

export async function updateNombre(nombre: Parameters<typeof updateNombreFor>[1]) {
  return updateNombreFor(createClient(), nombre);
}

export async function upsertUserProfile(profile: Parameters<typeof upsertUserProfileFor>[1]) {
  return upsertUserProfileFor(createClient(), profile);
}
