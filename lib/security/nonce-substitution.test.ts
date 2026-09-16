import { describe, expect, it } from 'bun:test';
import { substituteNonce } from '@/lib/security/nonce-substitution';

// Shape captured live from a real `bun run dev` render of `/`: external chunk
// scripts and inline RSC-payload scripts both carry the SAME nonce value.
// Trimmed to a representative slice (real page had 62 script tags, 1 nonce).
const OLD_NONCE = 'MTZmNjcyY2ItNjIzZC00YjdhLWJjNzUtZDkwOWM1ZDk0NGNi';
const REAL_SHAPE_FIXTURE = `<!DOCTYPE html><html lang="es"><head></head><body>
<script src="/_next/static/chunks/node_modules_next_dist_compiled_react-dom_096_9a-._.js" async="" nonce="${OLD_NONCE}"></script>
<script src="/_next/static/chunks/node_modules_next_router_19uvnpe.js" async="" nonce="${OLD_NONCE}"></script>
<script nonce="${OLD_NONCE}">(self.__next_f=self.__next_f||[]).push([0])</script>
<script nonce="${OLD_NONCE}">self.__next_f.push([1,"31:[\\"$\\",\\"section\\",null,{\\"className\\":\\"mx-auto max-w"])</script>
</body></html>`;

describe('substituteNonce', () => {
  it('replaces every occurrence across external and inline script tags', () => {
    const newNonce = 'ZmZmZmZmZmYtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAw';
    const result = substituteNonce(REAL_SHAPE_FIXTURE, OLD_NONCE, newNonce);

    expect(result).not.toContain(OLD_NONCE);
    expect(result.split(newNonce).length - 1).toBe(4);
  });

  it('touches nothing outside the nonce value itself', () => {
    const newNonce = 'ZmZmZmZmZmYtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAw';
    const result = substituteNonce(REAL_SHAPE_FIXTURE, OLD_NONCE, newNonce);
    const expectedLengthDelta = (newNonce.length - OLD_NONCE.length) * 4;

    expect(result.length).toBe(REAL_SHAPE_FIXTURE.length + expectedLengthDelta);
    expect(result).toContain('(self.__next_f=self.__next_f||[]).push([0])');
    expect(result).toContain('mx-auto max-w');
  });

  it('refuses a silent no-op when oldNonce is absent', () => {
    expect(() => substituteNonce('<html></html>', OLD_NONCE, 'new')).toThrow(
      'oldNonce not found',
    );
  });
});
