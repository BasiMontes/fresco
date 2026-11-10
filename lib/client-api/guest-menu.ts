import { getMealPlanForWeek } from '@/lib/api/meal-plan';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from './auth';

/** FRESCO-1173 — true only for a guest (anonymous session) that already has this week's menu. */
export async function guestHasMenu(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user?.is_anonymous) { return false; }
  return (await getMealPlanForWeek(createClient(), { userId: user.id })) !== null;
}
