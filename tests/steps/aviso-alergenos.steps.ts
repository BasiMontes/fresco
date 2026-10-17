import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @seguridad-alimentaria "El aviso de alérgenos"
 * (FRESCO-1000, audit 7b A7-LAUNCH-03 / A7-LOGIC-08).
 *
 * The three scenarios reuse the Given/When steps of the onboarding, Inicio and Biblioteca scenarios
 * (a throwaway factory user each, FRESCO-308); only the Then steps are new. What they pin is the
 * promise itself: wherever a menu or a recipe is shown there is a reminder to check ingredients and
 * labels, and the two free-text boxes of the onboarding say next to them that they do not filter.
 */

const { When, Then } = createBdd(test);

When(/^llega al primer paso del onboarding \(dieta y alérgenos\)$/, async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page.getByTestId('step_indicator_label')).toBeVisible();
});

Then(/^ve el aviso de alérgenos junto a las opciones y la nota de que las cajas de texto libre no filtran$/, async ({ page }) => {
  await expect(page.getByTestId('alergenos_aviso')).toContainText('revisa siempre las etiquetas');
  for (const note of ['dieta_texto_libre_aviso', 'ingredientes_odiados_texto_libre_aviso']) {
    await expect(page.getByTestId(note)).toContainText('no se usa para filtrar');
  }
});

Then(/^ve el recordatorio de alérgenos en Inicio$/, async ({ page }) => {
  await expect(page.getByTestId('alergenos_recordatorio')).toContainText('revisa siempre los ingredientes');
});

Then(/^ve el recordatorio de alérgenos en la ficha de la receta$/, async ({ page }) => {
  await expect(page.getByTestId('recipe_detail_tags')).toBeVisible();
  await expect(page.getByTestId('alergenos_recordatorio')).toContainText('revisa siempre los ingredientes');
});
