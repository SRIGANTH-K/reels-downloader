<div align="center">

# 🎬 Instagram Reels Downloader

### Download publicly accessible Instagram Reels, videos, audio & image assets through a simple web interface.

<p>
  <a href="https://github.com/SRIGANTH-K/reels-downloader">
    <img src="https://img.shields.io/github/stars/SRIGANTH-K/reels-downloader?style=for-the-badge" alt="GitHub Stars">
  </a>
  <a href="https://github.com/SRIGANTH-K/reels-downloader">
    <img src="https://img.shields.io/github/forks/SRIGANTH-K/reels-downloader?style=for-the-badge" alt="GitHub Forks">
  </a>
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-API-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js">
</p>

<p>
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-project-structure">Structure</a>
</p>

</div>

---

## ✨ Features

* 🎥 Download publicly accessible Instagram Reels
* 🔗 Simple Instagram URL input
* 🎵 Direct audio download support
* 🖼️ Image asset support when available
* ⚡ Lightweight Express backend
* 🌐 Simple static frontend
* 🛠️ Powered by `yt-dlp`
* 🎬 Uses `FFmpeg` for media processing
* 🔒 Environment-variable based configuration
* 💻 Designed for local/self-hosted usage

---

## 🖥️ Preview

> Add a screenshot of your application here.

<div align="center">

<img src="docs/screenshots/home.png" alt="Instagram Reels Downloader" width="900">

</div>

### 🎥 Demo

Add a short GIF or demo video here:

```markdown
![Demo](docs/demo.gif)
```

A short 5–10 second recording showing:

**Paste URL → Fetch → Preview → Download**

will make the repository significantly more attractive.

---

## 🏗️ Architecture

```text
                 ┌─────────────────────────┐
                 │      Web Browser        │
                 │      Frontend :3000     │
                 └────────────┬────────────┘
                              │
                              │ HTTP API
                              ▼
                 ┌─────────────────────────┐
                 │    Express Backend      │
                 │      Backend :5000      │
                 └────────────┬────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │      yt-dlp      │
                    │  Media Resolver  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │      FFmpeg      │
                    │ Media Processing │
                    └──────────────────┘
```

---

## 🛠️ Tech Stack

| Layer            | Technology                     |
| ---------------- | ------------------------------ |
| Frontend         | HTML, CSS, JavaScript          |
| Backend          | Node.js                        |
| API              | Express.js                     |
| Media Resolver   | yt-dlp                         |
| Media Processing | FFmpeg                         |
| Configuration    | dotenv / environment variables |
| Development      | Git + GitHub                   |

---

## 📁 Project Structure

```text
reels-downloader/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   └── ...
│
├── frontend/
│   ├── index.html
│   ├── server.js
│   └── ...
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ Requirements

Before running the project, make sure you have:

* [Node.js](https://nodejs.org/) installed
* `yt-dlp` installed and available in your `PATH`
* `FFmpeg` installed and available in your `PATH`
* Git installed

Check your installations:

```bash
node --version
npm --version
yt-dlp --version
ffmpeg -version
```

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/SRIGANTH-K/reels-downloader.git
cd reels-downloader
```

### 2. Install backend dependencies

```bash
cd backend
npm install
cd ..
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure the required values in `.env`.

---

## ▶️ Run the Application

Open **two terminals**.

### Terminal 1 — Backend

From the project root:

```bash
node backend/server.js
```

Backend:

```text
http://localhost:5000
```

### Terminal 2 — Frontend

```bash
node frontend/server.js
```

Frontend:

```text
http://localhost:3000
```

Then open:

**http://localhost:3000**

---

## 🔗 How It Works

```text
1. Paste Instagram Reel URL
          ↓
2. Frontend sends request
          ↓
3. Express API receives URL
          ↓
4. yt-dlp resolves available media
          ↓
5. FFmpeg processes media when required
          ↓
6. Download options are returned
          ↓
7. User downloads the selected media
```

---

## 🔐 Environment Variables

| Variable              | Description                   |
| --------------------- | ----------------------------- |
| `PORT`                | Backend server port           |
| `TRUST_PROXY`         | Proxy configuration           |
| `FRONTEND_URL`        | Frontend origin               |
| `YT_DLP_PATH`         | Custom yt-dlp executable path |
| `YT_DLP_COOKIES`      | Optional cookie configuration |
| `YT_DLP_COOKIES_FILE` | Optional cookie file          |

See `.env.example` for the available configuration.

---

## 🧪 Health Check

After starting the backend, verify:

```text
http://localhost:5000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

## ⚠️ Limitations

* Only publicly accessible Instagram Reel URLs are supported.
* Download availability depends on what `yt-dlp` can resolve.
* Instagram may change its platform behavior, which can affect downloading.
* Some content may require authentication.
* `yt-dlp` and FFmpeg must be correctly installed and accessible.

---

## 🛡️ Responsible Use

This project is intended for **personal use and learning purposes**.

Only download content that you have permission to download. Respect Instagram's terms, copyright, intellectual-property rights, and the rights of content creators.

This project is not affiliated with or endorsed by Instagram or Meta.

---

## 🔮 Future Improvements

* [ ] Responsive UI improvements
* [ ] Download progress indicator
* [ ] Media preview before downloading
* [ ] Better error handling
* [ ] Automatic quality selection
* [ ] Download history
* [ ] Queue-based processing
* [ ] Docker support
* [ ] Production deployment configuration
* [ ] Automated tests
* [ ] CI/CD with GitHub Actions

---

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/your-feature
```

3. Commit your changes

```bash
git commit -m "Add your feature"
```

4. Push the branch

```bash
git push origin feature/your-feature
```

5. Open a Pull Request

---

## 👨‍💻 Author

<div align="center">

### Sri Ganth K

B.Tech — Artificial Intelligence & Data Science

<a href="https://github.com/SRIGANTH-K">
  <img src="https://img.shields.io/badge/GitHub-SRIGANTH--K-181717?style=for-the-badge&logo=github" alt="GitHub">
</a>

<a href="https://www.linkedin.com/in/sri-ganth-k">
  <img src="https://img.shields.io/badge/LinkedIn-Sri%20Ganth%20K-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn">
</a>

</div>

---

<div align="center">

⭐ If you find this project useful, consider giving it a star!

**Built with Node.js + Express + yt-dlp + FFmpeg**

</div>
