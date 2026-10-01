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
