# Dane County Election War Room

A real-time election dashboard for Dane County, WI.

## Features
- Live election results from `api.countyofdane.com`
- Interactive ward-level heatmap (Leaflet)
- Historical turnout estimation
- Dark mode premium UI
- Mobile responsive

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation
1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Test Mode
To run with archived 2024 data instead of live API:
1. Create `.env.local`:
   ```
   NEXT_PUBLIC_TEST_MODE=2024
   ```
2. Restart the dev server.

## Building for Production
This project is configured for static export.

```bash
npm run build
```
The static files will be generated in the `out/` directory.

## Deployment

### GitHub Pages
1. Push to GitHub.
2. Go to Settings > Pages.
3. Select `GitHub Actions` as the source.
4. Use the Next.js static export workflow.

### Netlify
1. Connect your repo to Netlify.
2. Build command: `npm run build`
3. Publish directory: `out`
