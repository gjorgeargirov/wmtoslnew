# Complete Deployment Guide - Pages with D1 Database

## Step-by-Step: Deploy Everything from Scratch

### Step 1: Verify D1 Database Binding in Pages

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **wmtoslnew** (your Pages project)
2. Click **Settings** tab
3. Scroll to **Bindings** section
4. **IMPORTANT:** The binding name must be `DB` (exactly)
   - If it shows `wmtoslnew-db`, click edit and change it to `DB`
   - Or if it's missing, click **+ Add** → **D1 database** → Name: `DB` → Database: `wmtoslnew-db`

### Step 2: Set Environment Variables/Secrets

In Pages Settings → **Variables and Secrets**:

1. **Add Secret:**
   - Click **+ Add** → **Secret**
   - Name: `SNAPLOGIC_API_TOKEN`
   - Value: Your SnapLogic API token
   - Click **Save**

2. **Add Variable (optional):**
   - Click **+ Add** → **Variable**
   - Name: `SNAPLOGIC_URL`
   - Value: `https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API`
   - Click **Save**

### Step 3: Deploy Pages with Functions

**Option A: Via Git (if connected)**
1. Make sure `functions/` folder is committed
2. Push to your repository
3. Pages will auto-deploy

**Option B: Via Dashboard (Manual Upload)**
1. Go to Pages → **wmtoslnew** → **Deployments**
2. Click **Create deployment**
3. **IMPORTANT:** Make sure to include:
   - `functions/` folder (with all subfolders)
   - `index.html`
   - `login.html`
   - `css/` folder
   - `js/` folder
   - `assets/` folder
4. Click **Deploy**

**Option C: Via CLI**
```bash
npx wrangler pages deploy . --project-name=wmtoslnew
```

### Step 4: Verify Database Has Data

The database migration should already be done, but verify:

```bash
npx wrangler d1 execute wmtoslnew-db --remote --command="SELECT email, name, role FROM users"
```

You should see 4 users.

### Step 5: Test the Deployment

1. Visit your Pages URL: `https://wmtoslnew.pages.dev`
2. Open browser console (F12)
3. Run this test:

```javascript
// Test API
fetch('/api/users')
  .then(r => r.json())
  .then(data => {
    console.log('✅ API Working!', data);
    console.log('Users from database:', data.users?.length || 0);
  })
  .catch(error => {
    console.error('❌ API Error:', error);
  });
```

**Expected result:**
- Should see 4 users from the database
- Not just the user you created in localStorage

### Step 6: Clear Browser localStorage (Important!)

Since the app was using localStorage before, you need to clear it:

1. Open browser console (F12)
2. Run:
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

Or manually:
- Open DevTools → Application tab → Storage
- Clear Local Storage and Session Storage
- Refresh the page

## Troubleshooting

### Still seeing only 1 user?

1. **Check browser console** for errors
2. **Verify functions are deployed:**
   - Visit: `https://wmtoslnew.pages.dev/api/users`
   - Should return JSON with users, not 404

3. **Check D1 binding:**
   - Pages Settings → Bindings → Must be named `DB`

4. **Check deployment logs:**
   - Pages → Deployments → Click latest deployment
   - Look for errors

### API returns 404?

- Functions folder not deployed
- Check that `functions/` folder is in your deployment
- Verify file structure matches routes

### API returns 500?

- Check D1 binding name is `DB` in Pages settings
- Verify database migration ran: `npx wrangler d1 execute wmtoslnew-db --remote --command="SELECT * FROM users"`

### Still using localStorage?

- Clear browser storage (Step 6 above)
- Check console for "API client loaded" message
- Verify API is accessible: `fetch('/api/users')`

## Quick Checklist

- [ ] D1 binding named `DB` in Pages settings
- [ ] `SNAPLOGIC_API_TOKEN` secret set in Pages
- [ ] `functions/` folder deployed
- [ ] Database has 4 users (verified with SQL query)
- [ ] Browser localStorage cleared
- [ ] Test API: `fetch('/api/users')` returns users

---

After completing these steps, all browsers should see the same users from the database!
