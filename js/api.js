// API Service for Migration Backend

class MigrationAPI {
  constructor() {
    this.baseUrl = getApiEndpoint();
    this.token = CONFIG.API_TOKEN;
  }

  // Check if in demo mode
  isDemoMode() {
    return CONFIG.DEMO_MODE === true;
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
  }

  // Build headers
  getHeaders(includeContentType = true) {
    const headers = {
      'Authorization': `Bearer ${this.token}`
    };
    
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    return headers;
  }

  // Test API connection
  async testConnection() {
    if (this.isDemoMode()) {
      return { success: true, data: { mode: 'demo', message: 'Demo mode is active' } };
    }
    
    // Note: SnapLogic feed endpoints may not have a health check endpoint
    // This is a basic connectivity test with OPTIONS or HEAD request
    try {
      // Try a HEAD request to check if endpoint is accessible
      const response = await fetch(this.baseUrl, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      // Even if not 200, if we get a response, the endpoint is reachable
      return { 
        success: true, 
        data: { 
          endpoint: this.baseUrl,
          status: response.status,
          message: 'SnapLogic feed endpoint is accessible'
        } 
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      const errorMsg = error.message || 'Unknown error';
      
      // Provide detailed error information
      if (error.message === 'Failed to fetch') {
        return { 
          success: false, 
          error: `Cannot connect to SnapLogic feed: ${this.baseUrl}`, 
          details: [
            '1. Verify the API_ENDPOINT in config.js is correct',
            '2. Check your network connection',
            '3. Ensure CORS is enabled on SnapLogic',
            '4. Verify API_TOKEN is valid',
            '5. Check browser console (F12) for detailed network errors'
          ]
        };
      }
      
      return { success: false, error: errorMsg };
    }
  }

  // Upload and migrate file
  async uploadAndMigrate(file, options, abortSignal = null) {
    // Demo mode simulation
    if (this.isDemoMode()) {
      return this._demoUploadAndMigrate(file, options);
    }

    // Determine upload URL and request format
    const isProxy = CONFIG.USE_PROXY;
    const uploadUrl = isProxy ? this.baseUrl : this.baseUrl;

    try {
      // Always send file in FormData body
      const formData = new FormData();
      
      // Add file to FormData body - this is the main requirement
      formData.append('file', file);
      
      // Add options if they exist
      if (options && Object.keys(options).length > 0) {
        formData.append('options', JSON.stringify(options));
      }
      
      // SECURITY: When using proxy, don't send token from frontend
      // The proxy server adds the Authorization header server-side
      const headers = {};
      
      if (isProxy) {
        // Proxy mode: Token is handled server-side (secure)
      } else {
        // Direct mode: Send Authorization header (only for testing/development)
        if (this.token) {
          const bearerPrefix = CONFIG.USE_BEARER_PREFIX !== false ? 'Bearer ' : '';
          headers['Authorization'] = `${bearerPrefix}${this.token}`;
        } else {
          throw new Error('API_TOKEN is missing - required for direct mode');
        }
      }
      
      // Verify FormData has the file
      if (!file) {
        throw new Error('No file to upload');
      }
      
      // Don't set Content-Type - browser will automatically set it with boundary for FormData
      // Setting it manually would break the multipart/form-data format
      
      // Use provided abort signal or create a new controller for timeout
      const controller = abortSignal ? null : new AbortController();
      const timeoutId = controller ? setTimeout(() => controller.abort(), CONFIG.TIMEOUT) : null;

      // Check if we're in a secure context (required for some CORS policies)
      if (window.location.protocol === 'file:') {
        throw new Error('Please use a web server (run: python server.py and open http://localhost:8000/index.html)');
      }

      // Send POST request with file in body and Authorization in header
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: formData,  // File is sent in the body as FormData
        signal: abortSignal || (controller ? controller.signal : null),
        credentials: 'omit',
        mode: 'cors'  // Explicitly set CORS mode
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status} ${response.statusText}`;
        let errorDetails = null;
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorDetails = await response.json();
            errorMessage = errorDetails.message || errorDetails.error || errorMessage;
          } else {
            const errorText = await response.text();
            errorDetails = errorText;
            if (errorText) {
              errorMessage = `${errorMessage}\nResponse: ${errorText.substring(0, 500)}`;
            }
          }
        } catch (e) {
          // Error parsing error response
        }
        
        throw new Error(errorMessage);
      }

      // Handle different response types
      const contentType = response.headers.get('content-type');
      let result;
      
      // First, get the response as text to check if it's empty
      const textResult = await response.text();
      
      if (!textResult || textResult.trim() === '') {
        result = {
          success: true,
          status: response.status,
          message: 'Upload completed (empty response)',
          data: null
        };
      } else if (contentType && contentType.includes('application/json')) {
        // Try to parse as JSON
        try {
          result = JSON.parse(textResult);
        } catch (e) {
          throw new Error(`Invalid JSON response: ${e.message}. Response: ${textResult.substring(0, 100)}`);
        }
      } else {
        // Response is not JSON content-type
        // Try to parse as JSON anyway in case content-type is wrong
        try {
          result = JSON.parse(textResult);
        } catch (e) {
          // If not JSON, create a result object from the response
          result = {
            success: true,
            status: response.status,
            message: 'Upload completed',
            data: textResult
          };
        }
      }
      
      return result;

    } catch (error) {
      // Handle AbortError first (user cancellation) - don't log as error
      if (error.name === 'AbortError') {
        throw error; // Re-throw to be handled by the caller
      }
      
      if (error.message === 'Failed to fetch' || error.message.includes('Failed to fetch')) {
        // Could be CORS, network issue, or endpoint issue
        const protocol = window.location.protocol;
        let protocolWarning = '';
        
        if (protocol === 'file:') {
          protocolWarning = '\n❌ CRITICAL: You are using file:// protocol!\n   You MUST use a web server:\n   1. Run: python server.py\n   2. Open: http://localhost:8000/index.html\n';
        }
        
        const errorDetails = [
          'Cannot connect to SnapLogic endpoint.',
          protocolWarning,
          'Possible causes:',
          '• CORS policy blocking the request (most common)',
          '• Network connectivity issue',
          '• Endpoint URL is incorrect',
          '• SnapLogic server is down or unreachable',
          '',
          'Troubleshooting steps:',
          `1. Current origin: ${window.location.origin} (protocol: ${protocol})`,
          `2. Target URL: ${this.baseUrl}`,
          `3. Check browser console (F12 → Network tab) for detailed error`,
          `4. Verify API_ENDPOINT in config.js is correct`,
          `5. Verify API_TOKEN is valid`,
          '',
          '💡 IMPORTANT: Check the Network tab in browser DevTools:',
          '   - Open DevTools (F12) → Network tab',
          '   - Try uploading again',
          '   - Click on the failed request to see error details',
          '   - Look for CORS errors or HTTP status codes'
        ].join('\n');
        throw new Error(errorDetails);
      } else {
        throw error;
      }
    }
  }

  // Demo mode simulation
  _demoUploadAndMigrate(file, options) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          migrationId: 'demo_' + Math.floor(Math.random() * 90000 + 10000),
          message: 'Migration started (Demo Mode)'
        });
      }, 500);
    });
  }

  // Poll migration status
  async pollMigrationStatus(migrationId, onProgress) {
    // Demo mode simulation
    if (this.isDemoMode()) {
      return this._demoPollMigrationStatus(migrationId, onProgress);
    }

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const status = await this.getMigrationStatus(migrationId);
          
          if (onProgress) {
            onProgress(status);
          }

          if (status.status === 'completed') {
            clearInterval(interval);
            resolve(status);
          } else if (status.status === 'failed') {
            clearInterval(interval);
            reject(new Error(status.error || 'Migration failed'));
          }
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, CONFIG.POLL_INTERVAL);

      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Migration timeout'));
      }, 600000);
    });
  }

  // Demo mode status polling
  _demoPollMigrationStatus(migrationId, onProgress) {
    return new Promise((resolve) => {
      const steps = [
        { progress: 15, message: "Validating package..." },
        { progress: 35, message: "Analyzing components..." },
        { progress: 55, message: "Mapping services..." },
        { progress: 80, message: "Creating pipelines..." },
        { progress: 100, message: "Finalizing migration..." }
      ];

      let index = 0;
      const interval = setInterval(() => {
        if (index < steps.length) {
          if (onProgress) {
            onProgress(steps[index]);
          }
          index++;
        } else {
          clearInterval(interval);
          resolve({ status: 'completed' });
        }
      }, 800);
    });
  }

  // Get migration status
  async getMigrationStatus(migrationId) {
    if (this.isDemoMode()) {
      return { status: 'processing', progress: 50 };
    }

    try {
      const response = await fetch(`${this.baseUrl}/status/${migrationId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Status check error:', error);
      throw error;
    }
  }

  // Get migration results
  async getMigrationResults(migrationId) {
    // Demo mode simulation
    if (this.isDemoMode()) {
      return {
        migrationId: migrationId,
        status: 'completed',
        convertedServices: 12,
        convertedFlows: 8,
        conversionRate: 94,
        warningCount: 2,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/results/${migrationId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Results fetch error:', error);
      throw error;
    }
  }

  // Download migration report
  async downloadReport(migrationId, format = 'json') {
    // Demo mode simulation
    if (this.isDemoMode()) {
      const data = {
        migrationId: migrationId,
        convertedServices: 12,
        convertedFlows: 8,
        conversionRate: 94,
        warningCount: 2
      };

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        return blob;
      } else {
        const csv = 'metric,value\n' + Object.entries(data).map(([k, v]) => `${k},${v}`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        return blob;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/report/${migrationId}?format=${format}`, {
        method: 'GET',
        headers: this.getHeaders(false)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Report download error:', error);
      throw error;
    }
  }

  // Validate file before upload
  async validateFile(file) {
    // Demo mode - skip server validation
    if (this.isDemoMode()) {
      return { valid: true, message: 'File validated (Demo Mode)' };
    }


    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseUrl}/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Validation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Validation error:', error);
      throw error;
    }
  }
}

// Create API instance
const migrationAPI = new MigrationAPI();

// Connection test disabled - not needed for file uploads
// The connection will be tested when user actually uploads a file
