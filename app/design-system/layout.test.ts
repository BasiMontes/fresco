import { describe, expect, test } from 'bun:test';
import DesignSystemLayout, { metadata } from './layout';

describe('design-system layout', () => {
  test('is noindex, nofollow (FRESCO-1207)', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  test('renders the single main landmark the skip link targets', () => {
    const element = DesignSystemLayout({ children: null });

    expect(element.type).toBe('main');
    expect(element.props.id).toBe('main');
  });
});
