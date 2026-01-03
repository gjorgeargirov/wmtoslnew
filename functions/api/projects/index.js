// Pages Function for projects API
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  // GET all projects
  if (request.method === 'GET') {
    try {
      const projects = await db.prepare('SELECT * FROM projects ORDER BY id').all();
      return new Response(JSON.stringify({ projects: projects.results || [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Get projects error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch projects: ' + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // POST create project
  if (request.method === 'POST') {
    try {
      const { name, description } = await request.json();

      if (!name) {
        return new Response(JSON.stringify({ error: 'Project name is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const result = await db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)')
        .bind(name, description || '').run();

      return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Create project error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create project: ' + error.message }), {
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
