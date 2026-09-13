interface JsonLdProps {
  data: object
}

/**
 * Renders one `<script type="application/ld+json">` block for a schema.org
 * object (FRESCO-472). Server-renderable — no client runtime needed.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
