# ClarifAI Deployment Guide

Complete guide for deploying ClarifAI to production.

## Architecture Overview

```
Frontend (Vercel) → Backend API (Railway/Render/Fly.io)
```

- **Frontend**: Next.js app deployed on Vercel
- **Backend**: FastAPI + Manim deployed on Railway (or alternative)

---

## Frontend Deployment (Vercel)

### Prerequisites
- Vercel account
- Git repository pushed to GitHub/GitLab/Bitbucket

### Step 1: Install Vercel CLI (Optional)
```bash
npm i -g vercel
```

### Step 2: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### Step 3: Set Environment Variables

In Vercel dashboard, add these environment variables:

```
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
NEXT_PUBLIC_WS_URL=wss://your-backend-url.railway.app
```

### Step 4: Deploy

Click "Deploy" and Vercel will build and deploy your frontend.

### Alternative: Deploy via CLI

```bash
cd frontend

# First deployment
vercel

# Production deployment
vercel --prod
```

---

## Backend Deployment (Railway)

### Prerequisites
- Railway account
- Docker installed (for local testing)

### Step 1: Install Railway CLI

```bash
npm i -g @railway/cli
```

### Step 2: Login to Railway

```bash
railway login
```

### Step 3: Create New Project

```bash
cd backend
railway init
```

### Step 4: Set Environment Variables

```bash
railway variables set GEMINI_API_KEY=your_gemini_api_key
railway variables set FRONTEND_URL=https://your-vercel-app.vercel.app
railway variables set PORT=8000
```

### Step 5: Deploy

```bash
railway up
```

Railway will:
1. Build the Docker image
2. Deploy the container
3. Provide you with a public URL

### Step 6: Update Frontend Environment Variables

Go back to Vercel and update:
```
NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
NEXT_PUBLIC_WS_URL=wss://your-railway-app.railway.app
```

Then redeploy the frontend.

---

## Alternative Backend Deployment Options

### Option 1: Render

1. Go to [render.com](https://render.com)
2. Create new "Web Service"
3. Connect your Git repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `docker build -t clarifai-backend .`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Set environment variables (same as Railway)
6. Deploy

### Option 2: Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Navigate to backend
cd backend

# Launch app
fly launch

# Set secrets
fly secrets set GEMINI_API_KEY=your_key
fly secrets set FRONTEND_URL=https://your-vercel-app.vercel.app

# Deploy
fly deploy
```

### Option 3: Google Cloud Run

```bash
# Install gcloud CLI
# See: https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Build and deploy
cd backend
gcloud run deploy clarifai-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key,FRONTEND_URL=https://your-vercel-app.vercel.app
```

---

## Local Development

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local

# Edit .env.local with your backend URL
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Run dev server
npm run dev
```

Frontend will be available at http://localhost:3000

### Backend

```bash
cd backend

# Create .env
cp .env.example .env

# Edit .env with your Gemini API key
# GEMINI_API_KEY=your_key

# Run with start script (recommended)
cd ..
./start.sh
```

Backend will be available at http://localhost:8000

---

## Testing the Deployment

### 1. Test Frontend
- Visit your Vercel URL
- Upload a PDF
- Should redirect to paper analysis page

### 2. Test Backend
```bash
curl https://your-backend-url.railway.app/health
```

Should return:
```json
{"status": "healthy"}
```

### 3. Test Full Flow
1. Upload a research paper PDF
2. Click "Analyze Paper"
3. Wait for concepts to be extracted
4. Click "Generate Video" on a concept
5. Monitor live logs via WebSocket
6. Video should appear when ready

---

## Troubleshooting

### Frontend Issues

**Build fails on Vercel:**
- Check Node.js version (should be 18+)
- Verify all dependencies are in package.json
- Check build logs for specific errors

**API requests fail:**
- Verify NEXT_PUBLIC_API_URL is set correctly
- Check CORS settings in backend
- Ensure backend is deployed and healthy

### Backend Issues

**Docker build fails:**
- Check Python versions (3.13 and 3.12 required)
- Verify all dependencies are in requirements.txt
- Check Dockerfile syntax

**Video generation fails:**
- Verify FFmpeg is installed in container
- Check Manim dependencies
- Review agent_venv Python 3.12 environment
- Check logs for specific errors

**CORS errors:**
- Set FRONTEND_URL environment variable correctly
- Verify CORS middleware in backend/app/main.py

**WebSocket connection fails:**
- Use wss:// (not ws://) in production
- Check firewall/proxy settings
- Verify WebSocket support on hosting platform

---

## Environment Variables Reference

### Frontend (Vercel)
| Variable | Example | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` | Backend API base URL |
| `NEXT_PUBLIC_WS_URL` | `wss://api.example.com` | Backend WebSocket URL |

### Backend (Railway/Render/Fly.io)
| Variable | Example | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | `AIza...` | Google Gemini API key (required) |
| `PORT` | `8000` | Server port (auto-set by most platforms) |
| `FRONTEND_URL` | `https://app.example.com` | Frontend URL for CORS |

---

## Cost Estimates

### Free Tier Options
- **Vercel**: Free for hobby projects
- **Railway**: $5/month credit (enough for small usage)
- **Render**: Free tier available (with limitations)

### Expected Costs (Low-Medium Usage)
- **Frontend (Vercel)**: Free - $20/month
- **Backend (Railway)**: $5 - $20/month
- **Total**: $5 - $40/month

### Notes
- Video generation is CPU-intensive (main cost driver)
- Consider implementing queue system for high traffic
- Monitor usage and set billing alerts

---

## Security Checklist

- [ ] Environment variables set correctly (no hardcoded keys)
- [ ] CORS configured with specific origin (not `*`)
- [ ] API rate limiting enabled
- [ ] HTTPS enforced (automatic on Vercel/Railway)
- [ ] File upload size limits set
- [ ] Input validation on all endpoints
- [ ] Secrets stored securely (Railway secrets, Vercel env vars)

---

## Monitoring & Logs

### Vercel Logs
```bash
vercel logs --follow
```

### Railway Logs
```bash
railway logs --follow
```

### Health Check Endpoints
- Backend: `https://your-backend-url/health`
- Add custom health checks for database, Gemini API, etc.

---

## Scaling Considerations

For production at scale:

1. **Add Redis for caching**
   - Cache paper analysis results
   - Store video generation queue

2. **Use object storage (S3/GCS)**
   - Store PDFs and videos externally
   - Reduce container storage needs

3. **Implement job queue (Celery/BullMQ)**
   - Offload video generation to workers
   - Better resource management

4. **Add database (PostgreSQL)**
   - Replace in-memory storage
   - Enable multi-instance deployment

5. **Set up CDN (Cloudflare)**
   - Serve videos faster globally
   - Reduce bandwidth costs

---

## Support

For issues or questions:
- Check logs first (Vercel/Railway dashboard)
- Review this deployment guide
- Check GitHub issues
- Verify environment variables are set correctly

---

## Quick Reference Commands

```bash
# Deploy frontend
cd frontend && vercel --prod

# Deploy backend
cd backend && railway up

# View frontend logs
vercel logs --follow

# View backend logs
railway logs --follow

# Test backend health
curl https://your-backend-url/health

# Update environment variables (Vercel)
vercel env add NEXT_PUBLIC_API_URL

# Update environment variables (Railway)
railway variables set GEMINI_API_KEY=new_key
```
