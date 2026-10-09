import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';

/**
 * FRESCO-878 — the "añadir al menú" dialog. `@/lib/supabase/client` is the only
 * thing mocked (a fake client with just the calls the flow makes), so the real
 * `listOpenSlots` / `assignRecipeToSlot` run: what the screen offers and what
 * it sends to `assign_recipe_to_slot` are the real code's, not the test's.
 *
 * The plan starts in 2099, so every slot is "today or later" whatever day the
 * suite runs; the past-day rule itself is covered in `lib/api/open-slots.test.ts`
 * and, against the real database, in `tests/db/assign-recipe-to-slot.test.ts`.
 */

const PLAN = {
  id: 'plan-1',
  fecha_inicio: '2099-01-05',
  meal_plan_recipes: [
    { id: 'slot-lunes', dia: 'lunes', tipo_plato: 'comida', estado: 'pendiente', recipes: { nombre: 'Lentejas' } },
    { id: 'slot-martes', dia: 'martes', tipo_plato: 'comida', estado: 'pendiente', recipes: null },
    { id: 'slot-miercoles', dia: 'miercoles', tipo_plato: 'comida', estado: 'cocinada', recipes: { nombre: 'Cocido' } },
    { id: 'slot-lunes-cena', dia: 'lunes', tipo_plato: 'cena', estado: 'pendiente', recipes: { nombre: 'Tortilla' } },
  ],
};

let planResult: { data: unknown, error: { message: string } | null } = { data: PLAN, error: null };
let listaResult: { data: unknown, error: null } = { data: null, error: null };
const rpcMock = mock(async (_fn: string, _args: Record<string, unknown>): Promise<{ data: null, error: { message: string } | null }> => (
  { data: null, error: null }
));

function chain(table: string) {
  const result = () => (table === 'meal_plans' ? planResult : listaResult);
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq']) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = () => ({
    overrideTypes: async () => Promise.resolve(result()),
    then: (resolve: (value: unknown) => unknown) => resolve(result()),
  });
  return builder;
}

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: (table: string) => chain(table),
    rpc: rpcMock,
  }),
}));

const { AddToMenuDialog } = await import('./add-to-menu-dialog');

const RECIPE = { id: 'recipe-9', nombre: 'Paella de verduras', tipoPlato: 'comida' as const };

describe('AddToMenuDialog', () => {
  beforeEach(() => {
    planResult = { data: PLAN, error: null };
    listaResult = { data: null, error: null };
    rpcMock.mockClear();
    routerMock.push.mockClear();
  });

  test('offers only the open slots of the recipe\'s meal type and keeps confirm disabled until one is picked', async () => {
    renderWithProviders(<AddToMenuDialog recipe={RECIPE} onClose={() => {}} />);

    const options = await screen.findAllByTestId('add_to_menu_slot_option');
    expect(options).toHaveLength(2);
    expect(screen.getByText('Ahora: Lentejas')).toBeInTheDocument();
    expect(screen.getByText('Sin receta')).toBeInTheDocument();
    expect(screen.queryByText('Ahora: Cocido')).toBeNull();
    expect(screen.queryByText('Ahora: Tortilla')).toBeNull();
    expect(screen.getByTestId('add_to_menu_confirm_button')).toBeDisabled();
  });

  test('confirming sends the chosen slot and recipe to assign_recipe_to_slot and shows the confirmation', async () => {
    const user = setupUser();
    renderWithProviders(<AddToMenuDialog recipe={RECIPE} onClose={() => {}} />);

    const [first] = await screen.findAllByTestId('add_to_menu_slot_option');
    await user.click(first);
    await user.click(screen.getByTestId('add_to_menu_confirm_button'));

    expect(await screen.findByTestId('add_to_menu_success')).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('assign_recipe_to_slot', { p_slot_id: 'slot-lunes', p_recipe_id: 'recipe-9' });
    expect(screen.queryByTestId('add_to_menu_stale_list_notice')).toBeNull();
  });

  test('warns that an already generated shopping list does not include the change', async () => {
    listaResult = { data: { id: 'list-1' }, error: null };
    const user = setupUser();
    renderWithProviders(<AddToMenuDialog recipe={RECIPE} onClose={() => {}} />);

    const [first] = await screen.findAllByTestId('add_to_menu_slot_option');
    await user.click(first);
    await user.click(screen.getByTestId('add_to_menu_confirm_button'));

    expect(await screen.findByTestId('add_to_menu_stale_list_notice')).toBeInTheDocument();
  });

  test('a server refusal is shown in plain words, never as the raw message, and the dialog stays open to pick another slot', async () => {
    rpcMock.mockImplementationOnce(async () => (
      { data: null, error: { message: 'assign_recipe_to_slot: recipe is not available for this profile' } }
    ));
    const user = setupUser();
    renderWithProviders(<AddToMenuDialog recipe={RECIPE} onClose={() => {}} />);

    const [first] = await screen.findAllByTestId('add_to_menu_slot_option');
    await user.click(first);
    await user.click(screen.getByTestId('add_to_menu_confirm_button'));

    const error = await screen.findByTestId('add_to_menu_error');
    expect(error).toHaveTextContent('no encaja con tu perfil alimentario');
    expect(error).not.toHaveTextContent('assign_recipe_to_slot');
    expect(screen.queryByTestId('add_to_menu_success')).toBeNull();
    expect(screen.getAllByTestId('add_to_menu_slot_option')).toHaveLength(2);
  });

  test('says so when there is no free slot of that meal type this week', async () => {
    planResult = { data: { ...PLAN, meal_plan_recipes: PLAN.meal_plan_recipes.filter(slot => slot.tipo_plato === 'cena') }, error: null };
    renderWithProviders(<AddToMenuDialog recipe={RECIPE} onClose={() => {}} />);

    expect(await screen.findByTestId('add_to_menu_empty_state')).toBeInTheDocument();
    expect(screen.getByTestId('add_to_menu_confirm_button')).toBeDisabled();
  });

  test('says so when there is no menu this week', async () => {
    planResult = { data: null, error: null };
    renderWithProviders(<AddToMenuDialog recipe={RECIPE} onClose={() => {}} />);

    expect(await screen.findByTestId('add_to_menu_empty_state')).toBeInTheDocument();
  });

  test('a failed read shows an error with a retry that loads the slots', async () => {
    planResult = { data: null, error: { message: 'timeout' } };
    const user = setupUser();
    renderWithProviders(<AddToMenuDialog recipe={RECIPE} onClose={() => {}} />);

    expect(await screen.findByTestId('add_to_menu_load_error')).toBeInTheDocument();

    planResult = { data: PLAN, error: null };
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getAllByTestId('add_to_menu_slot_option')).toHaveLength(2));
  });

  test('"Ver calendario" closes the dialog and goes to /calendar after a successful add', async () => {
    const onClose = mock(() => {});
    const user = setupUser();
    renderWithProviders(<AddToMenuDialog recipe={RECIPE} onClose={onClose} />);

    const [first] = await screen.findAllByTestId('add_to_menu_slot_option');
    await user.click(first);
    await user.click(screen.getByTestId('add_to_menu_confirm_button'));
    await user.click(await screen.findByTestId('add_to_menu_view_calendar_button'));

    expect(onClose).toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith('/calendar');
  });

  test('renders nothing while there is no recipe', () => {
    renderWithProviders(<AddToMenuDialog recipe={null} onClose={() => {}} />);

    expect(screen.queryByTestId('add_to_menu_dialog')).toBeNull();
  });
});
