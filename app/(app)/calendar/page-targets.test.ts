import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-968 (UX-16) — `/calendar` is an async server component that needs
 * Supabase to render, so the "Ver semanas anteriores" link's hit-area classes
 * are pinned on the source: both render branches carry the padded target.
 */
describe('/calendar historial link', () => {
  test('both branches give the link a py-1.5 hit area offset by -my-1.5', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
    const links = source.match(/data-testid="calendar_historial_link"\s+className="[^"]+"/g) ?? [];

    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toContain('py-1.5');
      expect(link).toContain('-my-1.5');
    }
  });
});
