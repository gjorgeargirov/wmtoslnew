/**
 * Cloudflare Worker to proxy file uploads to SnapLogic API
 * Replaces the Python proxy_server.py for Cloudflare deployment
 */

// SnapLogic endpoint - can be overridden via environment variable
const SNAPLOGIC_URL = 'https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '3600',
        },
      });
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
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
