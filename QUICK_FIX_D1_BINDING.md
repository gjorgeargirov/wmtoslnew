# Quick Fix: Configure D1 Database Binding in Pages

## The Problem
You're seeing: **"Database not configured"** error

This means the D1 database binding is not set up in your Cloudflare Pages project.

## Solution: Add D1 Binding in Cloudflare Dashboard

### Step 1: Go to Pages Settings
1. Open [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **Pages**
3. Click on your project: **wmtoslnew**

### Step 2: Configure D1 Binding
1. Click **Settings** tab (left sidebar)
2. Scroll down to **Functions** section
3. Find **D1 Database bindings**
4. Click **Add binding** or **Edit bindings**

### Step 3: Add the Binding
Configure it exactly like this:

- **Variable name:** `DB` (must be exactly `DB` - case sensitive!)
- **D1 Database:** Select `wmtoslnew-db` from the dropdown

**Important:** The variable name MUST be `DB` (not `db`, not `DATABASE`, not `wmtoslnew-db`)

### Step 4: Save and Redeploy
1. Click **Save** or **Save and Deploy**
2. Wait for the deployment to complete (usually 1-2 minutes)
3. Refresh your app

## Verification

After configuring, test in browser console:

```javascript
await testAPI()
```

You should see:
- ✅ `API is working correctly`
- ✅ Users count: 4

## Alternative: Using Wrangler CLI

If you prefer command line, you can also configure it via `wrangler.toml` for Pages, but the Dashboard method above is easier.

## Still Not Working?

1. **Check binding name:** Must be exactly `DB` (case-sensitive)
2. **Check database name:** Must match `wmtoslnew-db`
3. **Redeploy:** After adding binding, you may need to trigger a new deployment
4. **Check Functions are deployed:** Make sure `functions/` folder is in your repository

## Screenshot Guide

The binding should look like this in the Dashboard:

```
D1 Database bindings
┌─────────────────────────────────────┐
│ Variable name: DB                   │
│ D1 Database: wmtoslnew-db           │
│ [Remove]                            │
└─────────────────────────────────────┘
[Add binding]
```
