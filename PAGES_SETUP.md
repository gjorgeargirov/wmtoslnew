# Pages Functions Setup Guide

Your app now uses **Cloudflare Pages Functions** instead of a separate Worker. This means everything runs on Pages with D1 database access.

## What Changed

1. ✅ Created `functions/` folder with API endpoints
2. ✅ Updated `api-client.js` to use same-origin (Pages Functions)
3. ✅ Updated `config.js` to use Pages Functions for uploads

## Setup Steps

### 1. Configure D1 Binding in Pages

The D1 binding should already be configured (you showed it in the dashboard). Verify:

1. Go to Cloudflare Dashboard → Workers & Pages → **wmtoslnew** (Pages project)
2. Go to **Settings** tab
3. Under **Bindings**, you should see:
   - Type: D1 database
   - Name: `wmtoslnew-db` (or `DB`)
   - Value: `wmtoslnew-db`

If it's not there:
- Click **+ Add** under Bindings
- Select **D1 database**
- Name: `DB` (must match the binding name in functions)
- Database: `wmtoslnew-db`

### 2. Set Environment Variables

In Pages Settings → Variables and Secrets:

1. Add variable: `SNAPLOGIC_URL`
   - Value: `https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API`

2. Add secret: `SNAPLOGIC_API_TOKEN`
   - Click **+ Add** → **Secret**
   - Name: `SNAPLOGIC_API_TOKEN`
   - Enter your SnapLogic API token

### 3. Deploy to Pages

**Option A: Via Git (if connected)**
- Just push your changes - Pages will auto-deploy

**Option B: Via Dashboard**
- Go to Pages → wmtoslnew → Deployments
- Click **Create deployment**
- Upload your files (including the new `functions/` folder)

**Option C: Via CLI**
```bash
npx wrangler pages deploy . --project-name=wmtoslnew
```

### 4. Verify Database Migration

Make sure the database has tables (you already did this):
```bash
npx wrangler d1 execute wmtoslnew-db --remote --command="SELECT * FROM users"
```

## How It Works

- **Pages Functions** automatically handle routes in the `functions/` folder
- `/api/users` → `functions/api/users/index.js`
- `/api/users/login` → `functions/api/users/login.js`
- `/api/users/123` → `functions/api/users/[id].js`
- `/upload` → `functions/upload.js`

- **D1 Database** is accessed via `env.DB` in all functions
- **Same origin** - no CORS issues since everything is on Pages

## Testing

After deployment, test in browser console:

```javascript
// Test users API
fetch('/api/users')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Test login
fetch('/api/users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@iwconnect.com', password: 'admin123' })
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## Troubleshooting

### Functions not working
- Check that `functions/` folder is deployed
- Verify D1 binding name is `DB` in Pages settings
- Check Pages deployment logs

### Database errors
- Verify migration ran: `npx wrangler d1 execute wmtoslnew-db --remote --command="SELECT * FROM users"`
- Check binding name matches in Pages settings

### API returns 404
- Make sure `functions/` folder structure is correct
- Check file names match routes (e.g., `[id].js` for dynamic routes)

---

**Note:** You can now remove the Worker if you want - everything runs on Pages!
