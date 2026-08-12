# Instagram Reels Downloader

A local-first Instagram Reels downloader with a small Express backend and a static frontend.

## What it does

- Accepts Instagram links only
- Supports public reels when `yt-dlp` can resolve them
- Shows direct download options for video, audio, and image assets
- Runs locally without ads, trackers, or bundled monetization scripts

## Project structure

- `backend/`: Express API on `http://localhost:5000`
- `frontend/`: static website on `http://localhost:3000`
- `frontend/server.js`: tiny local static server for the frontend
- `.env.example`: safe example backend environment
- `.gitignore`: excludes dependencies, local secrets, logs, and generated output

## Requirements

Install these on your machine before testing real Instagram downloads:

- Node.js
- `yt-dlp` available in `PATH`, or set `YT_DLP_PATH`
- `ffmpeg` available in `PATH`

Optional backend environment variables:

- `PORT`
- `TRUST_PROXY` set to `1` on Render
- `FRONTEND_URL`
- `YT_DLP_PATH`

Copy `.env.example` to `.env` for local values if you use a dotenv loader or deployment platform environment settings.

## Install dependencies

The backend dependencies are defined in `backend/package.json`.

```powershell
cd backend
npm install
```

If PowerShell blocks `npm`, use:

```powershell
npm.cmd install
```

## Run locally

Open two terminals in the project root.

### Terminal 1: backend

```powershell
node backend/server.js
```

Or:

```powershell
npm.cmd run start:backend
```

The backend will run at:

```text
http://localhost:5000
```

### Terminal 2: frontend

```powershell
node frontend/server.js
```

Or:

```powershell
npm.cmd run start:frontend
```

The frontend will run at:

```text
http://localhost:3000
```

## Open the website

After both servers are running, open:

```text
http://localhost:3000
```

The frontend is hardcoded to call the local backend at:

```text
http://localhost:5000
```

For deployment, set `window.HD_MEDIA_API_BASE` in `frontend/index.html` or serve the frontend behind the same origin as the API.

## Local checklist

- Backend starts without errors
- Frontend starts without errors
- `http://localhost:5000/health` returns `{"status":"ok"}`
- `http://localhost:3000` loads the website
- Public Instagram reel links return download options

## Important notes

- If downloads fail with `spawn yt-dlp ENOENT`, install `yt-dlp` or set `YT_DLP_PATH`.
- Only public Instagram reel links are supported.
