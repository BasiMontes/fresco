import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// FRESCO-470: root social-share card (LinkedIn/Facebook/X/WhatsApp). Next.js
// auto-generates the `og:image` tags from this file and, since the root
// `twitter` metadata in `app/layout.tsx` doesn't declare its own `images`,
// also backfills `twitter:image` from it — see
// node_modules/next/dist/lib/metadata/resolve-metadata.js's
// "inherit them from openGraph metadata" step. Any route can override this
// by colocating its own `opengraph-image.tsx`.
export const alt = 'Fresco — Menús semanales que aprenden de lo que realmente cocinas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // DESIGN.md / docs/brand/index.html brand tokens: --primary #0f4e0e
  // (background), --background #faf3e3 (tagline text), --accent-2-500
  // #df8c26 (accent rule). `logo-negativo-email.png` is the brand manual's
  // white-on-transparent wordmark, made for exactly this kind of dark,
  // colored background.
  const logoData = await readFile(join(process.cwd(), 'public/brand/logo-negativo-email.png'));
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          background: '#0f4e0e',
          padding: 80,
        }}
      >
        {/* next/og requires a plain <img>, not next/image */}
        <img src={logoSrc} width={480} height={147} alt="" />
        <div
          style={{
            width: 120,
            height: 6,
            borderRadius: 3,
            background: '#df8c26',
          }}
        />
        <div
          style={{
            fontSize: 42,
            color: '#faf3e3',
            textAlign: 'center',
            maxWidth: 920,
          }}
        >
          Menús semanales que aprenden de lo que realmente cocinas
        </div>
      </div>
    ),
    { ...size },
  );
}
