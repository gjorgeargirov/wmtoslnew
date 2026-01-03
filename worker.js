/**
 * Cloudflare Worker to proxy file uploads to SnapLogic API
 * Also handles user management API endpoints using D1 database
 */

// SnapLogic endpoint - can be overridden via environment variable
const SNAPLOGIC_URL = 'https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API';

// CORS headers helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '3600',
};

// JSON response helper
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Error response helper
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // API Routes for user management
    if (pathname.startsWith('/api/')) {
      return handleAPIRequest(request, env, pathname);
    }

    // Provide helpful message for GET requests to /upload
    if (request.method === 'GET' && pathname === '/upload') {
      return new Response(
        JSON.stringify({
          message: 'This endpoint only accepts POST requests',
          usage: 'Send a POST request with your file data to /upload',
          worker: 'wmtoslnew',
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Allow': 'POST, OPTIONS',
          },
        }
      );
    }

    // Only handle POST requests to /upload
    if (request.method === 'POST' && pathname === '/upload') {
      try {
        // Get API token from environment variable (set in Cloudflare dashboard)
        const apiToken = env.SNAPLOGIC_API_TOKEN || env.API_TOKEN;
        
        if (!apiToken) {
          return new Response(
            JSON.stringify({
              error: 'API token not configured',
              message: 'SNAPLOGIC_API_TOKEN environment variable is not set in Cloudflare Worker settings'
            }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        // Get the SnapLogic URL from environment or use default
        const snapLogicUrl = env.SNAPLOGIC_URL || SNAPLOGIC_URL;

        // Clone the request to forward it
        // We need to preserve the body and headers
        const contentType = request.headers.get('Content-Type') || '';
        
        // Get the request body
        const body = await request.arrayBuffer();

        // Create new request to SnapLogic
        const snapLogicRequest = new Request(snapLogicUrl, {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
            'Authorization': `Bearer ${apiToken}`,
            'Content-Length': body.byteLength.toString(),
          },
          body: body,
        });

        // Forward the request to SnapLogic
        try {
          const response = await fetch(snapLogicRequest, {
            // Set a longer timeout for large file uploads (5 minutes)
            signal: AbortSignal.timeout(300000),
          });

          // Get response data
          const responseData = await response.arrayBuffer();
          const responseText = new TextDecoder().decode(responseData);

          // Send response back to client
          return new Response(responseData, {
            status: response.status,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json', // Force JSON content-type
            },
          });

        } catch (fetchError) {
          // Handle fetch errors (network, timeout, etc.)
          console.error('SnapLogic request failed:', fetchError);
          
          return new Response(
            JSON.stringify({
              error: 'SnapLogic request failed',
              message: fetchError.message || 'Failed to connect to SnapLogic API',
              details: fetchError.name === 'AbortError' ? 'Request timeout (exceeded 5 minutes)' : undefined
            }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

      } catch (error) {
        // Handle any other errors
        console.error('Proxy error:', error);
        
        return new Response(
          JSON.stringify({
            error: 'Proxy server error',
            message: error.message || 'Unknown error occurred',
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // 404 for other paths
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders,
    });
  },
};

// Handle API requests
async function handleAPIRequest(request, env, pathname) {
  const db = env.DB;
  
  if (!db) {
    return errorResponse('Database not configured. Please set up D1 database.', 500);
  }

  // User authentication endpoint
  if (pathname === '/api/users/login' && request.method === 'POST') {
    try {
      const { email, password } = await request.json();
      
      if (!email || !password) {
        return errorResponse('Email and password are required', 400);
      }

      // Find user by email
      const user = await db.prepare(
        'SELECT * FROM users WHERE LOWER(email) = LOWER(?)'
      ).bind(email).first();

      if (!user || user.password !== password) {
        return errorResponse('Invalid email or password', 401);
      }

      // Get user projects
      const projects = await db.prepare(
        `SELECT p.id, p.name, p.description 
         FROM projects p 
         INNER JOIN user_projects up ON p.id = up.project_id 
         WHERE up.user_id = ?`
      ).bind(user.id).all();

      // Parse permissions
      let permissions = [];
      try {
        permissions = JSON.parse(user.permissions || '[]');
      } catch (e) {
        permissions = [];
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return jsonResponse({
        success: true,
        user: {
          ...userWithoutPassword,
          permissions,
          projects: projects.results || [],
        },
        token: `token-${user.id}-${Date.now()}`,
      });
    } catch (error) {
      console.error('Login error:', error);
      return errorResponse('Login failed: ' + error.message, 500);
    }
  }

  // Get all users (admin only - add auth check in production)
  if (pathname === '/api/users' && request.method === 'GET') {
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

      return jsonResponse({ users: usersWithProjects });
    } catch (error) {
      console.error('Get users error:', error);
      return errorResponse('Failed to fetch users: ' + error.message, 500);
    }
  }

  // Create user
  if (pathname === '/api/users' && request.method === 'POST') {
    try {
      const { email, password, name, role, department, permissions, projects } = await request.json();
      
      if (!email || !password || !name) {
        return errorResponse('Email, password, and name are required', 400);
      }

      // Check if user exists
      const existing = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').bind(email).first();
      if (existing) {
        return errorResponse('User with this email already exists', 409);
      }

      // Insert user
      const permissionsJson = JSON.stringify(permissions || []);
      const result = await db.prepare(
        'INSERT INTO users (email, password, name, role, department, permissions) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        email,
        password,
        name,
        role || 'User',
        department || '',
        permissionsJson
      ).run();

      const userId = result.meta.last_row_id;

      // Link projects
      if (projects && projects.length > 0) {
        for (const projectId of projects) {
          await db.prepare('INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?, ?)')
            .bind(userId, projectId).run();
        }
      }

      return jsonResponse({ success: true, id: userId }, 201);
    } catch (error) {
      console.error('Create user error:', error);
      return errorResponse('Failed to create user: ' + error.message, 500);
    }
  }

  // Update user
  if (pathname.startsWith('/api/users/') && request.method === 'PUT') {
    try {
      const userId = parseInt(pathname.split('/')[3]);
      if (!userId) {
        return errorResponse('Invalid user ID', 400);
      }

      const { email, password, name, role, department, permissions, projects } = await request.json();

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (email) {
        // Check if email is already taken by another user
        const existing = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
          .bind(email, userId).first();
        if (existing) {
          return errorResponse('Email already in use', 409);
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
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);

      if (updates.length > 1) {
        await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
          .bind(...values).run();
      }

      // Update projects if provided
      if (projects !== undefined) {
        // Remove existing project links
        await db.prepare('DELETE FROM user_projects WHERE user_id = ?').bind(userId).run();
        // Add new project links
        if (projects.length > 0) {
          for (const projectId of projects) {
            await db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)')
              .bind(userId, projectId).run();
          }
        }
      }

      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Update user error:', error);
      return errorResponse('Failed to update user: ' + error.message, 500);
    }
  }

  // Delete user
  if (pathname.startsWith('/api/users/') && request.method === 'DELETE') {
    try {
      const userId = parseInt(pathname.split('/')[3]);
      if (!userId) {
        return errorResponse('Invalid user ID', 400);
      }

      await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Delete user error:', error);
      return errorResponse('Failed to delete user: ' + error.message, 500);
    }
  }

  // Get all projects
  if (pathname === '/api/projects' && request.method === 'GET') {
    try {
      const projects = await db.prepare('SELECT * FROM projects ORDER BY id').all();
      return jsonResponse({ projects: projects.results || [] });
    } catch (error) {
      console.error('Get projects error:', error);
      return errorResponse('Failed to fetch projects: ' + error.message, 500);
    }
  }

  // Create project
  if (pathname === '/api/projects' && request.method === 'POST') {
    try {
      const { name, description } = await request.json();
      
      if (!name) {
        return errorResponse('Project name is required', 400);
      }

      const result = await db.prepare(
        'INSERT INTO projects (name, description) VALUES (?, ?)'
      ).bind(name, description || '').run();

      return jsonResponse({ success: true, id: result.meta.last_row_id }, 201);
    } catch (error) {
      console.error('Create project error:', error);
      return errorResponse('Failed to create project: ' + error.message, 500);
    }
  }

  return errorResponse('API endpoint not found', 404);
}
