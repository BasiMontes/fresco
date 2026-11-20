import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { parse } from 'yaml';
import { renderWithProviders, screen } from '@/tests/component-render';
import { ALERT_BANNER_DEFAULT_TITLE, AlertBanner } from './alert-banner';

/**
 * FRESCO-1233 — the Aviso has a spec in DESIGN.md (§Components → "Alert / Aviso") and the component follows it.
 * Behaviour (food-safety surface: always visible, announced, never dismissible) and the token contract.
 */

const WARNINGS = ['No hemos encontrado una cena sin gluten para el jueves.', 'Revisa los ingredientes antes de cocinar.', 'El menú supera tu presupuesto semanal en aproximadamente 4,20€'];

describe('AlertBanner behaviour', () => {
  test('renders nothing when there are no warnings', () => {
    const { container, rerender } = renderWithProviders(<AlertBanner advertencias={[]} />);

    expect(container).toBeEmptyDOMElement();
    rerender(<AlertBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders every warning, in the order given', () => {
    renderWithProviders(<AlertBanner advertencias={WARNINGS} />);

    const items = screen.getAllByRole('listitem');

    expect(items.map(item => item.textContent)).toEqual(WARNINGS);
  });

  test('a single warning is still a list item with its text', () => {
    renderWithProviders(<AlertBanner advertencias={[WARNINGS[0]]} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(WARNINGS[0]);
  });

  test('is announced: role alert with an assertive live region', () => {
    renderWithProviders(<AlertBanner advertencias={WARNINGS} />);

    const alert = screen.getByRole('alert');

    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  test('shows the default title, which is not the old template phrase', () => {
    renderWithProviders(<AlertBanner advertencias={WARNINGS} />);

    expect(screen.getByText(ALERT_BANNER_DEFAULT_TITLE)).toBeInTheDocument();
    expect(ALERT_BANNER_DEFAULT_TITLE).toBe('A tener en cuenta');
    expect(screen.queryByText('Antes de continuar')).not.toBeInTheDocument();
  });

  test('the title is a prop and replaces the default', () => {
    renderWithProviders(<AlertBanner advertencias={WARNINGS} title="Sobre tu menú de esta semana" />);

    expect(screen.getByText('Sobre tu menú de esta semana')).toBeInTheDocument();
    expect(screen.queryByText(ALERT_BANNER_DEFAULT_TITLE)).not.toBeInTheDocument();
  });

  test('the title is not leaked to the DOM as a tooltip attribute', () => {
    renderWithProviders(<AlertBanner advertencias={WARNINGS} title="Sobre tu menú" />);

    expect(screen.getByRole('alert')).not.toHaveAttribute('title');
  });

  test('cannot be dismissed: no button, no link, nothing interactive inside', () => {
    renderWithProviders(<AlertBanner advertencias={WARNINGS} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('alert').querySelector('button, a, [tabindex], input')).toBeNull();
  });

  test('the icon is decorative (aria-hidden) and the title row keeps the meaning in text', () => {
    renderWithProviders(<AlertBanner advertencias={WARNINGS} />);

    const icon = screen.getByRole('alert').querySelector('svg');

    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('stroke-width', '2');
  });

  test('forwards the ref, merges className and passes data-testid through', () => {
    const ref = { current: null as HTMLDivElement | null };

    renderWithProviders(<AlertBanner ref={ref} advertencias={WARNINGS} className="mt-6" data-testid="menu_advertencias_banner" />);

    const alert = screen.getByTestId('menu_advertencias_banner');

    expect(ref.current).toBe(alert);
    expect(alert).toHaveClass('mt-6');
    expect(alert).toHaveClass('rounded-card');
  });
});

/** Token contract: the classes the component uses are the DESIGN.md `alert` tokens, and their contrast clears AA in both themes. */
const root = new URL('../../', import.meta.url);
const css = readFileSync(new URL('app/globals.css', root), 'utf8');
const designMd = readFileSync(new URL('DESIGN.md', root), 'utf8');
const frontmatter = parse(/^---\n([\s\S]*?)\n---/.exec(designMd)?.[1] ?? '') as { components: Record<string, Record<string, string>> };

function ramp(name: string): { light: string, dark: string } {
  const match = new RegExp(`--raw-color-${name}:\\s*light-dark\\((#[0-9a-fA-F]{6}),\\s*(#[0-9a-fA-F]{6})\\)`).exec(css);
  if (!match) { throw new Error(`token ${name} not found as light-dark(...) in globals.css`); }
  return { light: match[1], dark: match[2] };
}

function luminance(hex: string): number {
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('AlertBanner token contract (DESIGN.md → alert)', () => {
  const alertTokens = frontmatter.components.alert;
  const rampStep = (ref: string) => /^\{colors\.(accent-2-\d+)\}$/.exec(ref)?.[1] as string;

  test('DESIGN.md specifies the alert with the allergen-tag pair and the card radius', () => {
    expect(alertTokens.backgroundColor).toBe(frontmatter.components['tag-allergen'].backgroundColor);
    expect(alertTokens.textColor).toBe(frontmatter.components['tag-allergen'].textColor);
    expect(alertTokens.rounded).toBe('{rounded.card}');
    expect(frontmatter.components['alert-title'].typography).toBe('{typography.h6}');
  });

  test('the rendered classes are exactly those tokens, with no side stripe, no hex and no per-component dark: colour', () => {
    renderWithProviders(<AlertBanner advertencias={WARNINGS} />);

    const alert = screen.getByRole('alert');
    const fill = rampStep(alertTokens.backgroundColor);
    const text = rampStep(alertTokens.textColor);
    const border = rampStep(alertTokens.borderColor);

    expect(alert).toHaveClass(`bg-${fill}`, `text-${text}`, `border-${border}`, 'border', 'rounded-card');
    expect(alert.outerHTML).not.toMatch(/border-l|border-r-|border-t-4|rounded-md|shadow|dark:|#[0-9a-fA-F]{3,6}\b/);
  });

  test.each(['light', 'dark'] as const)('text and icon on the fill clear 4.5:1 in the %s theme', (theme) => {
    const fill = ramp(rampStep(alertTokens.backgroundColor))[theme];
    const text = ramp(rampStep(alertTokens.textColor))[theme];

    expect(contrast(text, fill)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(['light', 'dark'] as const)('the hairline clears 3:1 on its fill and on the page in the %s theme', (theme) => {
    const border = ramp(rampStep(alertTokens.borderColor))[theme];
    const fill = ramp(rampStep(alertTokens.backgroundColor))[theme];
    const page = ramp('background')[theme];

    expect(contrast(border, fill)).toBeGreaterThanOrEqual(3);
    expect(contrast(border, page)).toBeGreaterThanOrEqual(3);
  });
});
