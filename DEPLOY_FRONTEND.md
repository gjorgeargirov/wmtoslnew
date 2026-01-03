# Deploy Frontend to Cloudflare Pages

Your Worker is deployed, but you need to deploy the **frontend** separately to Cloudflare Pages.

## Quick Steps

### Step 1: Find Your Worker URL

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Click on your worker: **wmtoslnew**
4. Copy the URL (it will look like: `https://wmtoslnew.YOUR_SUBDOMAIN.workers.dev`)

### Step 2: Update Config.js

1. Open `js/config.js` in your project
2. Find the `PROXY_ENDPOINTS` section
3. Replace `YOUR_SUBDOMAIN` with your actual subdomain from Step 1
4. Save the file

Example:
```javascript
PROXY_ENDPOINTS: {
  development: 'http://localhost:8001/upload',
  staging: 'https://wmtoslnew.abc123def.workers.dev/upload',
  production: 'https://wmtoslnew.abc123def.workers.dev/upload'
}
```

### Step 3: Deploy Frontend to Cloudflare Pages

**Option A: Via Cloudflare Dashboard (Easiest)**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Click **Create Application** > **Pages** > **Upload assets**
4. Project name: `wmtoslnew` (or your preferred name)
5. **Upload these files/folders:**
   - `index.html`
   - `login.html`
   - `css/` folder (all CSS files)
   - `js/` folder (all JS files)
   - `assets/` folder (logo.png, icon.webp)
6. **Do NOT upload:**
   - `server/` folder
   - `worker.js`
   - `wrangler.toml`
   - `package.json`
   - Any `.md` files
7. Click **Deploy site**
8. Your site will be available at: `https://wmtoslnew.pages.dev`

**Option B: Via Git (If you have a repository)**

1. Go to Cloudflare Dashboard > Workers & Pages
2. Click **Create Application** > **Pages** > **Connect to Git**
3. Connect your GitHub/GitLab repository
4. **Build Settings:**
   - Build command: (leave empty)
   - Build output directory: `/`
   - Root directory: `/`
5. Click **Save and Deploy**

### Step 4: Test Your Deployment

1. Visit your Pages URL (e.g., `https://wmtoslnew.pages.dev`)
2. You should see your application (not the git repository)
3. Try uploading a file to test the Worker connection

## Troubleshooting

**Still seeing Git repository?**
- Make sure you uploaded the actual files (HTML, CSS, JS), not just connected the repo
- If using Git, check that build settings are correct (no build command needed)

**CORS Errors?**
- Verify your Worker URL in `config.js` matches your deployed Worker
- Check that the Worker is deployed and accessible

**Files not loading?**
- Make sure all folders (css/, js/, assets/) are uploaded
- Check browser console (F12) for 404 errors

## Next Steps

After deploying:
1. Visit your Pages URL
2. The app should load correctly
3. File uploads will go through your Worker to SnapLogic
