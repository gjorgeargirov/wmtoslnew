# Database Setup Guide

This guide will help you set up Cloudflare D1 database to store users and projects, so they're shared across all browsers and devices.

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler` or `npm install wrangler --save-dev`)
- Your Worker already deployed

## Step 1: Create D1 Database

Run this command in your project directory:

```bash
npx wrangler d1 create wmtoslnew-db
```

This will output something like:
```
✅ Successfully created DB 'wmtoslnew-db'!

[[d1_databases]]
binding = "DB"
database_name = "wmtoslnew-db"
database_id = "abc123def456..."  # Copy this ID
```

## Step 2: Update wrangler.toml

Copy the `database_id` from Step 1 and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "wmtoslnew-db"
database_id = "your-database-id-here"  # Paste the ID from Step 1
```

## Step 3: Run Database Migration

Execute the SQL schema to create tables and insert default data:

```bash
npx wrangler d1 execute wmtoslnew-db --file=./schema.sql
```

This will:
- Create `users` table
- Create `projects` table
- Create `user_projects` relationship table
- Create `migrations` table (for future use)
- Insert default users and projects

## Step 4: Deploy Updated Worker

Deploy the updated Worker with database support:

```bash
npx wrangler deploy
```

## Step 5: Verify Database

You can verify the database was created correctly:

```bash
# List all users
npx wrangler d1 execute wmtoslnew-db --command="SELECT * FROM users"

# List all projects
npx wrangler d1 execute wmtoslnew-db --command="SELECT * FROM projects"
```

## Step 6: Update Frontend

The frontend code has already been updated to use the API. Just make sure:

1. `api-client.js` is included in your HTML files (already done)
2. Deploy the updated frontend to Cloudflare Pages

## Default Users

After migration, these users will be available:

- **Admin**: `admin@iwconnect.com` / `admin123`
- **Demo**: `demo@iwconnect.com` / `demo123`
- **User**: `user@iwconnect.com` / `user123`
- **Viewer**: `viewer@iwconnect.com` / `viewer123`

## Troubleshooting

### Database not found error

If you get "Database not configured" errors:
1. Make sure `database_id` is set in `wrangler.toml`
2. Redeploy the Worker: `npx wrangler deploy`
3. Check the database exists: `npx wrangler d1 list`

### API errors

If API calls fail:
1. Check Worker logs: `npx wrangler tail`
2. Verify CORS headers are set correctly
3. Check browser console for errors

### Users not syncing

If users still appear browser-specific:
1. Clear browser localStorage: `localStorage.clear()`
2. Refresh the page
3. Check that API client is loaded (check browser console)
4. Verify Worker URL in `api-client.js` matches your deployed Worker

## Local Development

For local development with D1:

```bash
# Start local D1 database
npx wrangler d1 execute wmtoslnew-db --local --file=./schema.sql

# Run Worker locally
npx wrangler dev
```

Update `api-client.js` to use `http://localhost:8787` for local development.

## Production Database

The database is automatically available in production once you:
1. Create the database (Step 1)
2. Run migrations (Step 3)
3. Deploy the Worker (Step 4)

No additional configuration needed - Cloudflare handles it automatically!

## Next Steps

- Users and projects are now stored in the database
- All browsers will see the same users
- Changes made in one browser will be visible in all browsers
- You can manage users through the Admin panel in the app

---

**Note**: The database is free on Cloudflare's free tier with generous limits. For production use, consider upgrading if needed.
