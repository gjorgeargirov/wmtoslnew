#!/bin/bash
# Script to create D1 database and update wrangler.toml

echo "Creating D1 database..."
npx wrangler d1 create wmtoslnew-db

echo ""
echo "After the database is created, copy the database_id from the output above"
echo "and update wrangler.toml with it."
echo ""
echo "Then run: npx wrangler d1 execute wmtoslnew-db --file=./schema.sql"
