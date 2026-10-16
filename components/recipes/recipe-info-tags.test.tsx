import type { RecipeInfoTag } from './recipe-info-tags';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { RecipeInfoTags } from './recipe-info-tags';

/**
 * FRESCO-973 (UX-25) — the "+N" overflow chip must reveal the hidden tags
 * instead of being a dead pill.
 */

const TAGS: RecipeInfoTag[] = [
  { label: 'Mediterránea', variant: 'neutral' },
  { label: 'Vegetariano', variant: 'accent' },
  { label: 'Vegano', variant: 'accent' },
  { label: 'Sin gluten', variant: 'accent' },
  { label: 'Keto', variant: 'accent' },
];

describe('RecipeInfoTags', () => {
  test('caps the visible tags and shows the hidden count on the toggle', () => {
    renderWithProviders(<RecipeInfoTags tags={TAGS} maxVisible={3} />);

    expect(screen.getByText('Vegano')).toBeInTheDocument();
    expect(screen.queryByText('Sin gluten')).toBeNull();
    expect(screen.getByTestId('recipe_detail_tags_toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  test('expands every tag on click and collapses again', async () => {
    const user = setupUser();
    renderWithProviders(<RecipeInfoTags tags={TAGS} maxVisible={3} />);

    await user.click(screen.getByTestId('recipe_detail_tags_toggle'));

    expect(screen.getByText('Sin gluten')).toBeInTheDocument();
    expect(screen.getByText('Keto')).toBeInTheDocument();
    expect(screen.getByTestId('recipe_detail_tags_toggle')).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByTestId('recipe_detail_tags_toggle'));

    expect(screen.queryByText('Keto')).toBeNull();
  });

  test('renders no toggle when everything fits', () => {
    renderWithProviders(<RecipeInfoTags tags={TAGS.slice(0, 3)} maxVisible={3} />);

    expect(screen.queryByTestId('recipe_detail_tags_toggle')).toBeNull();
  });
});
