// FRESCO-809 — `user-profile.ts` (692 lines) split by domain. This barrel keeps
// `@/lib/api/user-profile` as the one import path for every caller.
export { UserProfileError } from './errors';
export { getUserNombre, updateNombre } from './nombre';
export { getHasUnseenNotifications, getShouldShowRoutesNotice, getShouldShowWelcomeNotice, markRoutesNoticeDismissed, markWelcomeNoticeSeen } from './notices';
export { getPaymentFailedAt, getPlanTierForAnalytics, getUserPlan, getUserTrialAvailable, isPaymentFailedAlertActive } from './plan';
export type { OnboardingProfilePayload, SavedOnboardingProfile } from './profile';
export { getUserDietaryPreferences, getUserOnboardingProfile, hasUserProfile, upsertUserProfile } from './profile';
