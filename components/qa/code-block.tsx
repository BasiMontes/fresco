import { codeToHtml } from 'shiki';

import { CopyButton } from '@/components/qa/copy-button';
import { ScrollFadeWrapper } from '@/components/qa/scroll-fade-wrapper';
import { cn } from '@/lib/utils';

export interface CodeBlockProps {
  code: string
  lang?: string
  className?: string
}

/**
 * Server-rendered syntax highlighting (Shiki `codeToHtml`, zero client JS)
 * with a thin client-only `<CopyButton>` for the one bit of interactivity
 * that actually needs it — see `.session/testability-guide/plan.md` Q6.
 *
 * Dual theme (`github-light`/`github-dark`) per Shiki's CSS-variable dual-
 * theme guide: every token carries both colours as variables and the `.shiki`
 * rule in `app/globals.css` picks one with `light-dark()`, following the
 * app's own resolved `color-scheme` (theme cookie, or the OS for `system`).
 */
export async function CodeBlock({ code, lang = 'bash', className }: CodeBlockProps) {
  const html = await codeToHtml(code, {
    lang,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    // FRESCO-1215: `false` makes Shiki emit BOTH `--shiki-light` and `--shiki-dark` on every token. With
    // `'light'` the light colour is an inline `color` and `--shiki-light` is never defined, so the
    // `light-dark()` rule in `app/globals.css` was invalid on the light side and the code lost its highlighting.
    defaultColor: false,
  });

  return (
    <div className={cn('overflow-hidden rounded-md border border-border bg-surface', className)}>
      {/*
        FRESCO-293: the copy button used to be `absolute` in the top-right
        corner, overlapping the snippet's first line (opaque, so it hid the
        text under it). A thin header bar gives it its own row above the code.
      */}
      <div className="flex justify-end border-b border-border px-2 py-1">
        <CopyButton text={code} />
      </div>
      {/* Server-rendered Shiki output from our own literal code strings, never user input. */}
      <ScrollFadeWrapper html={html} />
    </div>
  );
}
