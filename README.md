# WebMethods to SnapLogic Migration Tool

A modern web application for migrating WebMethods packages to SnapLogic pipelines.

## 📁 Project Structure

```
newUI/
├── assets/              # Static assets (images, logos)
│   └── logo.png
├── css/                 # Stylesheets
│   ├── styles.css                 # Main application styles
│   ├── dashboard-styles.css       # Dashboard-specific styles
│   ├── profile-styles.css         # Profile page styles
│   ├── login.css                  # Login page styles
│   ├── admin-styles.css           # Admin panel styles
│   └── cancel-migration-addon.css # Cancel button styles
├── js/                  # JavaScript files
│   ├── config.js              # Configuration settings
│   ├── api.js                 # API integration logic
│   ├── script.js              # Main application logic
│   ├── auth.js                # Authentication logic
│   ├── login.js               # Login page logic
│   ├── users.js               # User management
│   ├── admin.js               # Admin panel logic
│   └── cancel-migration.js    # Cancel migration functionality
├── server/              # Local server scripts
│   ├── server.py          # Local HTTP server (port 8000)
│   ├── proxy_server.py    # CORS proxy server (port 8001)
│   └── start_all.bat      # Start both servers (Windows)
├── worker.js            # Cloudflare Worker (replaces proxy_server.py)
├── wrangler.toml        # Cloudflare Worker configuration
├── package.json         # Node.js dependencies for Cloudflare deployment
├── index.html           # Main application page
├── login.html           # Login page
├── START_SERVERS.bat    # Quick start script (run from root)
├── CLOUDFLARE_DEPLOYMENT.md  # Detailed Cloudflare deployment guide
├── QUICK_START_CLOUDFLARE.md # Quick Cloudflare deployment guide
└── README.md            # This file
```

## 🚀 Quick Start

### Deploy to Cloudflare (Recommended for Production)

For production deployment, see the [Cloudflare Deployment Guide](./CLOUDFLARE_DEPLOYMENT.md) or [Quick Start Guide](./QUICK_START_CLOUDFLARE.md).

**Quick Deploy:**
```bash
npm install
npx wrangler login
npx wrangler secret put SNAPLOGIC_API_TOKEN
npm run deploy:worker
# Then deploy frontend via Cloudflare Dashboard or CLI
```

### Running the Application Locally

1. **Set environment variable (required):**
   ```bash
   # Windows PowerShell
   $env:SNAPLOGIC_API_TOKEN="your_token_here"
   
   # Or create a .env file (not tracked in git)
   ```

2. **Start the servers:**
   ```bash
   # Easy way (Windows)
   START_SERVERS.bat
   
   # Or manually start both servers:
   cd server
   python server.py        # Terminal 1 - Web server (port 8000)
   python proxy_server.py  # Terminal 2 - Proxy server (port 8001)
   ```

3. **Open the application:**
   - Navigate to: `http://localhost:8000/`
   - Or: `http://localhost:8000/login.html`

4. **Login credentials (demo):**
   - Email: `demo@iwconnect.com`
   - Password: `demo123`

### Requirements

- **Python 3.x** (for local servers)
- Web browser (Chrome, Firefox, Edge, Safari)

## ⚙️ Configuration

### SnapLogic API Settings

Edit `server/proxy_server.py` to configure:
- `SNAPLOGIC_URL` - Your SnapLogic endpoint
- `API_TOKEN` - Set via environment variable `SNAPLOGIC_API_TOKEN`

### Application Settings

Edit `js/config.js` to configure:
- `USE_PROXY: true` - Must be true for CORS bypass
- `PROXY_ENDPOINT` - Local proxy (default: `http://localhost:8001/upload`)

## 🔧 Features

- ✅ File upload (WebMethods .zip packages)
- ✅ Real-time migration progress tracking with live duration updates
- ✅ Cancel migration functionality
- ✅ Dashboard with migration history and pagination
- ✅ Color-coded migration status (success/failed/in-progress/cancelled)
- ✅ User management with roles and permissions
- ✅ Admin panel for user and project management
- ✅ User profile management
- ✅ Toast notifications (replaces browser alerts)
- ✅ Custom confirmation modals
- ✅ Responsive design with mobile menu
- ✅ Security: XSS protection, input sanitization
- ✅ Client-side caching with localStorage

## 🛡️ Security

- ✅ XSS protection (HTML and filename sanitization)
- ✅ API tokens stored server-side only (never in frontend)
- ✅ CORS handled by proxy server
- ✅ Secure authentication flow
- ✅ Input validation on file uploads
- ✅ Role-based access control

## 📦 Technologies

### Frontend
- Vanilla JavaScript (ES6+)
- CSS3 with Grid/Flexbox
- HTML5

### Backend (Local)
- Python 3.x HTTP server
- Python proxy server for CORS bypass
- SnapLogic API integration

## 🐛 Troubleshooting

### Servers Won't Start
- Check if ports 8000 and 8001 are already in use
- Make sure Python 3.x is installed
- Run `python --version` to verify

### CORS Errors
- Make sure both servers are running (web + proxy)
- Check that `USE_PROXY: true` in `js/config.js`
- Verify proxy server is running on port 8001

### Files Not Loading
- Clear browser cache (Ctrl+Shift+R or Ctrl+F5)
- Check browser console (F12) for 404 errors
- Verify file paths in HTML

### Migration Fails
- Check SnapLogic endpoint is correct in `server/proxy_server.py`
- Verify API token is set via environment variable
- Check browser Network tab (F12) for error details
- Review proxy server terminal for error messages

## 📝 Development Notes

### Adding New Features
1. JavaScript logic → `js/` folder
2. Styles → `css/` folder  
3. Assets → `assets/` folder
4. Update paths in HTML files if needed

### File Organization
- Keep HTML files in root for easy access
- Group related files in appropriate folders
- Use cache-busting query params (`?v=X`) for CSS/JS updates

### Local Storage
- `migrationHistory` - Recent migration records
- `currentMigration` - Active migration state
- `userPreferences` - User settings
- `migrationAppUsers` - User accounts
- `migrationAppProjects` - Project definitions

### Session Storage
- `authToken` - Authentication token
- `user` - Current user data

## 🎯 Migration Workflow

1. **Upload** - Select and upload WebMethods .zip package
2. **Configure** - Set migration options and select project
3. **Review & Migrate** - Confirm settings and start migration
4. **Monitor** - Watch real-time progress with live duration
5. **Results** - View migration results or errors
6. **Dashboard** - Check migration history and status

## 👥 User Management

The application supports multiple user roles:
- **Admin**: Full access to all features including user management
- **User**: Can upload, migrate, and view history
- **Viewer**: Read-only access to migration history

User management is available through the Admin Panel (accessible to Admin users only).

## 📞 Support

For issues or questions, use the "Contact Us" button in the application.

---

**Version:** 1.0.0  
**Last Updated:** December 2024  
**License:** Proprietary
