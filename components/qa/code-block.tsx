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
 * theme guide — the app itself has no dark mode toggle today, so this only
 * activates via `prefers-color-scheme` (see the `.shiki` rules in
 * `app/globals.css`), kept scoped to code blocks rather than inventing a
 * site-wide dark theme this project doesn't otherwise have.
 */
export async function CodeBlock({ code, lang = 'bash', className }: CodeBlockProps) {
  const html = await codeToHtml(code, {
    lang,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: 'light',
  });

  return (
    <div className={cn('relative overflow-hidden rounded-md border border-border bg-surface', className)}>
      <CopyButton text={code} className="absolute right-2 top-2" />
      {/* Server-rendered Shiki output from our own literal code strings, never user input. */}
      <ScrollFadeWrapper html={html} />
    </div>
  );
}
