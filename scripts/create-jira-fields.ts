import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

// Configuración desde variables de entorno
const JIRA_URL = process.env.ATLASSIAN_URL;
const JIRA_EMAIL = process.env.ATLASSIAN_EMAIL;
const JIRA_TOKEN = process.env.ATLASSIAN_API_TOKEN;

if (!JIRA_URL || !JIRA_EMAIL || !JIRA_TOKEN) {
  console.error('❌ Faltan variables de entorno: ATLASSIAN_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN');
  process.exit(1);
}

// Mapeo de tipos genéricos a tipos de Jira Cloud
const TYPE_MAP: Record<string, string> = {
  string: 'com.atlassian.jira.plugin.system.customfieldtypes:textarea',
  number: 'com.atlassian.jira.plugin.system.customfieldtypes:float',
  option: 'com.atlassian.jira.plugin.system.customfieldtypes:select',
};

// Interfaz para la configuración de cada campo
interface FieldConfig {
  name: string
  type: 'string' | 'number' | 'option'
  description?: string
  used_by?: string[] | string
  options?: string[]
  fallback?: {
    target: 'comment' | 'description'
    label: string
  }
}

// Interfaz para el manifiesto completo
interface JiraManifest {
  required: Record<string, FieldConfig>
  optional?: Record<string, FieldConfig>
  unmapped?: Record<string, unknown>
  statuses?: Record<string, unknown>
  link_types?: Record<string, unknown>
  work_types?: Record<string, unknown>
}

// Función para crear un campo personalizado en Jira
async function createCustomField(
  slug: string,
  field: FieldConfig,
): Promise<string | null> {
  const jiraType = TYPE_MAP[field.type];
  if (!jiraType) {
    console.warn(`⚠️  Tipo desconocido para ${field.name}: ${field.type}`);
    return null;
  }

  const payload = {
    name: field.name,
    description: field.description || `Campo personalizado para ${field.name}`,
    type: jiraType,
  };

  try {
    const response = await fetch(`${JIRA_URL}/rest/api/3/field`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error creando ${field.name}: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ Creado: ${field.name} (ID: ${data.id})`);
    return data.id;
  }
  catch (error) {
    console.error(`❌ Excepción creando ${field.name}:`, error);
    return null;
  }
}

// Función para obtener el contexto de un campo
async function getFieldContext(fieldId: string): Promise<string | null> {
  try {
    const response = await fetch(`${JIRA_URL}/rest/api/3/field/${fieldId}/context`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️  Error obteniendo contexto de ${fieldId}: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    if (data.values && data.values.length > 0) {
      return data.values[0].id;
    }
    return null;
  }
  catch (error) {
    console.warn(`⚠️  Excepción obteniendo contexto de ${fieldId}:`, error);
    return null;
  }
}

// Función para añadir opciones a un campo de tipo select
async function addSelectOptions(fieldId: string, options: string[]): Promise<void> {
  // Primero obtenemos el contexto del campo
  const contextId = await getFieldContext(fieldId);

  if (!contextId) {
    console.warn(`⚠️  No se pudo obtener el contexto para ${fieldId}. Las opciones no se añadirán.`);
    return;
  }

  const payload = {
    options: options.map(opt => ({ value: opt })),
  };

  try {
    const response = await fetch(
      `${JIRA_URL}/rest/api/3/field/${fieldId}/context/${contextId}/option`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`)}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️  Error añadiendo opciones a ${fieldId}: ${response.status} - ${errorText}`);
    }
    else {
      console.log(`   ↳ Opciones añadidas: ${options.join(', ')}`);
    }
  }
  catch (error) {
    console.warn(`⚠️  Excepción añadiendo opciones a ${fieldId}:`, error);
  }
}

// Función principal
async function main(): Promise<void> {
  const manifestPath = resolve('.agents/jira-required.yaml');

  if (!existsSync(manifestPath)) {
    console.error(`❌ No se encontró el archivo: ${manifestPath}`);
    process.exit(1);
  }

  const manifestContent = readFileSync(manifestPath, 'utf-8');
  const manifest = parse(manifestContent) as JiraManifest;

  if (!manifest || !manifest.required || typeof manifest.required !== 'object') {
    console.error('❌ El manifiesto no tiene la estructura esperada (required: object)');
    process.exit(1);
  }

  const requiredFields = Object.entries(manifest.required);
  console.log(`📋 Leyendo ${requiredFields.length} campos requeridos desde el manifiesto...\n`);

  let createdCount = 0;
  let failedCount = 0;

  for (const [slug, field] of requiredFields) {
    console.log(`🔄 Procesando: ${field.name} (${field.type}) [slug: ${slug}]`);
    const fieldId = await createCustomField(slug, field);

    if (fieldId) {
      createdCount++;

      // Si es un campo de tipo option, añadir las opciones predefinidas
      if (field.type === 'option' && field.options && field.options.length > 0) {
        await addSelectOptions(fieldId, field.options);
      }
    }
    else {
      failedCount++;
    }

    // Pequeña pausa para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Resumen: ✅ ${createdCount} creados | ❌ ${failedCount} fallidos`);

  if (failedCount > 0) {
    console.log('\n💡 Algunos campos pudieron haber fallado porque ya existen o por permisos.');
    console.log('   Ejecuta `bun run jira:check` para ver el estado actual.');
  }
  else {
    console.log('\n🎉 ¡Todos los campos fueron creados exitosamente!');
    console.log('   Ahora ejecuta: bun run jira:sync-fields --force');
    console.log('   Y luego: bun run jira:check');
  }
}

main().catch((error) => {
  console.error('❌ Error inesperado:', error);
  process.exit(1);
});
