# Dane County War Room - GitHub Pages Deployment

## 🚀 Quick Deploy Instructions

### Step 1: Create GitHub Repository
1. Go to [github.com/new](https://github.com/new)
2. Name it: `dane-county-war-room`
3. Keep it **Public** (required for GitHub Pages on free plan)
4. Don't initialize with README (we already have code)
5. Click "Create repository"

### Step 2: Push Code to GitHub
```bash
cd /Users/tylerherman/Desktop/AntiGravity/dane-county-war-room

# Add your GitHub repo as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/dane-county-war-room.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (in left sidebar)
3. Under "Build and deployment":
   - Source: **GitHub Actions**
4. The deployment will start automatically!

### Step 4: Get Your Live URL
After ~2-3 minutes, your dashboard will be live at:
```
https://YOUR_USERNAME.github.io/dane-county-war-room/
```

## ✅ What's Already Configured

- ✅ Next.js configured for static export
- ✅ GitHub Actions workflow created (`.github/workflows/deploy.yml`)
- ✅ Automatic deployment on every push to `main`
- ✅ Mock data enabled by default
- ✅ SSR issues fixed (Leaflet map uses dynamic import)

## 🔄 Updating the Dashboard

Every time you push to the `main` branch, GitHub Actions will automatically rebuild and redeploy:

```bash
# Make changes, then:
git add .
git commit -m "Update dashboard"
git push
```

## 🌐 Switching to Live API

To use real Dane County election data instead of mock data:

1. Edit `.github/workflows/deploy.yml`
2. Change line 36 from:
   ```yaml
   NEXT_PUBLIC_USE_MOCK_DATA: true
   ```
   to:
   ```yaml
   NEXT_PUBLIC_USE_MOCK_DATA: false
   ```
3. Commit and push

## 📱 Sharing the Dashboard

Once deployed, anyone can access your dashboard at:
- `https://YOUR_USERNAME.github.io/dane-county-war-room/`
- Works on all devices (mobile, tablet, desktop)
- No login required
- Updates automatically when you push changes

## 🛠️ Local Development

```bash
cd /Users/tylerherman/Desktop/AntiGravity/dane-county-war-room
npm run dev
```

Visit http://localhost:3001

## 📊 Current Build Status

✅ Build successful (static export)
✅ All components working
✅ Map loads dynamically (no SSR issues)
✅ Ready to deploy
