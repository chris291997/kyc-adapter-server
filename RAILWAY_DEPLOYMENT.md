# Railway Deployment Guide

This guide will help you deploy your KYC Adapter application to Railway.

## Prerequisites

1. A Railway account (sign up at [railway.app](https://railway.app))
2. Git repository connected to Railway

## Setup Steps

### 1. Create a New Project on Railway

1. Log in to Railway and create a new project
2. Connect your GitHub repository or deploy from a private Git URL

### 2. Add Required Services

You'll need to add two services in Railway:

#### PostgreSQL Database
1. Click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically provide connection details via environment variables

#### Redis (Optional but Recommended)
1. Click "New" → "Database" → "Add Redis"
2. Railway will automatically provide connection details via environment variables

### 3. Add Your Application Service

1. Click "New" → "GitHub Repo" (or "Deploy from GitHub repo")
2. Select your repository
3. Railway will auto-detect the Dockerfile

### 4. Configure Environment Variables

In your Railway application service, add the following environment variables:

#### Required Variables
```
NODE_ENV=production
PORT=3000
APP_URL=https://your-app-name.up.railway.app
```

#### Database Variables
Railway automatically provides these for PostgreSQL service:
- `PGHOST` (use as `DB_HOST`)
- `PGPORT` (use as `DB_PORT`)
- `PGUSER` (use as `DB_USERNAME`)
- `PGPASSWORD` (use as `DB_PASSWORD`)
- `PGDATABASE` (use as `DB_NAME`)
- `DATABASE_URL` (full connection string - you can parse this)

Set these manually:
```
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_SSL=true
DB_LOGGING=false
DB_SYNCHRONIZE=false
```

#### Redis Variables (if using Redis)
```
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
```

#### Security Variables
```
JWT_SECRET=<generate-a-strong-secret-min-256-bits>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ENCRYPTION_KEY=<generate-a-strong-32-char-key>
```

#### CORS Configuration
```
CORS_ORIGINS=https://your-frontend-domain.com,https://your-app-name.up.railway.app
API_KEYS_ONLY=false
```

#### Rate Limiting
```
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

### 5. Run Database Migrations

Before your app starts, you need to run migrations. You can do this via Railway's CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link your project
railway link

# Run migrations
railway run npm run migration:run
```

Or add a release command in Railway:
- Go to your service settings
- Add a "Release Command": `npm run migration:run`
- This will run before each deployment

### 6. Deploy

Railway will automatically deploy when you:
- Push to your connected branch (usually `main` or `master`)
- Trigger a manual deployment from the Railway dashboard

### 7. Access Your Application

Once deployed, Railway will provide you with:
- A public URL (e.g., `https://your-app-name.up.railway.app`)
- Your API will be available at: `https://your-app-name.up.railway.app`
- API Documentation: `https://your-app-name.up.railway.app/api/docs`

## Troubleshooting

### "No Deploys for This Service" Error

If you see "no deploys for this service", try these steps:

1. **Check Repository Connection**
   - Go to your service settings → "Source" tab
   - Ensure your GitHub repository is connected
   - Verify the correct branch is selected (usually `main` or `master`)

2. **Trigger Manual Deployment**
   - In Railway dashboard, click on your service
   - Click "Deploy" button or "Redeploy" option
   - Or go to "Settings" → "Deploy" → "Manual Deploy"

3. **Push Changes to Trigger Auto-Deploy**
   ```bash
   git add railway.toml Dockerfile .dockerignore
   git commit -m "Add Railway deployment configuration"
   git push origin main
   ```
   Railway should automatically detect the push and start building

4. **Check Build Settings**
   - Go to your service → "Settings" → "Build"
   - Ensure "Dockerfile" is selected as the build method
   - Verify the root directory is correct (should be `/`)

5. **Check Service Type**
   - Make sure you created a "Service" (not just a Database)
   - If you only see databases, click "New" → "Service" → "GitHub Repo"

6. **Check Build Logs**
   - Click on your service
   - Look for any build errors in the logs
   - Common issues: missing files, build failures

7. **Verify Files Are Committed**
   - Ensure `railway.toml` and `Dockerfile` are committed to your repository
   - Check that they're not in `.gitignore`

### Database Connection Issues
- Ensure `DB_SSL=true` is set for Railway's PostgreSQL
- Check that all database environment variables are correctly set

### Application Won't Start
- Check logs in Railway dashboard
- Verify all required environment variables are set
- Ensure migrations have been run

### Redis Connection Issues
- Verify Redis service is provisioned
- Check Redis environment variables are correctly set
- Redis is optional - the app will work without it (some features may be limited)

## Custom Domain (Optional)

1. Go to your service settings
2. Click on "Settings" → "Domains"
3. Add your custom domain and follow DNS configuration instructions

## Monitoring

Railway provides:
- Real-time logs
- Metrics dashboard
- Deployment history

Access these from your service dashboard.

