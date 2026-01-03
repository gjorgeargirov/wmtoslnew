// Pages Function for migration operations (DELETE by ID)
export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const migrationId = parseInt(params.id);

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (!migrationId) {
    return new Response(JSON.stringify({ error: 'Invalid migration ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  // DELETE migration
  if (request.method === 'DELETE') {
    try {
      const existing = await db.prepare('SELECT id FROM migrations WHERE id = ?').bind(migrationId).first();
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Migration not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      await db.prepare('DELETE FROM migrations WHERE id = ?').bind(migrationId).run();

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Delete migration error:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete migration: ' + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
