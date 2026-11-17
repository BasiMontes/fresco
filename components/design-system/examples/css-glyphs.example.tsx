'use client';

import { useState } from 'react';
import { MenuMark, PlusMark, ThemeMark } from '@/components/ui/css-glyphs';

export default function CssGlyphsExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-6 text-text">
      <PlusMark />
      <button type="button" aria-label="Alternar menú" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MenuMark open={open} />
      </button>
      <ThemeMark kind="light" />
      <ThemeMark kind="dark" />
    </div>
  );
}
