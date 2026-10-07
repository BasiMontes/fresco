import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { expectNoA11yViolations, expectTouchTargetsAtLeast } from './support/a11y';

/**
 * Step definitions for `.context/qa/regression.feature` — @a11y.
 * FRESCO-466: automated accessibility check (axe-core) over the app's key
 * screens, reusing the navigation `Given`s already defined by the other
 * step files. Two `Given`s below (plain visits to the public /login and
 * /signup pages) are new — no existing step file just visits either page
 * without also driving its form.
 */
const { Given, When, Then } = createBdd();

Given(/^que un visitante sin cuenta ni sesión visita \/login$/, async ({ page }) => {
  await page.goto('/login');
});

Given(/^que un visitante sin cuenta ni sesión visita \/signup$/, async ({ page }) => {
  await page.goto('/signup');
});

// `que el usuario tiene sesión iniciada` (onboarding.steps.ts) can land on
// /menu instead of /onboarding when the factory user's `user_profiles` row
// already reads as onboarded — the existing usages always follow it with an
// explicit `page.goto('/onboarding')`; this scenario does the same.
When(/^visita \/onboarding$/, async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page.getByTestId('step_indicator_label')).toBeVisible();
});

When(/^avanza al siguiente paso del onboarding$/, async ({ page }) => {
  await page.getByTestId('next_button').click();
});

// FRESCO-805 (A6-L4): the page-level "no horizontal scroll" check passed while
// the "Comidas a planificar" grid scrolled INSIDE its own container (SAB faded,
// DOM out of view), because that container is `overflow-x-auto` and so never
// widens the page. Measure the grid itself.
Then(/^la rejilla de comidas y días cabe sin scroll propio$/, async ({ page }) => {
  const grid = page.getByTestId('planning_selection_grid');
  await expect(grid).toBeVisible();
  const { scrollWidth, clientWidth } = await grid.evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(scrollWidth, 'the 7 days must fit without scrolling inside the grid').toBeLessThanOrEqual(clientWidth);
});

Then(/^la pantalla no tiene violaciones de accesibilidad serias$/, async ({ page }) => {
  await expectNoA11yViolations(page);
});

// FRESCO-819 (A6-L10): axe's `nested-interactive` is already inside the serious
// check above; this one adds the audit's 44 px touch-target floor, measured at
// the 360 px viewport by the `mobile` project.
Then(/^todos los elementos interactivos miden al menos 44 px$/, async ({ page }) => {
  await expectTouchTargetsAtLeast(page);
});
