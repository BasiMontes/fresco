'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The one bit of interactivity `<CodeBlock>` needs — everything else about
 * that component (syntax highlighting) is server-rendered by Shiki with zero
 * client JS. Kept as its own thin Client Component so the split is explicit
 * rather than forcing the whole code block into `'use client'`.
 */
export interface CopyButtonProps {
  text: string
  className?: string
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    catch {
      // Clipboard API can reject (permissions, non-secure context) — silent
      // fail per this project's utility convention; button just stays "Copiar".
    }
  }

  return (
    <button
      type="button"
      data-testid="qa_code_copy_button"
      onClick={() => {
        void handleCopy();
      }}
      className={cn(
        // FRESCO-293: lives in the code block's header bar now, so it no
        // longer overlaps the first line. Keeps a visible keyboard focus
        // state (ring, never hover-only) per the app's focus-visible pattern.
        'inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-caption text-tertiary shadow-sm transition-colors hover:bg-neutral-200 hover:text-text focus-visible:bg-neutral-200 focus-visible:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        className,
      )}
    >
      {copied
        ? (
            <>
              <Check className="size-3.5" aria-hidden="true" />
              Copiado
            </>
          )
        : (
            <>
              <Copy className="size-3.5" aria-hidden="true" />
              Copiar
            </>
          )}
    </button>
  );
}
