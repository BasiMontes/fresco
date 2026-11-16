/**
 * FRESCO-1207 (PR 1 of 4): landing placeholder. Foundation and component pages arrive in later PRs.
 */
export default function DesignSystemPage() {
  return (
    <div data-testid="design_system_home">
      <h1 className="text-h2">Sistema de diseño</h1>
      <p className="mt-2 text-body-md text-tertiary">
        Estamos preparando la documentación: los fundamentos y los componentes llegarán en las próximas entregas.
      </p>
    </div>
  );
}
