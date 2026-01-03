// API Configuration
const CONFIG = {
  // Demo mode - set to true for testing without backend
  // Set to false when backend is ready and properly configured
  DEMO_MODE: false,  // DISABLED: Using real backend API
  
  // USE_PROXY: Set to true to use proxy server (bypasses CORS)
  // When deployed, update PROXY_ENDPOINT to your serverless function URL
  USE_PROXY: true,
  
  // Proxy endpoint (if USE_PROXY is true)
  // Local development: http://localhost:8001/upload
  // After deployment: https://your-site.netlify.app/.netlify/functions/upload
  //                    or https://your-site.vercel.app/upload
  PROXY_ENDPOINT: 'http://localhost:8001/upload',

  
  // SnapLogic feed endpoint - direct endpoint for file upload
  // Used when USE_PROXY is false OR when proxy needs to know the target
  SNAPLOGIC_ENDPOINT: 'https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API',
  
  // API Authentication - Bearer token for SnapLogic
  // SECURITY: Token is NOT stored here! It's only in proxy_server.py (server-side)
  // The proxy handles authentication, frontend never sees the token
  API_TOKEN: null, // Removed for security - token is server-side only
  
  // Use Bearer prefix in Authorization header (set to false if SnapLogic doesn't use Bearer)
  USE_BEARER_PREFIX: true,
  
  // API endpoint (determined by USE_PROXY setting)
  // This will be set automatically based on USE_PROXY flag
  API_ENDPOINT: null, // Will be set by getApiEndpoint()
  
  // Environment-specific endpoints
  ENDPOINTS: {
    // Direct SnapLogic endpoint (if no proxy)
    development: 'https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API',
    staging: 'https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API',
    production: 'https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API'
  },
  
  PROXY_ENDPOINTS: {
    development: 'http://localhost:8001/upload',
    staging: 'https://migration-accelerator-proxy.YOUR_SUBDOMAIN.workers.dev/upload',
    production: 'https://migration-accelerator-proxy.YOUR_SUBDOMAIN.workers.dev/upload'
    // Replace YOUR_SUBDOMAIN with your Cloudflare Workers subdomain
    // Example: https://migration-accelerator-proxy.your-account.workers.dev/upload
  },
  
  // File upload limits
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_TYPES: ['.zip'],
  
  // Request timeout
  TIMEOUT: 3000000, // 5 minutes
  
  // Polling interval for long-running migrations
  POLL_INTERVAL: 2000 // 2 seconds
};

// Get current environment
function getEnvironment() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  } else if (hostname.includes('staging')) {
    return 'staging';
  }
  return 'production';
}

// Get API endpoint for current environment
function getApiEndpoint() {
  if (CONFIG.USE_PROXY) {
    // Use proxy endpoint to avoid CORS issues
    const env = getEnvironment();
    return CONFIG.PROXY_ENDPOINTS[env] || CONFIG.PROXY_ENDPOINT;
  } else {
    // Use direct SnapLogic endpoint (may have CORS issues)
    const env = getEnvironment();
    return CONFIG.ENDPOINTS[env] || CONFIG.SNAPLOGIC_ENDPOINT;
  }
}
