import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

export default async function handler(request, response) {
  if (!DATABASE_URL) {
    return response.status(503).json({ error: 'DATABASE_URL is not configured.' });
  }

  try {
    const sql = neon(DATABASE_URL);
    await ensureSchema(sql);

    if (request.method === 'GET') {
      const rows = await sql`
        SELECT id, name, markdown, updated_at, archived_at, template_at
        FROM mind_maps
        ORDER BY updated_at DESC
      `;
      return response.status(200).json({ maps: rows.map(toClientMap) });
    }

    if (request.method === 'POST') {
      const body = normalizeBody(request.body);
      const id = cleanText(body.id);
      const name = cleanText(body.name);
      const markdown = typeof body.markdown === 'string' ? body.markdown : '';
      const archivedAt = normalizeTimestamp(body.archivedAt);
      const templateAt = normalizeTimestamp(body.templateAt);

      if (!id || !name || !markdown.trim()) {
        return response.status(400).json({ error: 'id, name and markdown are required.' });
      }

      const rows = await sql`
        INSERT INTO mind_maps (id, name, markdown, archived_at, template_at, updated_at)
        VALUES (${id}, ${name}, ${markdown}, ${archivedAt}, ${templateAt}, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          markdown = EXCLUDED.markdown,
          archived_at = EXCLUDED.archived_at,
          template_at = EXCLUDED.template_at,
          updated_at = NOW()
        RETURNING id, name, markdown, updated_at, archived_at, template_at
      `;

      return response.status(200).json({ map: toClientMap(rows[0]) });
    }

    if (request.method === 'DELETE') {
      const id = cleanText(request.query?.id ?? new URL(request.url, 'http://localhost').searchParams.get('id'));
      if (!id) {
        return response.status(400).json({ error: 'id is required.' });
      }

      await sql`
        DELETE FROM mind_maps
        WHERE id = ${id} AND archived_at IS NOT NULL
      `;

      return response.status(204).end();
    }

    response.setHeader('Allow', 'GET, POST, DELETE');
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS mind_maps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      markdown TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE mind_maps
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE mind_maps
    ADD COLUMN IF NOT EXISTS template_at TIMESTAMPTZ
  `;
}

function toClientMap(row) {
  return {
    id: row.id,
    name: row.name,
    markdown: row.markdown,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    templateAt: row.template_at,
  };
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
