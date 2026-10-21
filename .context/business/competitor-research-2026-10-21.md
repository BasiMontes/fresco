# Competitor research (public pages and two walkthroughs)

FRESCO-1029. Observations dated 2026-10-21. The first three passes read each product's own public page or store listing; the fourth and fifth are walkthroughs of Halen and Tellerino in a browser with test accounts the owner created. Cestio has no web version: it was used on an iPhone by the owner, who supplied screenshots (sixth pass). These products change: re-read before quoting. Anything not seen is marked `not checked`.

## Conclusion (provisional: Halen, Tellerino and Cestio seen; no week 2 or 3 yet)

**What the others offer.** A first personalised weekly plan in minutes, a shopping list built from it, and a free tier generous enough to use for good (Halen and Cookpad are free; Tellerino keeps the plan and the list free). Tellerino adds a shared household and AI-generated recipes on a quota. Cestio plans against a budget and the supermarkets the user picks (Mercadona, Carrefour, Lidl, Aldi, Dia, Eroski and more), shows an estimated basket total and a cost per serving, and asks for a subscription after a 12-step onboarding (3 days free, then EUR 2.99 a week or EUR 19.99 a year; the list screenshot carries a banner to unlock the plan and the list). Paid tiers seen: Cestio EUR 19.99 a year, ekilu EUR 49.99 a year, Tellerino USD 24.99 a year. Fresco's Pro is EUR 4.99 a month and EUR 44.99 a year.

**What only Fresco offers, split by how well it is known.**
- *Verified in use:* all 14 EU allergens declarable. Halen has no Gluten or Sulfitos option, Tellerino has all 14, and Cestio's onboarding lists five (Gluten, Soja, Pescado, Marisco, Sésamo) plus a free-text box; and since FRESCO-1020 an active recipe cannot be saved with allergen or diet tags that contradict its ingredient text. Nothing seen in the two products enforces that.
- *Prices by supermarket are not unique to Fresco.* Cestio shows an estimated basket total (EUR 29.04 for 24 items in the screenshot) and a cost per serving, planned for the chains the user picks. Halen and Tellerino showed no prices. What was not seen in Cestio, and Fresco does have in code: a link to the product at each chain and the date a price was observed (FRESCO-808). That is held back in production while the Mercadona dataset is stale (FRESCO-1028), so today it is a claim about code, not about what users see.
- *Not found, not proven absent:* learning from what the user cooked or discarded. Neither product mentioned it in what was read, and a week-2 and week-3 walkthrough is the only way to know.
- *Not an advantage:* Tellerino's exclusion applied to listed words and let through wheat-based products (kritharaki, crumpets, English muffins) in 3 of 5 opened meals, which Fresco's own word list would also miss (FRESCO-1040). Fresco must close that before it uses safety as a claim.

**What to change.**
- *PRD and market context.* The competitive set in `.context/business/market-context.md` names no commercial app: only doing nothing, a generic AI chat and notes. It should add the dedicated planners above, and its premise that Fresco wins by "removing the weekly planning decision" no longer separates it: Halen and Tellerino remove it for free. What is left to defend is the learning, and the safety.
- *Value proposition.* Lead with "a menu that learns from what your household cooks and that cannot contradict its own allergen tags", not "a menu and a shopping list" and not "prices at your supermarket" on its own: Cestio already sells the last two. The Free tier will be compared with free tiers that already give the plan and the list.
- *Price.* Do not change it on this evidence. Fresco's annual price is about twice Tellerino's and Cestio's; test it in the pilot (FRESCO-1030) before moving it.

**What not to do yet.** Do not publish any comparison against a named product. It rests on two accounts, one day and a sample of five opened recipes chosen by name, and comparative claims have to be verifiable and not misleading. Keep it internal until it has been repeated on more recipes and re-read.

**What would change this conclusion.** What Cestio's plan contains for a user who ticks Gluten (the app is the owner's, an iPhone check); weeks 2 and 3 of any product to see whether learning exists; ten or more recipes sampled at random in Tellerino's planned week; and the pilot's willingness to pay.

## Confirmed list

| Product | Exists | Aimed at | Where | Source |
|---|---|---|---|---|
| Cestio | yes | Spain first (Spanish page names Mercadona), also Nordic chains | iOS App Store | https://www.cestio.app/es |
| Tellerino | yes | Couples and households, not Spain-specific | iOS and Android | https://tellerino.app/en |
| Plantry | yes | Plant-based cooks, German-language site seen | iPhone and iPad | https://plantry.app/de |
| Tastory | yes (named by the owner 2026-10-21; earlier written "Tastora") | Recipe keeper with a weekly planner and grocery list; publisher iKame Applications (Begamob); market not stated, listing in English | Google Play | https://play.google.com/store/apps/details?id=com.begamob.cooking.foodrecipes |

Names seen in a Spanish-language comparison and read in the second pass below: Halen, Cookpad, ekilu. AnyList and Paprika are noted but not reviewed. Charim, Comelia and CookFeed stay unconfirmed.

## What each page says

| Question | Cestio | Tellerino | Plantry |
|---|---|---|---|
| Plan and menu | AI weekly plan from budget, diet, supermarket, cooking time and appliances; breakfast, lunch and dinner | Plan the user builds; one auto-planned week free, Pro plans every week | Ready-made weekly plans, adjustable |
| Recipes | Each with time, nutrition, photo | Imported from links, photos or video; up to 50 own recipes free | More than 1,200, all vegetarian or vegan (their claim) |
| Diets and allergens | Vegetarian, vegan, gluten-free, low-carb and more; says allergies never reach the plate | not stated on the page read | Plant-based only |
| Shopping list | By aisle, estimated total, shared live with the household | By supermarket section, shared live | By aisle, user-orderable, printable |
| Supermarket links or prices | Plans for a chosen chain (Mercadona named); no product links seen | none seen | none seen |
| Learning from use | not stated on the page read | Suggests recipes in Pro (basis not stated) | List suggestions "learn what you usually buy" |
| Price | 3 days free, then EUR 2.99/week or EUR 19.99/year | Plan, list and 50 recipes free; Pro USD 3.99/month or 24.99/year, 7 days free | Free download, 7 days free, then a subscription (price shown in app) |
| Retention | not checked | not checked | not checked |

## Reading so far (provisional)

- Cestio is the closest competitor: Spanish, Mercadona, budget, diet and allergies, shared list. Its price (EUR 19.99/year) is the number Fresco's Pro has to be compared with.
- Nobody read so far shows supermarket product links with observed prices, or says the plan learns from what was cooked or discarded. Both are Fresco's bets. Treat as "not seen on public pages", not as "they do not do it".
- Free tiers are generous elsewhere (Tellerino keeps plan and list free). A paywall on the plan itself would be unusual.

## Second pass (2026-10-21): Tastory's own listing and three Spanish apps

**Source caveat.** Halen, Cookpad and ekilu are described only by one comparison, https://fond.kitchen/es/guides/best-meal-planning-apps. Its author, Fond, is a competing app that says it has not launched yet, so the comparison has a stake in it. Read every line below as "according to a competitor's guide, 2026-10-21", not as the product's own claim. Only Tastory comes from its own store listing.

| Product | What the source says | Price per the source | Closest to Fresco on |
|---|---|---|---|
| Tastory | Own listing: save recipes from anywhere, AI recipe generator and translator, cookbooks, weekly meal planner, smart grocery list, nutrition information, serving converter | not stated in the text read | A recipe keeper that plans, not a menu generator; no supermarket or allergen claim seen |
| Halen | Generates weekly menus with recipes and the shopping list; adjustable by food preferences, allergens, number of diners and ingredients to avoid | Free, menu and list included | The closest by function and the cheapest: personal menus, allergens and a list, free |
| Cookpad | Weekly menu and a list built from the recipe; community recipes | Free | A catalogue app: free because the catalogue is the product |
| ekilu (formerly Nooddle, born in Zaragoza) | Healthy recipes, preference filters, planner; menu, automatic list, nutrition per recipe and advanced filters are behind ekilu+ | Premium EUR 9.99/month or EUR 49.99/year | The balanced-nutrition angle, and the dearest of the set |

## Reading after the second pass (provisional)

- The Spanish free tier is crowded: Halen and Cookpad give a menu and a list for nothing. If that is accurate, Fresco's Pro cannot be sold on "we make the menu and the list"; it has to be sold on what the others do not say they do (learning from marks, priced supermarket links, allergen rules enforced in the database).
- Price anchors seen so far: Cestio EUR 19.99/year, ekilu EUR 49.99/year, Tellerino USD 24.99/year, Halen and Cookpad free. Fresco's Pro is EUR 4.99/month (the landing shows EUR 44.99/year), so it sits between the free ones and ekilu.
- Halen is the one to open first in the walkthrough: it is the nearest to Fresco's promise (allergens, diners, avoided ingredients) at no cost, and nothing about how it handles allergens is verified here.

## Still to do after this pass

- Tick Gluten in Cestio and read what its plan contains (the owner has the app), and look at weeks 2 and 3 of any product. Halen and Tellerino are done for what one day allows (both onboardings: 4 steps; what each asked is unknown).
- Delete the Tellerino and Halen test accounts when the research ends, and write the one-page conclusion once Cestio is walked.
- Tastory: price and market are still `not checked`.

## Third pass (2026-10-21): what can be walked in a browser, and Halen's public pages

**Which products can be used without a phone.** From their own sites: Halen is a web product (`halenapp.com`, sign-up at `app.halenapp.com/auth/signup`), Tellerino says "Or use it in your browser", Cestio is iOS only ("Descárgalo en el App Store", no web). So Halen and Tellerino can be walked in a browser; Cestio needs an iPhone. Creating an account needs a person (a password typed by them and an email confirmation), so no account was created.

**What Halen shows without an account.** Its own site: a free platform with 280 recipes by partner nutritionists, a menu ten days ahead, personalisation by allergies, tastes and number of diners, and a one-click shopping list. The recipe catalogue (`/recetas`) is public, with a search box and no allergen or diet filter visible on the listing page. The menu generator itself sits behind the sign-up.

**One observation on one public recipe page, read 2026-10-21.** "Lasaña boloñesa con pasta fresca integral" (`/recetas/lasana-bolonesa-con-pasta-fresca-integral`) lists its allergens as Lácteos and Huevos. Its ingredient list for 2 people includes harina de trigo integral (120 g) and vino blanco (70 ml). Wheat flour contains gluten and the page does not list gluten as an allergen. This is one recipe on one page: it could be an omission in what is displayed and says nothing about how the menu generator filters. It is worth checking on more recipes during the walkthrough, because enforcing that tags agree with the ingredient text in the database is exactly what Fresco did on 2026-10-21 (FRESCO-1020).

**Provisional reading.** If the omission holds across recipes, "allergen tags that cannot contradict the ingredient list" is a verifiable difference, and it is a safer claim than "we filter allergens", which Halen also says it does.

## Fourth pass (2026-10-21): Halen walked in a browser, with a test account

Screenshots: `.context/business/competitor-screens/halen-2026-10-21/` (menu, settings, menu preferences, shopping list before and after generating). The account was created by the owner, who typed the password; the session was driven through the visible browser and closed afterwards.

| Area | What was seen |
|---|---|
| Onboarding | 4 steps, reported by the owner who did it (2026-10-21). What each step asked and how long it took were not recorded, so only the step count is a fact here. |
| Menu | A 10-day menu with lunch and dinner only (no breakfast), generated on arrival, one "Cambiar" button per dish. The day labels do not advance with the dates: Saturday, Sunday and Monday all read 24/10/2026, Tuesday to Thursday read 25/10, Friday and Saturday read 26/10. |
| Allergies | 14 options: Soja, Crustáceos, Lácteos, Altramuces, Huevos, Frutos de cáscara, Cacahuetes, Mostaza, Moluscos, Sésamo, Granos de sésamo, Nueces, Pescado, Apio. **No Gluten and no Sulfitos**, two of the 14 EU mandatory allergens. Two near-duplicate pairs (Sésamo and Granos de sésamo, Frutos de cáscara and Nueces). |
| Diet | Vegana, Vegetariana, Pescetariana, Omnívora. No gluten-free, keto, halal or kosher. |
| Excluded ingredients | A free-text ingredient exclusion list. |
| Shopping list | Needs a start and an end date, then groups by category (Vegetal, Fruta, Legumbres, Cereales, Carne...) with quantities. No prices, no supermarket and no link. Unrounded numbers show: "20.833333333333332 Gramos", "22.583333333333332 Cucharadas", "Huevo 275 Gramos", "Cayena 5 Unidades". |

**Allergen labels against ingredient lists.** 15 recipes were read from the public catalogue listing (`/recetas`, the ones a visitor sees first, with a pause between requests; not the 314 of the directory). The ingredient list of 14 could be read; in "Arroz con verduras" it could not. Each list went through Fresco's rule oracle (`tests/db/recipe-allergen-diet-rules.ts`), with Halen's labels mapped to Fresco's tags.

| Finding | Recipes | Detail |
|---|---|---|
| A gluten-bearing ingredient and no way to tag it (Halen has no Gluten label) | 4 of 14 | Lasaña boloñesa con pasta fresca integral (harina de trigo integral), Bol de guisantes y seitán (seitán), Espaguetis con boloñesa de lentejas and Espaguetis integrales con pisto (espaguetis integrales) |
| A sulfite source and no way to tag it (no Sulfitos label) | 3 of 14 | vino blanco in two, vinagre in one. Counted separately: the oracle over-tags on purpose |
| A mismatch inside Halen's own labels | 1 of 14 | Salteado de verduras y tofu marinado lists Frutos de cáscara and Granos de sésamo, and has Tofu among its ingredients but no Soja label |

Two oracle findings are **not** counted against Halen because the oracle is conservative there: "nata vegetal" (flagged as dairy) and "caldo de verduras" (flagged as celery).

**Limits.** One account, one day, 14 recipes of 314. Halen's menu generator was not tested against a gluten allergy because there is no such option. The onboarding was done by the owner before this pass and was not observed: only its length (4 steps) is known, not what each step asked or how long it took. Weeks 2 and 3 and the retention emails are not observable in one day. Cestio and Tellerino are still not walked.

## Reading after Halen (provisional, to be replaced by the one-page conclusion)

- What Halen offers: a free, fast, personalised 10-day menu with a category-grouped list. What it does not show: prices, supermarkets, learning from what the user cooked or discarded.
- The allergen gap is structural, not a typo: with no Gluten or Sulfitos option, a coeliac user cannot declare the allergy at all. Fresco declares all 14 and, since FRESCO-1020, cannot save an active recipe whose tags contradict its text.
- Fresco's differences seen so far: the 14 allergens, enforced tags, supermarket links with observed prices (held back while the Mercadona dataset is stale, FRESCO-1028), learning from marks (Pro).
- Open risk for Fresco: Halen is free and fast to a first menu. Fresco's Pro has to be sold on safety and learning, not on "we make the menu and the list".

## Fifth pass (2026-10-21): Tellerino walked in a browser, with a test account

Screenshots: `.context/business/competitor-screens/tellerino-2026-10-21/` (start, settings, planning dialog, the paywall screen, the planned week, empty recipes, the idea generator and its result). Captures that showed the account's email or the household invite code were deleted and retaken with those hidden. The account was created by the owner with a personal email, not the test alias the card asks for; it should be deleted from Settings, Cuenta, when the research ends.

| Area | What was seen |
|---|---|
| Access | A web app at `app.tellerino.app` (sign in with Google or email). Onboarding: 4 steps, reported by the owner. What each asked and how long it took were not recorded. |
| Household | A household with a member list, a number of people (here 2), which meals to plan (breakfast, lunch, dinner) and an invite link that shares the list and the plan live. |
| Allergies | All 14 EU allergens, including **Cereales con gluten** and **Sulfitos**, which Halen lacks. Plus a free-text "No nos gusta" exclusion list. It says: "Tellerino no te propondrá recetas con estos ingredientes. Aun así, revisa los ingredientes por tu cuenta: Tellerino no conoce todos los productos." |
| Recipes | None at the start ("Mis recetas · 0"). They are generated on demand by an assistant ("Inventar una receta", three ideas, then the full recipe) or imported from links, photos and videos. |
| Planning | "Planificar la semana" fills the free meals, with a split of meat, fish and vegetarian. With the email still unconfirmed, the planning call answered HTTP 400 three times and no message was visible to me; the recipe-ideas dialog did say "Confirma primero tu dirección de correo". After confirming, it planned 15 meals (breakfast, lunch and dinner, Wednesday to Sunday) and opened a plans screen. |
| Free and Pro | Always free: shopping list, weekly plan, household, nutrition values. Free quotas are one try of each AI action ("Ideas de recetas a tu gusto 1x", "Llena toda la semana 1x", "De idea a receta completa 1x"), 20 recipes a month from web pages, 5 from social media and photos, 50 saved recipes. Pro raises them to 100, 100 and unlimited saves, 60 idea requests, 60 planned meals and 50 full recipes a month, and adds sharing the list by link, PDF export, video import and cook mode. Pro is bought in the mobile app. Its site gives USD 3.99/month or USD 24.99/year. |

**Does the gluten exclusion hold?** The account had "Cereales con gluten" and "Setas" excluded; the planning dialog repeated it as "Sin: Cereales con gluten, Setas".

- **Idea generator.** Asked for "espaguetis con tomate y pan rallado, con trigo", it returned three ideas that adapted the request: maize spaghetti with polenta crumbs, chicken tacos in maize tortillas, and a fried rice described as "sin gluten". It did not follow the request into wheat.
- **Planned week.** Of the 15 planned meals, **five were opened and read**, chosen by name because they sounded wheat-based, so this is a biased sample and not a rate. Three list an ingredient that is normally made of wheat and the recipe never says gluten-free: Giouvetsi de pollo con kritharaki (150 g kritharaki, an orzo pasta), Crumpets con mantequilla y mermelada de naranja (crumpets) and Sándwich de desayuno con salchicha y huevo (muffins ingleses). A fourth, Roscas de sésamo con tahini y miel (roscas), probably contains wheat flour but is not certain. The fifth, Bifteki con arroz, lists no wheat ingredient. The other ten meals were not opened.
- **Reading.** Its own notice says it does not know every product, and that is what was seen: the exclusion is applied to listed words, not to what a product is made of. At least three of 15 planned meals broke an active gluten exclusion.

**A gap in Fresco found by the same comparison.** Fresco's own rule oracle does not flag `kritharaki`, `crumpets`, `muffins ingleses` or `roscas` as gluten either. None of the 538 active recipes contains those words, so nothing is exposed today, but the database barrier of FRESCO-1020 can only reject what the oracle knows. Tracked as FRESCO-1040.

**Limits.** One account, one day, five recipes opened on purpose. The shopping list was not walked. The first planning attempts failed because the email was unconfirmed, so that behaviour is not a verdict on Tellerino. Weeks 2 and 3, the invite flow with a second member and the retention emails cannot be seen in one day. Cestio is still not walked.

## Reading after Halen and Tellerino (provisional)

- Both are free to start and quick to a first plan. Neither shows prices or supermarkets in what was seen. Tellerino is the one that covers all 14 allergens; its model is a quota of AI actions with Pro bought in the mobile app, while Halen is free with a smaller allergen list.
- On the gluten test the two fail in different ways: Halen has no gluten option at all; Tellerino has the option and then applies it to listed words only.
- What Fresco can claim and verify, not just say: all 14 allergens declared, tags that cannot contradict the ingredient text since FRESCO-1020, and supermarket links with observed prices when the dataset is fresh. What it cannot claim yet: that its word lists catch every wheat-based product (FRESCO-1040).

## Sixth pass (2026-10-21): Cestio, used on an iPhone by the owner

Screenshots: `.context/business/competitor-screens/cestio-2026-10-21/` (nineteen, downscaled). An eighth, the account settings, shows the owner's email and was not copied into the repository. Cestio has no web version, so this pass rests on what the owner supplied, not on a walkthrough of mine. Two of twelve onboarding steps were not captured (10 and 12).

| Area | What the screenshots show |
|---|---|
| Onboarding | 12 steps with a progress bar. Captured: 1, where you shop (Spain: Mercadona, Carrefour, Lidl, Aldi, Dia, Eroski and more; "Adaptaremos tus planes y precios a lo que encuentras allí"); 2, weekly food budget (a single number in EUR, 100 in the example, "Planificaremos tus menús para ajustarnos a él"); 3, "¿Cómo comes?" (up to two of: sin restricciones, vegetariana, vegana, sin gluten, sin lácteos, pescetariana, sin frutos secos, baja en carbohidratos); 4, "¿Alguna alergia?" (see below); 5, foods you love and "no quiero ni ver" (free text plus suggestions); 6, which cuisines you fancy ("De todo un poco", Española, Italiana, Mediterránea, Alemana, Griega, Asiática, Latinoamericana and more; it always mixes in dishes with no set nationality); 7, how much time you have to cook (15, 30, 45 minutes, 1 hour or no limit); 8, which meals to plan, as a days-by-meals grid (9 meals a week in the example); 9, "Tus comidas" (sweet or savoury breakfasts, main meal at midday or night, lunchbox, quick weekdays, cook once and eat twice); 11, which appliances you own. Not captured: 10 and 12. After the last step a "Creando tu plan de comidas" screen runs four stages (analysing preferences, choosing dishes, adjusting the weekly budget, preparing the shopping list). |
| What it promises at the end | "Tu plan está listo": 1 h 15 min a week not spent thinking what to eat, EUR 10 a week of food not thrown away (about EUR 43 a month), and EUR 5.56 a serving "con tu presupuesto". These are Cestio's own estimates. |
| Shopping list | Total EUR 29.04, "0 de 24 comprados", a pantry check ("¿Te falta algo de la despensa?") listing items to tick, and a green banner "Desbloquea tu plan y tu lista de la compra": the list is visible but locked behind the subscription. Bottom navigation: Plan, Chef Nevera, Compra, Calorías, Perfil. |
| Account | Household size 2, currency EUR, country Spain, push and email notifications both on. These are the retention channels, switched on by default in the screenshot. |

**Allergies (step 4, "¿Alguna alergia?", subtitle "Nunca las incluiremos en tus comidas").** Five options: Gluten, Soja, Pescado, Marisco and Sésamo, plus an "Otra alergia" free-text box ("Escribe una alergia y pulsa +"), and the note that it can be changed later in Ajustes. In the screenshot Marisco is ticked. Step 5 then shows "marisco" among the "no quiero ni ver" chips next to cilantro and tofu; whether it was carried over from the allergy or typed was not seen. Separately, step 3 offers "Sin gluten" and "Sin frutos secos" as diets, so allergy and diet are two separate questions, as in Fresco. Milk, eggs, tree nuts, peanuts, celery, mustard, sulphites and lupin are not options; they could be typed in the free-text box, but how free text is matched against recipe ingredients was not seen. "Marisco" is one option, so crustaceans and molluscs are not separated. The promise is absolute ("never"), which is the claim to test: with a tick on Gluten, what does the plan contain.

**The plan itself (two onboardings, two different plans).** Tuesday 20 (screenshot at 13:27, right after the first onboarding, Marisco as the only allergy): one dish, a lunch (arroz con garbanzos y espinacas, 30 min, 633 kcal), matching the step-8 grid. Wednesday 21 and Thursday 22 (screenshots between 15:39 and 15:44) belong, per the owner, to a second onboarding with Gluten and Marisco both ticked; that second onboarding's own screens were not captured. Wednesday: tortilla de calabacín (12 min), pollo con espinacas cremosas (30 min, 835 kcal, 65 g carbohydrate) and dorada a la plancha con espinacas al ajillo (24 min). Thursday: lunch "Pasta con salchicha fresca y brócoli" (25 min, 651 kcal, 74 g carbohydrate) and dinner pechuga de pollo a la plancha con pimientos (35 min). Each card shows time, kcal and protein/carbohydrate/fat grams, a swap arrow, "Quitar" and "Buscar plato". No dish shows shellfish. **The Thursday lunch is a possible failure of the "never" promise:** a plain pasta dish with fresh sausage, in a plan the owner says had Gluten ticked. At 15:54 the same Thursday lunch showed "Sartén de Carne y Arroz" (30 min, 815 kcal) instead; the owner reports it changed on its own, with no tap on the swap arrow or the dish. Why was not seen (a correction after generation, a regeneration, or something else), so it is not evidence that Cestio checks gluten; and the pasta's ingredients cannot be read now (the owner reports opening a dish from the plan leads to the paywall; not tested). Not proven: the dish's ingredients were not opened, it could use gluten-free pasta, and the step-4 screen of that second onboarding was not captured. The Wednesday cream-sauce chicken was opened and passes: tagged "Sin gluten" and "Alta en proteínas", allergen badge "Lácteos" only, and its ingredients (white rice, olive oil, chicken breast, garlic, baby spinach, cooking cream, parmesan) contain no gluten source; the 65 g of carbohydrate is the rice. The recipe screen also shows price per serving (EUR 3.30), servings (2, adjustable), equipment needed, working time, five nutrients, ingredients and steps. Three of the four Wednesday and Tuesday dishes use spinach.

**What it shows about the model.** A long, personalised onboarding (it asks for the supermarket first) that ends in a quantified promise and then a paywall before the plan. Fresco's Free tier gives the menu and the list. In Cestio the list screen carried a banner to unlock "tu plan y tu lista de la compra" and its site gives three free days; what exactly stays usable after that was not seen, and the plan tab was not captured.

## Still to do (needs a person)

- The owner keeps the Halen and Tellerino test accounts on purpose, to look around later; the Tellerino one uses a personal email. Delete them when the research ends.
- Cestio's onboarding: screens for steps 10 and 12 were never sent (the owner considers the onboarding covered). They stay marked as not captured.
- Weeks 2 and 3: Cestio's plan cannot be browsed past Monday 26, the end of the first week, so a second week is not visible without paying. Halen and Tellerino weeks 2 and 3 are not observable in one day.
- One-page conclusion for the PRD, price and value proposition: provisional, at the top of this file.
