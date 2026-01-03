// Pages Function for file upload to SnapLogic
const SNAPLOGIC_URL = 'https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Get API token from environment variable (set in Cloudflare Pages settings)
    const apiToken = env.SNAPLOGIC_API_TOKEN || env.API_TOKEN;

    if (!apiToken) {
      return new Response(
        JSON.stringify({
          error: 'API token not configured',
          message: 'SNAPLOGIC_API_TOKEN environment variable is not set in Cloudflare Pages settings'
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

    // Get the request body
    const contentType = request.headers.get('Content-Type') || '';
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
        signal: AbortSignal.timeout(300000), // 5 minutes
      });

      const responseData = await response.arrayBuffer();

      return new Response(responseData, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchError) {
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

export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      message: 'This endpoint only accepts POST requests',
      usage: 'Send a POST request with your file data to /upload',
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

export async function onRequestOptions() {
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
