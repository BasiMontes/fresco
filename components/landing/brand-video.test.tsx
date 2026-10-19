import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { BrandVideo } from './brand-video';

/**
 * FRESCO-761 — the brand video must not weigh on the landing's first load and
 * must never start on its own with sound. Tests pin both guarantees.
 */

describe('BrandVideo', () => {
  test('does not preload the file and shows a poster until played', () => {
    renderWithProviders(<BrandVideo />);

    const video = screen.getByLabelText('Vídeo de presentación de Fresco');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).toHaveAttribute('poster', '/video/fresco-brand-poster.jpg');
  });

  test('exposes controls and never autoplays', () => {
    renderWithProviders(<BrandVideo />);

    const video = screen.getByLabelText('Vídeo de presentación de Fresco');
    expect(video).toHaveAttribute('controls');
    expect(video).not.toHaveAttribute('autoplay');
  });

  test('points at the brand video file', () => {
    const { container } = renderWithProviders(<BrandVideo />);

    expect(container.querySelector('source')).toHaveAttribute('src', '/video/fresco-brand.mp4');
  });
});

/** FRESCO-1013 (A7-UI-17): the landing video shows where keyboard focus is and carries a Spanish captions track. */
describe('BrandVideo — keyboard focus and captions (FRESCO-1013)', () => {
  test('has a visible focus ring for keyboard users (WCAG 2.4.7)', () => {
    const { container } = renderWithProviders(<BrandVideo />);

    expect(container.querySelector('video')?.className).toContain('focus-visible:ring-2');
  });

  test('carries a Spanish captions track, on by default (WCAG 1.2.2)', () => {
    const { container } = renderWithProviders(<BrandVideo />);

    const track = container.querySelector('video track[kind="captions"]');
    expect(track).not.toBeNull();
    expect(track?.getAttribute('srclang')).toBe('es');
    expect(track?.getAttribute('src')).toBe('/video/fresco-brand.es.vtt');
    expect(track?.hasAttribute('default')).toBe(true);
  });

  test('the captions file is valid WebVTT and says the video has no voice', () => {
    const vtt = readFileSync(new URL('../../public/video/fresco-brand.es.vtt', import.meta.url), 'utf8');

    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/);
    expect(vtt).toContain('Música instrumental');
  });
});
