# Dane County War Room - Deployment Guide

## Quick Deploy to Vercel (Recommended)

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Push to GitHub**:
   ```bash
   cd /Users/tylerherman/Desktop/AntiGravity/dane-county-war-room
   
   # Create a new repository on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/dane-county-war-room.git
   git branch -M main
   git push -u origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository"
   - Select your `dane-county-war-room` repository
   - Click "Deploy"
   - Done! You'll get a live URL like `https://dane-county-war-room.vercel.app`

3. **Configure Environment Variable** (to use live API):
   - In Vercel dashboard, go to your project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_USE_MOCK_DATA` = `false`
   - Redeploy

### Option 2: Deploy via Vercel CLI

If you want to use the CLI, try this alternative approach:

```bash
cd /Users/tylerherman/Desktop/AntiGravity/dane-county-war-room

# Login with email instead
npx vercel login --email your-email@example.com

# Then deploy
npx vercel --yes
```

## Current Status

✅ Application is fully built and tested locally
✅ Running at http://localhost:3001
✅ Git repository initialized and committed
✅ Ready for deployment

## Switch Between Mock and Live Data

**Mock Data (Current)**:
- Set in `.env.local`: `NEXT_PUBLIC_USE_MOCK_DATA=true`
- Uses generated mock election data

**Live API**:
- Set in Vercel: `NEXT_PUBLIC_USE_MOCK_DATA=false`
- Fetches from `https://electionresults.countyofdane.com`

## Sharing the Dashboard

Once deployed to Vercel, you'll get a URL like:
- `https://dane-county-war-room.vercel.app`
- `https://dane-county-war-room-your-username.vercel.app`

This URL is:
- ✅ Publicly accessible
- ✅ Shareable with anyone
- ✅ Auto-updates when you push changes to GitHub
- ✅ Free on Vercel's hobby plan

## Local Development

```bash
cd /Users/tylerherman/Desktop/AntiGravity/dane-county-war-room
npm run dev
```

Visit http://localhost:3001
