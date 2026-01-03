# Quick Start: Deploy to Cloudflare

## 🚀 5-Minute Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Set Your API Token

```bash
npx wrangler secret put SNAPLOGIC_API_TOKEN
# Enter your SnapLogic API token when prompted
```

### 4. Deploy the Worker

```bash
npm run deploy:worker
```

**Copy the Worker URL** (e.g., `https://migration-accelerator-proxy.YOUR_SUBDOMAIN.workers.dev`)

### 5. Update Config

Edit `js/config.js` and replace `YOUR_SUBDOMAIN` with your actual subdomain:

```javascript
PROXY_ENDPOINTS: {
  development: 'http://localhost:8001/upload',
  staging: 'https://migration-accelerator-proxy.YOUR_SUBDOMAIN.workers.dev/upload',
  production: 'https://migration-accelerator-proxy.YOUR_SUBDOMAIN.workers.dev/upload'
}
```

### 6. Deploy Frontend

**Option A: Via Dashboard (Easiest)**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Workers & Pages > Create Application > Pages > Upload assets
3. Upload: `index.html`, `login.html`, `css/`, `js/`, `assets/`
4. Deploy!

**Option B: Via CLI**
```bash
npm run deploy:pages
```

### 7. Test

Visit your Pages URL and try uploading a file!

---

## 📝 What Gets Deployed?

- **Frontend** → Cloudflare Pages (HTML, CSS, JS, assets)
- **API Proxy** → Cloudflare Worker (replaces Python proxy_server.py)

## 🔧 Useful Commands

```bash
# View Worker logs
npm run tail:worker

# Update Worker
npm run deploy:worker

# Set/Update API token
npm run secret:set
```

## 🆘 Troubleshooting

**Worker 500 Error?**
- Make sure you set the API token: `npm run secret:set`

**CORS Errors?**
- Verify Worker URL in `config.js` matches your deployed Worker

**Files Not Loading?**
- Check all folders (css/, js/, assets/) are uploaded to Pages

---

For detailed instructions, see [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)
