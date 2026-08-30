import { notFound } from 'next/navigation';
import { SkeletonCaptureContent } from './skeleton-capture-content';

/**
 * Public, unauthenticated capture target for `npx boneyard-js build` — the
 * 4 real pages this app skeletons (`/menu`, `/recipes`, `/calendar`,
 * `/shopping-list`) all sit behind the `(app)` auth-gated route group, so
 * the CLI's crawler (an anonymous browser) never reaches them directly.
 *
 * Each `<Skeleton name="...">` in the content component mounts the SAME name
 * used in the matching route's `loading.tsx`; boneyard captures bones by
 * name, not by URL, so it doesn't matter that the real pages live elsewhere.
 * Re-run `npx boneyard-js build http://localhost:3000/dev/skeleton-capture`
 * whenever one of the 4 real pages' layout changes.
 *
 * Dev-tooling only: the boneyard build always runs against a local dev
 * server, so this route 404s in production instead of shipping fixture
 * markup to real users. (`/qa` is deliberately public — QA testers reach it
 * on staging and production — so it is NOT gated the same way.)
 */
export default function SkeletonCapturePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <SkeletonCaptureContent />;
}
