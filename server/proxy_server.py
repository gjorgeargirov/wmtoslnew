#!/usr/bin/env python3
"""
Proxy server to forward file uploads to SnapLogic endpoint.
This bypasses CORS restrictions by making the request server-side.

Usage: python proxy_server.py
Then set USE_PROXY: true in config.js
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import os
from pathlib import Path

PORT = 8001
SNAPLOGIC_URL = 'https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API'

# SECURITY: API token is stored server-side only (NOT in frontend code)
# For production, use environment variable: os.environ.get('SNAPLOGIC_API_TOKEN')
# For local development, set this in your environment or create a .env file
API_TOKEN = os.environ.get('SNAPLOGIC_API_TOKEN', 'YOUR_API_TOKEN_HERE')

class ProxyHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '3600')
        self.end_headers()

    def do_POST(self):
        """Handle POST requests and forward to SnapLogic"""
        if self.path == '/upload' or self.path == '/api/upload':
            try:
                # Get content length
                content_length = int(self.headers.get('Content-Length', 0))
                
                # Read the request body (multipart/form-data)
                body = self.rfile.read(content_length)
                
                # Get Content-Type to preserve multipart boundary
                content_type = self.headers.get('Content-Type', '')
                
                # Debug logging
                print(f'Received request: {content_length} bytes')
                print(f'   Content-Type: {content_type[:100]}...')
                
                # Create request to SnapLogic (same as Streamlit would do)
                req = urllib.request.Request(SNAPLOGIC_URL, data=body)
                req.add_header('Content-Type', content_type)
                req.add_header('Authorization', f'Bearer {API_TOKEN}')
                req.add_header('Content-Length', str(content_length))
                
                print(f'Forwarding to SnapLogic: {SNAPLOGIC_URL}')
                
                # Forward the request
                try:
                    with urllib.request.urlopen(req, timeout=300) as response:
                        # Get response data
                        response_data = response.read()
                        status_code = response.getcode()
                        
                        # Get response headers
                        response_headers = dict(response.headers)
                        
                        # Send response back to client
                        self.send_response(status_code)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        # Always force JSON content-type (SnapLogic sometimes returns octet-stream)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(response_data)
                        
                        print(f'Successfully forwarded request - Status: {status_code}')
                        print(f'Response data: {response_data.decode()[:500]}')
                        
                except urllib.error.HTTPError as e:
                    # Handle HTTP errors
                    error_data = e.read()
                    self.send_response(e.code)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(error_data)
                    
                    print(f'SnapLogic returned error - Status: {e.code}')
                    print(f'   Response: {error_data.decode()[:200]}')
                    
            except Exception as e:
                # Handle any other errors
                error_response = {
                    'error': str(e),
                    'message': 'Proxy server error'
                }
                
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(error_response).encode())
                
                print(f'Proxy error: {e}')
        else:
            # 404 for other paths
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'Not Found')

    def log_message(self, format, *args):
        """Override to format log messages"""
        print(f"[{self.address_string()}] {format % args}")

if __name__ == "__main__":
    server = HTTPServer(("", PORT), ProxyHandler)
    print(f"Proxy server running on http://localhost:{PORT}")
    print(f"Forwarding to: {SNAPLOGIC_URL}")
    print(f"\nTo use the proxy:")
    print(f"   1. Set USE_PROXY: true in config.js")
    print(f"   2. Set PROXY_ENDPOINT: 'http://localhost:{PORT}/upload' in config.js")
    print(f"\nKeep this server running while using the application")
    print(f"   Press Ctrl+C to stop\n")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\nProxy server stopped")

