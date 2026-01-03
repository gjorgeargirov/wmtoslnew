# Troubleshooting: App Using Browser Cache Instead of Database

## Quick Diagnosis

After deploying, open your browser's Developer Console (F12) and check:

1. **Look for these console messages:**
   - ✅ `API client loaded - will use database API` - Good!
   - ✅ `Production mode: API is required, localStorage fallback disabled` - Good!
   - ❌ `API client not available in production!` - Problem: API client not loading
   - ❌ `API login failed:` - Problem: API endpoints not working

2. **Test the API directly:**
   - Open Console and run: `await testAPI()`
   - This will show if the API endpoints are accessible

## Common Issues and Fixes

### Issue 1: Pages Functions Not Deployed

**Symptoms:**
- Console shows: `API test failed: Failed to fetch`
- Network tab shows 404 for `/api/users` endpoints

**Fix:**
1. Make sure you've pushed the `functions/` folder to your Git repository
2. In Cloudflare Dashboard → Pages → Your Project → Deployments
3. Check that the latest deployment includes the `functions/` folder
4. If not, push your changes again or manually upload the `functions/` folder

### Issue 2: D1 Binding Not Configured in Pages

**Symptoms:**
- Console shows: `API test failed: 500 Internal Server Error`
- API endpoints return errors

**Fix:**
1. Go to Cloudflare Dashboard → Pages → Your Project → Settings → Functions
2. Under "D1 Database bindings", add:
   - **Variable name:** `DB`
   - **D1 Database:** `wmtoslnew-db`
3. Save and redeploy

### Issue 3: Database Not Migrated

**Symptoms:**
- API works but returns empty results
- Users table is empty

**Fix:**
Run the migration on the remote database:
```bash
npx wrangler d1 execute wmtoslnew-db --remote --file=./schema.sql
```

### Issue 4: Browser Cache Still Active

**Symptoms:**
- Old users still showing
- Changes not persisting

**Fix:**
1. The code now automatically clears localStorage in production
2. If still seeing old data:
   - Open Console
   - Run: `localStorage.clear()`
   - Refresh the page

### Issue 5: CORS Errors

**Symptoms:**
- Console shows: `CORS policy` errors
- Network tab shows CORS errors

**Fix:**
- This shouldn't happen with Pages Functions (same origin)
- If it does, check that you're accessing the Pages URL, not the Worker URL

## Verification Steps

1. **Check API is accessible:**
   ```javascript
   // In browser console
   await testAPI()
   ```

2. **Check users are loading from database:**
   ```javascript
   // In browser console
   const users = await window.userAPI.getUsers();
   console.log('Users from database:', users);
   ```

3. **Check localStorage is cleared:**
   ```javascript
   // In browser console
   console.log('localStorage users:', localStorage.getItem('users'));
   // Should be null in production
   ```

4. **Check production mode:**
   ```javascript
   // In browser console
   console.log('Is production:', window.location.hostname !== 'localhost');
   console.log('API Base URL:', window.API_BASE_URL);
   ```

## What Changed

The app now:
- ✅ Detects production vs development automatically
- ✅ Disables localStorage fallback in production
- ✅ Clears localStorage on page load in production
- ✅ Shows clear error messages if API fails
- ✅ Includes diagnostic function `testAPI()` for troubleshooting

## Still Having Issues?

1. Check the browser console for error messages
2. Check the Network tab to see what API calls are being made
3. Verify Pages Functions are deployed (check Cloudflare Dashboard)
4. Verify D1 binding is configured (check Pages Settings)
5. Run `testAPI()` in console to get detailed diagnostics
