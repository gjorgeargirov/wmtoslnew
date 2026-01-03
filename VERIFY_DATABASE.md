# Verify D1 Database Setup

## Step 1: Run Database Migration in Production

The database tables need to be created in production. Run:

```bash
npx wrangler d1 execute wmtoslnew-db --file=./schema.sql
```

This will:
- Create all tables (users, projects, user_projects, migrations)
- Insert default users and projects
- Set up relationships

**Note:** This runs against the **production** database (not local).

## Step 2: Verify Database Tables

Check that tables were created:

```bash
# List all tables
npx wrangler d1 execute wmtoslnew-db --command="SELECT name FROM sqlite_master WHERE type='table'"

# Check users
npx wrangler d1 execute wmtoslnew-db --command="SELECT * FROM users"

# Check projects
npx wrangler d1 execute wmtoslnew-db --command="SELECT * FROM projects"
```

## Step 3: Verify Worker Deployment

Make sure the Worker is deployed with the database binding:

```bash
npx wrangler deploy
```

Check the output - it should show:
```
Your worker has access to the following bindings:
- D1 Databases:
  - DB
```

## Step 4: Test API Endpoints

Test the API endpoints directly:

```bash
# Test login endpoint
curl -X POST https://wmtoslnew.argirov-gjorge.workers.dev/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@iwconnect.com","password":"admin123"}'

# Test get users endpoint
curl https://wmtoslnew.argirov-gjorge.workers.dev/api/users
```

## Step 5: Check Browser Console

1. Open your deployed app
2. Open browser console (F12)
3. Check for any API errors
4. Look for messages like "API client loaded" or "API server not available"

## Troubleshooting

### Database shows "0 tables"
- Run the migration: `npx wrangler d1 execute wmtoslnew-db --file=./schema.sql`

### API returns 500 errors
- Check Worker logs: `npx wrangler tail`
- Verify database_id in wrangler.toml matches your database

### Users still using localStorage
- Check browser console for API errors
- Verify Worker URL in api-client.js matches your deployed Worker
- Make sure Worker is deployed: `npx wrangler deploy`

### CORS errors
- The Worker already handles CORS, but verify the frontend URL is allowed

## Quick Test

After running the migration, test in browser console:

```javascript
// Test API connection
fetch('https://wmtoslnew.argirov-gjorge.workers.dev/api/users')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

This should return a JSON object with a `users` array containing 4 default users.
