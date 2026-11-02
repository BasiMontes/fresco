import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { ProfileIdentityCard } from './profile-identity-card';

// FRESCO-1078 — who the profile says you are: a guest sees a plain badge (no email exists),
// a registered user sees their email and a fixed masked-password placeholder, never a real one.

const base = { nombre: 'Laura', email: 'laura@fresco.app', isAnonymous: false, plan: 'free' as const };

describe('ProfileIdentityCard', () => {
  test('greets the user by name and shows the initial', () => {
    renderWithProviders(<ProfileIdentityCard {...base} />);
    expect(screen.getByText('¡Hola, Laura!')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  test('uses the first letter, uppercased and trimmed', () => {
    renderWithProviders(<ProfileIdentityCard {...base} nombre="  marta" />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  test('without a name it greets plainly and shows an icon instead of an initial', () => {
    const { container } = renderWithProviders(<ProfileIdentityCard {...base} nombre={null} />);
    expect(screen.getByText('¡Hola!')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  test('a registered user sees the email and the masked password placeholder', () => {
    renderWithProviders(<ProfileIdentityCard {...base} />);
    expect(screen.getByTestId('profile_identity_email')).toHaveTextContent('laura@fresco.app');
    expect(screen.getByTestId('profile_identity_password_masked')).toHaveTextContent('••••••••');
    expect(screen.queryByTestId('profile_identity_guest_tag')).toBeNull();
  });

  test('a guest sees only the Invitada badge: no email, no password row', () => {
    renderWithProviders(<ProfileIdentityCard {...base} isAnonymous email={undefined} />);
    expect(screen.getByTestId('profile_identity_guest_tag')).toHaveTextContent('Invitada');
    expect(screen.queryByTestId('profile_identity_email')).toBeNull();
    expect(screen.queryByTestId('profile_identity_password_masked')).toBeNull();
  });

  test('shows the plan label for each plan', () => {
    const { unmount } = renderWithProviders(<ProfileIdentityCard {...base} plan="free" />);
    expect(screen.getByText('Plan Free')).toBeInTheDocument();
    unmount();
    renderWithProviders(<ProfileIdentityCard {...base} plan="pro" />);
    expect(screen.getByText('Plan Pro')).toBeInTheDocument();
  });
});
