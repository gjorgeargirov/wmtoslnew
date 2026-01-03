// Pages Function for migrations API (GET all, POST create)
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
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  // GET all migrations
  if (request.method === 'GET') {
    try {
      const migrations = await db.prepare(`
        SELECT 
          m.id,
          m.execution_id,
          m.file_name,
          m.status,
          m.start_time,
          m.end_time,
          m.duration,
          m.result_data,
          m.created_at,
          u.email as user_email,
          u.name as user_name,
          p.name as project_name
        FROM migrations m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN projects p ON m.project_id = p.id
        ORDER BY m.created_at DESC
      `).all();

      const migrationsWithData = (migrations.results || []).map(migration => {
        let resultData = null;
        try {
          resultData = migration.result_data ? JSON.parse(migration.result_data) : null;
        } catch (e) {
          resultData = null;
        }

        // Convert status format: in_progress -> in-progress (for frontend compatibility)
        let status = migration.status;
        if (status === 'in_progress') {
          status = 'in-progress';
        }
        
        // Convert start_time to milliseconds timestamp for duration calculation
        let startTimeMs = null;
        if (migration.start_time) {
          startTimeMs = new Date(migration.start_time).getTime();
        }
        
        return {
          id: migration.id,
          executionId: migration.execution_id,
          fileName: migration.file_name,
          status: status,
          timestamp: migration.start_time || migration.created_at,
          startTime: startTimeMs, // Convert to milliseconds timestamp
          endTime: migration.end_time,
          duration: migration.duration ? migration.duration * 1000 : null, // Convert seconds to milliseconds
          user: migration.user_email,
          userName: migration.user_name,
          project: migration.project_name || 'Unassigned',
          message: resultData?.message || '',
          resultData: resultData
        };
      });

      return new Response(JSON.stringify({ migrations: migrationsWithData }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Get migrations error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch migrations: ' + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // POST create migration
  if (request.method === 'POST') {
    try {
      const { executionId, userId, projectId, fileName, status, startTime, endTime, duration, resultData } = await request.json();

      if (!executionId || !userId) {
        return new Response(JSON.stringify({ error: 'Execution ID and user ID are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Convert status format: in-progress -> in_progress (for database)
      let dbStatus = status;
      if (status === 'in-progress') {
        dbStatus = 'in_progress';
      }
      
      // Check if migration with this execution ID already exists
      const existing = await db.prepare('SELECT id FROM migrations WHERE execution_id = ?').bind(executionId).first();
      if (existing) {
        // Update existing migration
        const resultDataJson = resultData ? JSON.stringify(resultData) : null;
        await db.prepare(`
          UPDATE migrations 
          SET status = ?, end_time = ?, duration = ?, result_data = ?
          WHERE execution_id = ?
        `).bind(dbStatus, endTime || null, duration ? Math.floor(duration / 1000) : null, resultDataJson, executionId).run();

        return new Response(JSON.stringify({ success: true, id: existing.id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Insert new migration
      const resultDataJson = resultData ? JSON.stringify(resultData) : null;
      const result = await db.prepare(`
        INSERT INTO migrations (execution_id, user_id, project_id, file_name, status, start_time, end_time, duration, result_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        executionId,
        userId,
        projectId || null,
        fileName || null,
        dbStatus,
        startTime || null,
        endTime || null,
        duration ? Math.floor(duration / 1000) : null, // Convert milliseconds to seconds
        resultDataJson
      ).run();

      return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Create migration error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create migration: ' + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // DELETE all migrations
  if (request.method === 'DELETE') {
    try {
      await db.prepare('DELETE FROM migrations').run();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('Delete all migrations error:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete migrations: ' + error.message }), {
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
