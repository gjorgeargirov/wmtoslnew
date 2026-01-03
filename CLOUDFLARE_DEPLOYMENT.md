# Cloudflare Deployment Guide

This guide will help you deploy the Migration Accelerator app to Cloudflare using:
- **Cloudflare Pages** for the frontend (static files)
- **Cloudflare Workers** for the API proxy (replaces Python proxy server)

## Prerequisites

1. **Cloudflare Account** - Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI** - Cloudflare's command-line tool
3. **Node.js** (v18 or later) - Required for Wrangler

## Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

Or using npm:
```bash
npm install wrangler --save-dev
```

## Step 2: Authenticate with Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

## Step 3: Deploy the Worker (API Proxy)

The Worker replaces the Python `proxy_server.py` and handles file uploads to SnapLogic.

### 3.1. Set Environment Variables

Set your SnapLogic API token as a secret in Cloudflare:

```bash
wrangler secret put SNAPLOGIC_API_TOKEN
```

When prompted, enter your SnapLogic API token.

**Alternative:** You can also set secrets via the Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select your worker
3. Settings > Variables and Secrets
4. Add secret: `SNAPLOGIC_API_TOKEN`

### 3.2. Deploy the Worker

```bash
wrangler deploy
```

This will:
- Deploy the worker to Cloudflare
- Give you a URL like: `https://migration-accelerator-proxy.YOUR_SUBDOMAIN.workers.dev`

**Note the Worker URL** - you'll need it in the next step.

### 3.3. Update Config.js

Edit `js/config.js` and update the `PROXY_ENDPOINTS`:

```javascript
PROXY_ENDPOINTS: {
  development: 'http://localhost:8001/upload',
  staging: 'https://migration-accelerator-proxy.YOUR_SUBDOMAIN.workers.dev/upload',
  production: 'https://migration-accelerator-proxy.YOUR_SUBDOMAIN.workers.dev/upload'
}
```

Replace `YOUR_SUBDOMAIN` with your actual Cloudflare Workers subdomain.

## Step 4: Deploy Frontend to Cloudflare Pages

### Option A: Deploy via Cloudflare Dashboard (Recommended)

1. **Go to Cloudflare Dashboard**
   - Navigate to **Workers & Pages**
   - Click **Create Application** > **Pages** > **Upload assets**

2. **Upload Your Files**
   - Project name: `migration-accelerator` (or your preferred name)
   - Upload the following files/folders:
     - `index.html`
     - `login.html`
     - `css/` folder
     - `js/` folder
     - `assets/` folder
   - **Do NOT upload:**
     - `server/` folder (not needed for Cloudflare)
     - `worker.js` (deployed separately)
     - `wrangler.toml` (deployed separately)

3. **Deploy**
   - Click **Deploy site**
   - Your site will be available at: `https://migration-accelerator.pages.dev`

### Option B: Deploy via Git (Continuous Deployment)

1. **Connect Repository**
   - In Cloudflare Pages, click **Create Application** > **Pages** > **Connect to Git**
   - Connect your GitHub/GitLab repository

2. **Configure Build Settings**
   - Build command: (leave empty - no build needed)
   - Build output directory: `/` (root)
   - Root directory: `/` (or the folder containing your files)

3. **Deploy**
   - Cloudflare will automatically deploy on every push to your main branch

### Option C: Deploy via Wrangler CLI

```bash
# Install pages CLI plugin
npm install -g wrangler

# Deploy to Pages
wrangler pages deploy . --project-name=migration-accelerator
```

**Note:** You may need to exclude certain files. Create a `.cfignore` file:

```
.cfignore
server/
*.bat
*.py
wrangler.toml
worker.js
README.md
CLOUDFLARE_DEPLOYMENT.md
```

## Step 5: Configure Custom Domain (Optional)

1. In Cloudflare Pages dashboard, go to your project
2. Click **Custom domains**
3. Add your domain (e.g., `migration.yourdomain.com`)
4. Follow DNS setup instructions

## Step 6: Update CORS Settings (if needed)

The Worker already handles CORS, but if you encounter issues:

1. Go to your Worker in Cloudflare Dashboard
2. Settings > Variables and Secrets
3. Ensure CORS headers are set correctly (already configured in `worker.js`)

## Step 7: Test the Deployment

1. **Test Frontend:**
   - Visit your Cloudflare Pages URL
   - Verify the app loads correctly

2. **Test Worker:**
   - Try uploading a file through the app
   - Check browser console (F12) for errors
   - Check Cloudflare Worker logs in the dashboard

## Troubleshooting

### Worker Returns 500 Error

**Problem:** API token not configured

**Solution:**
```bash
wrangler secret put SNAPLOGIC_API_TOKEN
```

Or set it in Cloudflare Dashboard > Workers & Pages > Your Worker > Settings > Variables and Secrets

### CORS Errors

**Problem:** Browser shows CORS errors

**Solution:**
- Verify Worker URL is correct in `config.js`
- Check Worker logs in Cloudflare Dashboard
- Ensure Worker is deployed and accessible

### File Upload Fails

**Problem:** Upload times out or fails

**Solution:**
- Check Worker timeout settings (currently 5 minutes)
- Verify SnapLogic endpoint URL is correct in `wrangler.toml`
- Check Worker logs for detailed error messages

### Frontend Not Loading

**Problem:** 404 errors for CSS/JS files

**Solution:**
- Verify all files are uploaded to Pages
- Check file paths in HTML (should be relative)
- Clear browser cache

## Environment-Specific Deployments

### Staging Environment

1. Deploy Worker to staging:
   ```bash
   wrangler deploy --env staging
   ```

2. Create a separate Pages project for staging:
   - Name: `migration-accelerator-staging`
   - Use same files but with staging config

### Production Environment

1. Deploy Worker to production:
   ```bash
   wrangler deploy --env production
   ```

2. Use your main Pages project for production

## Monitoring and Logs

### View Worker Logs

```bash
wrangler tail
```

Or in Cloudflare Dashboard:
- Workers & Pages > Your Worker > Logs

### View Pages Analytics

- Cloudflare Dashboard > Pages > Your Project > Analytics

## Cost Considerations

### Free Tier Limits

- **Workers:** 100,000 requests/day (free)
- **Pages:** Unlimited requests (free)
- **Bandwidth:** 500 requests/minute per Worker (free)

### Paid Plans

If you exceed free limits, consider:
- **Workers Paid:** $5/month for 10M requests
- **Pages Pro:** $20/month for advanced features

## Security Best Practices

1. ✅ **API Token:** Stored as secret in Cloudflare (never in code)
2. ✅ **CORS:** Configured in Worker (only allows necessary origins)
3. ✅ **HTTPS:** Automatic with Cloudflare (free SSL)
4. ✅ **Environment Variables:** Use secrets for sensitive data

## Updating the Deployment

### Update Worker

```bash
# Edit worker.js
# Then deploy:
wrangler deploy
```

### Update Frontend

**If using Git:**
- Push changes to your repository
- Cloudflare Pages will auto-deploy

**If using manual upload:**
- Re-upload files via Cloudflare Dashboard

## Rollback

### Rollback Worker

```bash
wrangler rollback
```

### Rollback Pages

- Cloudflare Dashboard > Pages > Your Project > Deployments
- Click on previous deployment > Retry deployment

## Support

- **Cloudflare Docs:** [developers.cloudflare.com](https://developers.cloudflare.com)
- **Workers Docs:** [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers)
- **Pages Docs:** [developers.cloudflare.com/pages](https://developers.cloudflare.com/pages)

## Quick Reference

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Set API token
wrangler secret put SNAPLOGIC_API_TOKEN

# Deploy Worker
wrangler deploy

# View Worker logs
wrangler tail

# Deploy Pages (via CLI)
wrangler pages deploy . --project-name=migration-accelerator
```

---

**Deployment Checklist:**

- [ ] Wrangler CLI installed
- [ ] Authenticated with Cloudflare
- [ ] Worker deployed with API token secret
- [ ] Config.js updated with Worker URL
- [ ] Frontend deployed to Cloudflare Pages
- [ ] Custom domain configured (optional)
- [ ] Tested file upload
- [ ] Verified Worker logs

---

**Version:** 1.0.0  
**Last Updated:** December 2024
