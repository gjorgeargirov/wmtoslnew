// Pages Function for user operations (PUT update, DELETE)
export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const userId = parseInt(params.id);

  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
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
        'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  // PUT update user
  if (request.method === 'PUT') {
    try {
      const { email, password, name, role, department, permissions, projects, avatar } = await request.json();

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (email) {
        const existing = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
          .bind(email, userId).first();
        if (existing) {
          return new Response(JSON.stringify({ error: 'Email already in use' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
        updates.push('email = ?');
        values.push(email);
      }
      if (password) {
        updates.push('password = ?');
        values.push(password);
      }
      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      if (role) {
        updates.push('role = ?');
        values.push(role);
      }
      if (department !== undefined) {
        updates.push('department = ?');
        values.push(department);
      }
      if (permissions) {
        updates.push('permissions = ?');
        values.push(JSON.stringify(permissions));
      }
      if (avatar !== undefined) {
        // Allow null to clear avatar, or set new avatar
        updates.push('avatar = ?');
        values.push(avatar || null);
      }
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);

      if (updates.length > 1) {
        await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
          .bind(...values).run();
      }

      // Update projects if provided
      if (projects !== undefined) {
        await db.prepare('DELETE FROM user_projects WHERE user_id = ?').bind(userId).run();
        if (projects.length > 0) {
          for (const projectId of projects) {
            await db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)')
              .bind(userId, projectId).run();
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Update user error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update user: ' + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // DELETE user
  if (request.method === 'DELETE') {
    try {
      await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Delete user error:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete user: ' + error.message }), {
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
