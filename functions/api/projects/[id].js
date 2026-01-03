// Pages Function for project update/delete by ID
export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const projectId = params.id;

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  // PUT update project
  if (request.method === 'PUT') {
    try {
      const { name, description } = await request.json();

      if (!name) {
        return new Response(JSON.stringify({ error: 'Project name is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Check if project exists
      const existing = await db.prepare('SELECT id FROM projects WHERE id = ?').bind(projectId).first();
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Project not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Update project
      await db.prepare('UPDATE projects SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(name, description || '', projectId).run();

      // Get updated project
      const updated = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();

      return new Response(JSON.stringify({ success: true, project: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Update project error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update project: ' + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // DELETE project
  if (request.method === 'DELETE') {
    try {
      // Check if project exists
      const existing = await db.prepare('SELECT id FROM projects WHERE id = ?').bind(projectId).first();
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Project not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Delete project
      await db.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Delete project error:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete project: ' + error.message }), {
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
