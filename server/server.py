#!/usr/bin/env python3
"""
Simple HTTP server to serve the migration UI files.
This avoids CORS issues when making API calls.

Usage: python server.py
Then open: http://localhost:8000/index.html
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()

if __name__ == "__main__":
    # Change to the parent directory (project root) to serve all files
    os.chdir(Path(__file__).parent.parent)
    
    Handler = MyHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 Server running at http://localhost:{PORT}/")
        print(f"📂 Serving files from: {os.getcwd()}")
        print(f"\n🌐 Open in browser: http://localhost:{PORT}/index.html")
        print(f"\n⚠️  Keep this window open while using the application")
        print(f"   Press Ctrl+C to stop the server\n")
        
        # Optionally open browser automatically
        try:
            webbrowser.open(f'http://localhost:{PORT}/index.html')
        except:
            pass
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped")

