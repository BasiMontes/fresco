import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { renderSubscriptionConfirmationEmailHtml } from './subscription-confirmation';
import { renderWaitlistConfirmationEmailHtml } from './waitlist-confirmation';

/**
 * FRESCO-1198 — the five transactional emails keep the brand typography of the web (DESIGN.md v2): titles in
 * Young Serif, everything else in Figtree, buttons and the verification code included, with a fallback that
 * still looks like the brand when the client ignores web fonts (Gmail does). The owner ratified the mockup on
 * 2026-11-12 (`.context/design/master-design-plan.md` 4.22). This test renders every template and fails when a
 * font outside that contract shows up. Apple Mail and Gmail, light and dark, stay a manual check.
 *
 * The stacks use single quotes on purpose: an inline `style="..."` attribute cannot hold a double quote.
 *
 * The fonts are hosted by us (`public/fonts/`, SIL OFL), never loaded from Google: the waitlist email goes to people
 * who have not confirmed yet, and the privacy text names no font provider (owner decision, 2026-11-12).
 */

const DISPLAY = '\'young serif\', georgia, \'times new roman\', serif';
const SANS = 'figtree, system-ui, -apple-system, \'segoe ui\', roboto, helvetica, arial, sans-serif';

const FONT_ORIGIN = 'https://fresco-pro.vercel.app/fonts/';
const PUBLIC_FONTS = join(import.meta.dir, '../../../public/fonts');
const TEMPLATES = join(import.meta.dir, '../../../supabase/templates');
const authHtml = (name: string) => readFileSync(join(TEMPLATES, `${name}.html`), 'utf8');

const emails: Record<string, string> = {
  'Auth: confirma tu cuenta': authHtml('confirmation'),
  'Auth: restablece tu contraseña': authHtml('recovery'),
  'Auth: código de verificación': authHtml('email_change'),
  'Suscripción': renderSubscriptionConfirmationEmailHtml({
    priceFormatted: '4,99 €',
    interval: 'month',
    nextRenewalDateFormatted: '7 de octubre de 2026',
    manageSubscriptionUrl: 'https://fresco-pro.vercel.app/profile',
  }),
  'Lista de espera': renderWaitlistConfirmationEmailHtml({ confirmUrl: 'https://fresco-pro.vercel.app/c', removeUrl: 'https://fresco-pro.vercel.app/r' }),
};

/** Every `font-family` value declared in the HTML (a `<style>` rule or an inline `style`), normalised. */
function declaredStacks(html: string): string[] {
  return [...html.replace(/@font-face\s*\{[^}]*\}/gi, '').matchAll(/font-family\s*:\s*([^;}"]*)/gi)].map(match => match[1].toLowerCase().replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim());
}

function ruleStack(html: string, selector: string): string | undefined {
  const rule = html.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*\\}`, 'i'))?.[0];
  return rule ? declaredStacks(rule)[0] : undefined;
}

describe.each(Object.entries(emails))('%s', (_name, html) => {
  test('only the two stacks of the contract are used', () => {
    const stacks = declaredStacks(html);

    expect(stacks.length).toBeGreaterThan(0);
    expect([...new Set(stacks)].filter(stack => stack !== DISPLAY && stack !== SANS)).toEqual([]);
  });

  test('titles use the display stack and the rest uses the sans stack', () => {
    const stacks = declaredStacks(html);

    expect(stacks).toContain(DISPLAY);
    expect(stacks).toContain(SANS);
  });

  test('no face from before the rebrand is left', () => {
    expect(html).not.toMatch(/fraunces|caprasimo|baloo|verdana/i);
  });

  test('declares Young Serif and Figtree', () => {
    expect(html).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Young Serif'/i);
    expect(html).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Figtree'/i);
  });

  test('asks for its fonts to our own server, never to a third party', () => {
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|<link\b/i);

    const urls = [...html.matchAll(/url\(\s*['"]?([^'")\s]+)/gi)].map(match => match[1]);

    expect(urls.length).toBeGreaterThanOrEqual(2);
    for (const url of urls) {
      expect(url.startsWith(FONT_ORIGIN), url).toBe(true);
      expect(url.endsWith('.woff2'), url).toBe(true);
    }
  });
});

describe.each(['Auth: confirma tu cuenta', 'Auth: restablece tu contraseña', 'Auth: código de verificación', 'Suscripción'])('%s (branded layout)', (name) => {
  const html = emails[name];

  test('the title class draws the display stack and the body class the sans stack', () => {
    expect(ruleStack(html, '.heading')).toBe(DISPLAY);
    expect(ruleStack(html, '.body-text')).toBe(SANS);
  });

  test('a button label is never in the display face', () => {
    expect(html).not.toMatch(/class="[^"]*cta-button[^"]*heading|class="[^"]*heading[^"]*cta-button/);
  });

  test('the title is 30 px on desktop and 26 px on a phone', () => {
    expect(html).toMatch(/class="headline heading"[^>]*font-size:\s*30px/);
    expect(html).toContain('.headline { font-size: 26px !important; }');
  });

  test('the negative logo stays in the header band', () => {
    expect(html).toContain('<img src="data:image/png;base64,');
  });
});

describe('Lista de espera (plain on purpose, FRESCO-1008)', () => {
  const html = emails['Lista de espera'];

  test('the title carries the display stack', () => {
    expect(html).toMatch(/<h1[^>]*font-family:\s*'Young Serif'/);
  });
});

describe('the fonts we host (public/fonts, SIL OFL)', () => {
  test.each(['figtree-v9-latin-wght.woff2', 'young-serif-v2-latin-400.woff2'])('%s is a real woff2 file', (name) => {
    const file = readFileSync(join(PUBLIC_FONTS, name));

    expect(file.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(file.length).toBeGreaterThan(5_000);
  });

  test('every URL an email asks for exists in public/fonts', () => {
    const wanted = new Set(Object.values(emails).flatMap(html => [...html.matchAll(/url\(\s*['"]?([^'")\s]+)/gi)].map(match => match[1].replace(FONT_ORIGIN, ''))));

    expect(wanted.size).toBeGreaterThan(0);
    for (const name of wanted) {
      expect(() => readFileSync(join(PUBLIC_FONTS, name)), name).not.toThrow();
    }
  });

  test.each(['OFL-figtree.txt', 'OFL-young-serif.txt'])('%s keeps the licence that comes with the font', (name) => {
    expect(readFileSync(join(PUBLIC_FONTS, name), 'utf8')).toContain('SIL OPEN FONT LICENSE');
  });

  test('they are served with CORS and a long cache, because a mail client loads them from another origin', async () => {
    const config = (await import('../../../next.config.mjs')).default as { headers: () => Promise<Array<{ source: string, headers: Array<{ key: string, value: string }> }>> };
    const rule = (await config.headers()).find(candidate => candidate.source.startsWith('/fonts'));
    const header = (key: string) => rule?.headers.find(candidate => candidate.key.toLowerCase() === key.toLowerCase())?.value;

    expect(rule).toBeDefined();
    expect(header('Access-Control-Allow-Origin')).toBe('*');
    expect(header('Cache-Control')).toContain('immutable');
  });
});
