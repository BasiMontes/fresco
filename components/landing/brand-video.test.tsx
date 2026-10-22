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

  test('carries a Spanish captions track that is available but off by default (WCAG 1.2.2, FRESCO-1043)', () => {
    const { container } = renderWithProviders(<BrandVideo />);

    const track = container.querySelector('video track[kind="captions"]');
    expect(track).not.toBeNull();
    expect(track?.getAttribute('srclang')).toBe('es');
    expect(track?.getAttribute('src')).toBe('/video/fresco-brand.es.vtt');
    expect(track?.hasAttribute('default')).toBe(false);
  });

  test('the captions file is valid WebVTT with one short music note and no technical remark (FRESCO-1043)', () => {
    const vtt = readFileSync(new URL('../../public/video/fresco-brand.es.vtt', import.meta.url), 'utf8');

    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/);
    expect(vtt).toContain('[Música instrumental]');
    expect(vtt).not.toMatch(/voz/i);
  });
});

/** FRESCO-1044 (WCAG 1.2.3): the video's messages are burned into the picture, so there is a text alternative under it. */
describe('BrandVideo — transcription (FRESCO-1044)', () => {
  test('offers a transcription under the video, closed by default', () => {
    const { container } = renderWithProviders(<BrandVideo />);

    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
    expect(container.querySelector('details > summary')?.textContent).toContain('Transcripción del vídeo');
  });

  test('says the video has no voice and carries the four headlines exactly as they appear in it', () => {
    renderWithProviders(<BrandVideo />);

    expect(screen.getByText(/no tiene voz/i)).toBeInTheDocument();
    for (const headline of [
      'Deja de improvisar en el súper.',
      'Tu semana, lista.',
      'Tu lista, ya hecha.',
      'Aprende de lo que realmente cocinas.',
    ]) {
      expect(screen.getByText(new RegExp(headline.replace(/\./g, '\\.')))).toBeInTheDocument();
    }
  });

  test('lists the six scenes in order', () => {
    const { container } = renderWithProviders(<BrandVideo />);

    const scenes = container.querySelectorAll('details ol > li');
    expect(scenes).toHaveLength(6);
    expect(scenes[0]?.textContent).toContain('Deja de improvisar en el súper.');
    expect(scenes[5]?.textContent).toContain('Aprende de lo que realmente cocinas.');
  });

  test('sits after the video inside the same section', () => {
    const { container } = renderWithProviders(<BrandVideo />);

    const video = container.querySelector('section > video');
    const details = container.querySelector('section > details');
    expect(video).not.toBeNull();
    expect(details).not.toBeNull();
    expect((video as Node).compareDocumentPosition(details as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
