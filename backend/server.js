const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 5000;
const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";
const YT_DLP_COOKIES = process.env.YT_DLP_COOKIES || "";
const YT_DLP_COOKIES_FILE = process.env.YT_DLP_COOKIES_FILE || "";
const YT_DLP_COOKIES_FROM_BROWSER = process.env.YT_DLP_COOKIES_FROM_BROWSER || "";
let generatedCookiesFile = "";

function parseTrustProxy(value) {
  if (value === undefined || value === null || value === "") {
    return 1;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  const numericValue = Number(normalized);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  return value;
}

app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 20,
    message: { error: "Too many requests. Please wait a minute." },
  })
);

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isInstagramUrl(str) {
  try {
    const u = new URL(str);
    const hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    return hostname === "instagram.com";
  } catch {
    return false;
  }
}

function detectInstagramType(value) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();

    if (pathname.includes("/reel/") || pathname.includes("/reels/")) return "reel";

    return "unsupported";
  } catch {
    return "unsupported";
  }
}

function buildPrivateContentMessage(type) {
  if (type === "reel") {
    return "Can't download private reel. Only public Instagram reels are supported.";
  }

  return "Can't download private Instagram content. Only public Instagram links are supported.";
}

function buildInstagramAuthMessage(type) {
  const baseMessage =
    type === "reel"
      ? "Instagram is blocking anonymous access to this reel right now."
      : "Instagram is blocking anonymous access to this post right now.";

  if (YT_DLP_COOKIES || YT_DLP_COOKIES_FILE || YT_DLP_COOKIES_FROM_BROWSER) {
    return `${baseMessage} Refresh the cookies configured in your environment.`;
  }

  return `${baseMessage} Add logged-in Instagram cookies with YT_DLP_COOKIES or YT_DLP_COOKIES_FILE.`;
}

function heightToLabel(h) {
  if (!h) return null;
  if (h >= 2160) return "4K";
  if (h >= 1440) return "1440p";
  if (h >= 1080) return "1080p";
  if (h >= 720) return "720p";
  if (h >= 480) return "480p";
  if (h >= 360) return "360p";
  return `${h}p`;
}

function runYtDlp(args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      YT_DLP,
      [...buildYtDlpAuthArgs(), ...args],
      { maxBuffer: 10 * 1024 * 1024, ...options },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error((stderr || err.message || "").trim() || "yt-dlp failed."));
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

function buildYtDlpAuthArgs() {
  const args = [];

  const cookiesFile = getCookiesFilePath();
  if (cookiesFile) {
    args.push("--cookies", cookiesFile);
    // If a cookies file is provided, prefer it and skip browser cookie extraction.
    // This avoids failures like "Could not copy Chrome cookie database" when the browser DB is locked.
    return args;
  }

  if (YT_DLP_COOKIES_FROM_BROWSER) {
    args.push("--cookies-from-browser", YT_DLP_COOKIES_FROM_BROWSER);
  }

  return args;
}

function getCookiesFilePath() {
  if (YT_DLP_COOKIES_FILE) {
    return YT_DLP_COOKIES_FILE;
  }

  if (!YT_DLP_COOKIES) {
    return "";
  }

  if (!generatedCookiesFile) {
    generatedCookiesFile = path.join(os.tmpdir(), "instagram-downloader-cookies.txt");
    fs.writeFileSync(generatedCookiesFile, YT_DLP_COOKIES, "utf8");
  }

  return generatedCookiesFile;
}

async function getMediaInfo(url) {
  const baseArgs = ["--dump-single-json", "--no-playlist", "--no-warnings"];

  try {
    const { stdout } = await runYtDlp([...baseArgs, url]);
    return JSON.parse(stdout);
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();

    if (
      msg.includes("no video formats found") ||
      msg.includes("no formats found") ||
      msg.includes("there is no video")
    ) {
      const { stdout } = await runYtDlp([...baseArgs, "--ignore-no-formats", url]);
      try {
        return JSON.parse(stdout);
      } catch {
        throw new Error("Failed to parse yt-dlp output.");
      }
    }

    throw err;
  }
}

function buildVideoSelector(format) {
  if (format.acodec && format.acodec !== "none") {
    return `${format.format_id}/best[height<=${format.height}]`;
  }

  return `${format.format_id}+bestaudio/${format.format_id}/bestvideo[height<=${format.height}]+bestaudio/best[height<=${format.height}]`;
}

function pickBestVideoFormats(meta) {
  const seen = new Set();

  const candidates = (meta.formats || [])
    .filter((f) => f.url && f.format_id && f.vcodec && f.vcodec !== "none" && f.height)
    .sort((a, b) =>
      (b.height || 0) - (a.height || 0) ||
      (b.fps || 0) - (a.fps || 0) ||
      (b.tbr || 0) - (a.tbr || 0) ||
      (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0)
    );

  const formats = [];

  for (const format of candidates) {
    const label = heightToLabel(format.height);
    if (!label || seen.has(label)) continue;

    seen.add(label);

    const hasMuxedAudio = format.acodec && format.acodec !== "none";
    formats.push({
      quality: label,
      format: hasMuxedAudio ? (format.ext || "mp4") : "mp4",
      selector: buildVideoSelector(format),
      directUrl: hasMuxedAudio ? format.url : null,
      filesize: format.filesize || format.filesize_approx || null,
      kind: "video",
      hasAudio: true,
      source: hasMuxedAudio ? "direct" : "merged",
    });
  }

  return formats;
}

function pickBestAudioFormat(meta) {
  const audioFormats = (meta.formats || [])
    .filter(
      (f) =>
        f.url &&
        f.format_id &&
        f.acodec &&
        f.acodec !== "none" &&
        (!f.vcodec || f.vcodec === "none")
    )
    .sort((a, b) =>
      (b.abr || 0) - (a.abr || 0) ||
      (b.asr || 0) - (a.asr || 0) ||
      (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0)
    );

  if (!audioFormats.length) return null;

  const best = audioFormats[0];
  return {
    quality: "Audio",
    format: best.ext || "m4a",
    selector: `${best.format_id}/bestaudio/best`,
    directUrl: best.url,
    filesize: best.filesize || best.filesize_approx || null,
    kind: "audio",
    hasAudio: true,
    source: "direct",
  };
}

function inferExtFromUrl(value, fallback = "jpg") {
  try {
    const pathname = new URL(value).pathname || "";
    const ext = path.extname(pathname).replace(".", "").toLowerCase();
    return ext || fallback;
  } catch {
    return fallback;
  }
}

function buildDirectAsset({
  url,
  quality,
  format,
  filesize = null,
  kind = "image",
  source = "direct",
}) {
  if (!url) return null;

  return {
    quality,
    format,
    selector: null,
    directUrl: url,
    filesize,
    kind,
    hasAudio: kind !== "image",
    source,
  };
}

function dedupeFormats(formats) {
  const seen = new Set();
  const result = [];

  for (const item of formats) {
    if (!item?.directUrl && !item?.selector) continue;

    const key = [
      item.kind || "",
      item.quality || "",
      item.format || "",
      item.directUrl || "",
      item.selector || "",
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function pickImageFormats(meta) {
  const candidates = [];

  // Some extractors expose images as "formats" with no video codec.
  if (Array.isArray(meta.formats)) {
    const imageLike = meta.formats
      .filter((format) => {
        if (!format?.url) return false;
        const ext = String(format.ext || "").toLowerCase();
        const vcodec = String(format.vcodec || "").toLowerCase();
        const acodec = String(format.acodec || "").toLowerCase();

        const looksLikeImageExt = ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp";
        const noVideo = !vcodec || vcodec === "none";
        const noAudio = !acodec || acodec === "none";

        return looksLikeImageExt || (noVideo && noAudio && (format.width || format.height));
      })
      .sort(
        (a, b) =>
          (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0) ||
          (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0)
      );

    if (imageLike.length) {
      const best = imageLike[0];
      candidates.push(
        buildDirectAsset({
          url: best.url,
          quality: best.width && best.height ? `${best.width}x${best.height}` : "Image",
          format: best.ext || inferExtFromUrl(best.url, "jpg"),
          filesize: best.filesize || best.filesize_approx || null,
          kind: "image",
        })
      );
    }
  }

  if (meta.url && (!meta.formats || !meta.formats.length)) {
    candidates.push(
      buildDirectAsset({
        url: meta.url,
        quality: "Original",
        format: meta.ext || inferExtFromUrl(meta.url, "jpg"),
        filesize: meta.filesize || meta.filesize_approx || null,
        kind: "image",
      })
    );
  }

  if (meta.thumbnail) {
    candidates.push(
      buildDirectAsset({
        url: meta.thumbnail,
        quality: "Preview",
        format: inferExtFromUrl(meta.thumbnail, "jpg"),
        kind: "image",
      })
    );
  }

  if (Array.isArray(meta.thumbnails)) {
    const largestThumb = [...meta.thumbnails]
      .filter((thumb) => thumb?.url)
      .sort(
        (a, b) =>
          (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0)
      )[0];

    if (largestThumb?.url) {
      candidates.push(
        buildDirectAsset({
          url: largestThumb.url,
          quality: "Image",
          format: inferExtFromUrl(largestThumb.url, "jpg"),
          filesize: largestThumb.filesize || null,
          kind: "image",
        })
      );
    }
  }

  return dedupeFormats(candidates).filter(Boolean);
}

function pickEntryFormats(meta) {
  if (!Array.isArray(meta.entries) || !meta.entries.length) {
    return [];
  }

  const formats = [];

  meta.entries.forEach((entry, index) => {
    const entryLabel = `Item ${index + 1}`;
    const videos = pickBestVideoFormats(entry).map((format) => ({
      ...format,
      quality: `${entryLabel} ${format.quality || "Video"}`,
    }));
    const audio = pickBestAudioFormat(entry);
    const images = pickImageFormats(entry).map((format) => ({
      ...format,
      quality: `${entryLabel} ${format.quality || "Image"}`,
    }));

    formats.push(...videos, ...images);

    if (audio) {
      formats.push({
        ...audio,
        quality: `${entryLabel} Audio`,
      });
    }
  });

  return dedupeFormats(formats);
}

async function downloadWithYtDlp(sourceUrl, selector, outputTemplate) {
  await runYtDlp(
    [
      "--no-playlist",
      "--no-warnings",
      "-f",
      selector || "best",
      "--merge-output-format",
      "mp4",
      "-o",
      outputTemplate,
      sourceUrl,
    ],
    { maxBuffer: 2 * 1024 * 1024 }
  );
}

async function downloadThumbnailWithYtDlp(sourceUrl, outputTemplate) {
  // For image-only media, yt-dlp may not expose video formats but can still write a thumbnail.
  // This uses auth cookies (if configured) because it goes through yt-dlp, not a raw HTTP fetch.
  await runYtDlp(
    [
      "--no-playlist",
      "--no-warnings",
      "--ignore-no-formats",
      "--skip-download",
      "--write-thumbnail",
      "-o",
      outputTemplate,
      sourceUrl,
    ],
    { maxBuffer: 2 * 1024 * 1024 }
  );
}

async function removeDirSafe(dirPath) {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures.
  }
}

function streamRemoteFile(res, remoteUrl, safeFile) {
  res.setHeader("Content-Disposition", `attachment; filename="${safeFile}"`);
  res.setHeader("Content-Type", "application/octet-stream");

  const protocol = remoteUrl.startsWith("https") ? https : http;
  const request = protocol.get(remoteUrl, (stream) => {
    if (stream.statusCode !== 200) {
      res.status(502).json({ error: "Could not fetch the media file." });
      stream.resume();
      return;
    }

    if (stream.headers["content-length"]) {
      res.setHeader("Content-Length", stream.headers["content-length"]);
    }

    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(502).json({ error: "Download stream failed." });
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
  });

  request.on("error", () => {
    if (!res.headersSent) {
      res.status(502).json({ error: "Download stream failed." });
    }
  });
}

app.post("/api/info", async (req, res) => {
  const { url } = req.body;
  const mediaType = detectInstagramType(url);

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "Invalid or missing URL." });
  }

  if (!isInstagramUrl(url)) {
    return res.status(422).json({ error: "Only Instagram URLs are supported." });
  }

  if (mediaType !== "reel") {
    return res.status(422).json({ error: "Only Instagram reel URLs are supported." });
  }

  try {
    const meta = await getMediaInfo(url);

    const title = meta.title || "Unknown Title";
    const thumbnail =
      meta.thumbnail ||
      (meta.thumbnails?.length ? meta.thumbnails[meta.thumbnails.length - 1].url : null);

    const formats = pickBestVideoFormats(meta);
    const bestAudio = pickBestAudioFormat(meta);
    const imageFormats = pickImageFormats(meta);
    const entryFormats = pickEntryFormats(meta);
    if (bestAudio) formats.push(bestAudio);
    formats.push(...imageFormats, ...entryFormats);

    if (!formats.length) {
      formats.push({
        quality: "Best",
        format: meta.ext || inferExtFromUrl(meta.url, "mp4"),
        selector: "best",
        directUrl: meta.url || null,
        filesize: meta.filesize || null,
        kind: meta.ext === "jpg" || meta.ext === "jpeg" || meta.ext === "png" ? "image" : "video",
        hasAudio: meta.ext !== "jpg" && meta.ext !== "jpeg" && meta.ext !== "png",
        source: "direct",
      });
    }

    return res.json({ title, thumbnail, formats: dedupeFormats(formats), mediaType });
  } catch (err) {
    console.error("yt-dlp error:", err.message);

    const msg = err.message.toLowerCase();
    if (msg.includes("unsupported url")) {
      return res.status(422).json({ error: "Unsupported platform or URL." });
    }
    if (msg.includes("empty media response")) {
      return res.status(403).json({
        error: buildInstagramAuthMessage(mediaType),
        mediaType,
      });
    }
    if (
      msg.includes("private") ||
      msg.includes("login") ||
      msg.includes("rate-limit") ||
      msg.includes("requested content is not available")
    ) {
      return res.status(403).json({
        error: buildPrivateContentMessage(mediaType),
        mediaType,
      });
    }
    if (msg.includes("not found") || msg.includes("404")) {
      return res.status(404).json({ error: "Media not found. The URL may be invalid or removed." });
    }

    return res.status(500).json({ error: "Failed to fetch media info. Please try again." });
  }
});

app.get("/api/download", async (req, res) => {
  const { source, selector, filename, mediaUrl } = req.query;

  const safeFile = String(filename || "download").replace(/[^a-z0-9._\-]/gi, "_");

  if (mediaUrl) {
    const decodedMediaUrl = decodeURIComponent(mediaUrl);

    if (!isValidUrl(decodedMediaUrl)) {
      return res.status(400).json({ error: "Invalid media URL." });
    }

    streamRemoteFile(res, decodedMediaUrl, safeFile);
    return;
  }

  if (!source || !isValidUrl(decodeURIComponent(source))) {
    return res.status(400).json({ error: "Invalid source URL." });
  }

  const decodedSource = decodeURIComponent(source);

  if (!isInstagramUrl(decodedSource)) {
    return res.status(422).json({ error: "Only Instagram URLs are supported." });
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "media-downloader-"));
  const outputTemplate = path.join(tempDir, "download.%(ext)s");

  try {
    await downloadWithYtDlp(decodedSource, String(selector || "best"), outputTemplate);

    const files = await fs.promises.readdir(tempDir);
    const pickedName = files.find((name) => name.startsWith("download."));

    if (!pickedName) {
      throw new Error("yt-dlp did not create a download file.");
    }

    const filePath = path.join(tempDir, pickedName);
    const stat = await fs.promises.stat(filePath);
    const downloadName = path.extname(safeFile)
      ? safeFile
      : `${safeFile}${path.extname(pickedName) || ""}`;

    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stat.size);

    const stream = fs.createReadStream(filePath);
    let cleaned = false;

    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      stream.destroy();
      await removeDirSafe(tempDir);
    };

    stream.on("error", async () => {
      if (!res.headersSent) {
        res.status(502).json({ error: "Download stream failed." });
      } else {
        res.destroy();
      }
      await cleanup();
    });

    stream.on("close", cleanup);
    res.on("close", cleanup);
    stream.pipe(res);
  } catch (err) {
    await removeDirSafe(tempDir);
    console.error("download error:", err.message);

    const msg = err.message.toLowerCase();
    if (msg.includes("ffmpeg")) {
      return res.status(500).json({ error: "High-quality video merging requires ffmpeg on the server." });
    }
    if (msg.includes("empty media response")) {
      return res.status(403).json({
        error: buildInstagramAuthMessage("reel"),
      });
    }

    if (msg.includes("no video formats found") || msg.includes("no formats found") || msg.includes("there is no video")) {
      try {
        // First try to use metadata (fast path).
        const meta = await getMediaInfo(decodedSource);
        const imageFormats = [...pickImageFormats(meta), ...pickEntryFormats(meta)].filter(
          (format) => format && format.kind === "image" && format.directUrl
        );

        if (imageFormats.length) {
          streamRemoteFile(res, imageFormats[0].directUrl, safeFile);
          return;
        }
      } catch (fallbackErr) {
        console.error("image fallback error:", fallbackErr.message);
      }

      try {
        const thumbTemplate = path.join(tempDir, "thumb.%(ext)s");
        await downloadThumbnailWithYtDlp(decodedSource, thumbTemplate);
        const files = await fs.promises.readdir(tempDir);
        const pickedThumb = files.find((name) => name.startsWith("thumb."));
        if (pickedThumb) {
          const filePath = path.join(tempDir, pickedThumb);
          const stat = await fs.promises.stat(filePath);
          const downloadName = path.extname(safeFile)
            ? safeFile
            : `${safeFile}${path.extname(pickedThumb) || ""}`;

          res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader("Content-Length", stat.size);

          const stream = fs.createReadStream(filePath);
          let cleaned = false;
          const cleanup = async () => {
            if (cleaned) return;
            cleaned = true;
            stream.destroy();
            await removeDirSafe(tempDir);
          };

          stream.on("error", async () => {
            if (!res.headersSent) {
              res.status(502).json({ error: "Download stream failed." });
            } else {
              res.destroy();
            }
            await cleanup();
          });

          stream.on("close", cleanup);
          res.on("close", cleanup);
          stream.pipe(res);
          return;
        }
      } catch (thumbErr) {
        console.error("thumbnail fallback error:", thumbErr.message);
      }
    }

    return res.status(500).json({ error: "Failed to prepare the selected download." });
  }
});

app.get("/", (_req, res) => {
  res.json({ status: "Instagram Downloader API is running" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
