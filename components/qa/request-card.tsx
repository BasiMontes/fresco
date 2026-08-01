import { CodeBlock } from '@/components/qa/code-block';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';

export interface RequestCardProps {
  /** Edge Function name, e.g. `generate-meal-plan`. */
  name: string
  description: string
  method: 'POST' | 'PATCH'
  /** Full invoke URL, e.g. `https://<ref>.functions.supabase.co/<name>`. */
  path: string
  /** Example request body — rendered as formatted JSON and folded into the curl example. */
  body: Record<string, unknown>
}

/**
 * One card per real Edge Function on the "Testing a nivel API" section.
 * `body`/`method`/`path` come straight from `api/schemas/api-contracts.types.ts`
 * (and, for `update-recipe-status`, cross-checked against the live Edge
 * Function source since its request shape wasn't fully covered by a doc
 * comment alone) — never invented shapes.
 */
export async function RequestCard({ name, description, method, path, body }: RequestCardProps) {
  const bodyJson = JSON.stringify(body, null, 2);
  const curl = [
    `curl -X ${method} '${path}' \\`,
    '  -H \'Authorization: Bearer $ACCESS_TOKEN\' \\',
    '  -H \'Content-Type: application/json\' \\',
    `  -d '${JSON.stringify(body)}'`,
  ].join('\n');

  return (
    <Card data-testid={`qa_request_card_${name}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tag variant="accent">{method}</Tag>
          <CardTitle>{name}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <p className="text-caption uppercase text-tertiary">Ruta</p>
          <CodeBlock code={path} lang="text" className="mt-1" />
        </div>

        <div>
          <p className="text-caption uppercase text-tertiary">Headers requeridos</p>
          <CodeBlock
            code={'Authorization: Bearer <token>\nContent-Type: application/json'}
            lang="text"
            className="mt-1"
          />
        </div>

        <div>
          <p className="text-caption uppercase text-tertiary">Body de ejemplo</p>
          <CodeBlock code={bodyJson} lang="json" className="mt-1" />
        </div>

        <div>
          <p className="text-caption uppercase text-tertiary">curl de ejemplo</p>
          <CodeBlock code={curl} lang="bash" className="mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
