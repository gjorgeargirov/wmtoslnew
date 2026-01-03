// Pages Function for users API (GET all, POST create)
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  // GET all users
  if (request.method === 'GET') {
    try {
      const users = await db.prepare('SELECT id, email, name, role, avatar, department, permissions, created_at, updated_at FROM users ORDER BY id').all();

      // Get projects for each user
      const usersWithProjects = await Promise.all(
        users.results.map(async (user) => {
          const projects = await db.prepare(
            `SELECT p.id, p.name, p.description 
             FROM projects p 
             INNER JOIN user_projects up ON p.id = up.project_id 
             WHERE up.user_id = ?`
          ).bind(user.id).all();

          let permissions = [];
          try {
            permissions = JSON.parse(user.permissions || '[]');
          } catch (e) {
            permissions = [];
          }

          return {
            ...user,
            permissions,
            projects: projects.results || [],
          };
        })
      );

      return new Response(JSON.stringify({ users: usersWithProjects }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Get users error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch users: ' + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // POST create user
  if (request.method === 'POST') {
    try {
      const { email, password, name, role, department, permissions, projects, avatar } = await request.json();

      if (!email || !password || !name) {
        return new Response(JSON.stringify({ error: 'Email, password, and name are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Check if user exists
      const existing = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').bind(email).first();
      if (existing) {
        return new Response(JSON.stringify({ error: 'User with this email already exists' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Insert user
      const permissionsJson = JSON.stringify(permissions || []);
      const result = await db.prepare(
        'INSERT INTO users (email, password, name, role, department, permissions, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(email, password, name, role || 'User', department || '', permissionsJson, avatar || null).run();

      const userId = result.meta.last_row_id;

      // Link projects
      if (projects && projects.length > 0) {
        for (const projectId of projects) {
          await db.prepare('INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?, ?)')
            .bind(userId, projectId).run();
        }
      }

      return new Response(JSON.stringify({ success: true, id: userId }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Create user error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create user: ' + error.message }), {
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
