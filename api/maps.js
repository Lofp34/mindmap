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
        SELECT id, name, markdown, updated_at
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

      if (!id || !name || !markdown.trim()) {
        return response.status(400).json({ error: 'id, name and markdown are required.' });
      }

      const rows = await sql`
        INSERT INTO mind_maps (id, name, markdown, updated_at)
        VALUES (${id}, ${name}, ${markdown}, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          markdown = EXCLUDED.markdown,
          updated_at = NOW()
        RETURNING id, name, markdown, updated_at
      `;

      return response.status(200).json({ map: toClientMap(rows[0]) });
    }

    response.setHeader('Allow', 'GET, POST');
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
}

function toClientMap(row) {
  return {
    id: row.id,
    name: row.name,
    markdown: row.markdown,
    updatedAt: row.updated_at,
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
