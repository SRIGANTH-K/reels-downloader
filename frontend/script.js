const API_BASE = resolveApiBase();

const fetchForm = document.getElementById("fetchForm");
const urlInput = document.getElementById("urlInput");
const fetchBtn = document.getElementById("fetchBtn");
const pasteBtn = document.getElementById("pasteBtn");
const spinner = document.getElementById("spinner");
const errorBanner = document.getElementById("errorBanner");
const errorMsg = document.getElementById("errorMsg");
const errorClose = document.getElementById("errorClose");
const resultCard = document.getElementById("resultCard");
const thumbnail = document.getElementById("thumbnail");
const mediaTitle = document.getElementById("mediaTitle");
const mediaPlatform = document.getElementById("mediaPlatform");
const contentType = document.getElementById("contentType");
const formatCount = document.getElementById("formatCount");
const formatsGrid = document.getElementById("formatsGrid");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const toast = document.getElementById("toast");

const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text.trim();
    urlInput.focus();
    hideError();
  } catch {
    showToast("Clipboard access was blocked. Paste the Instagram link manually.");
  }
});

fetchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  if (!url) return;

  if (!isValidUrl(url)) {
    showError("Enter a valid link that starts with http:// or https://.");
    return;
  }

  if (!isInstagramUrl(url)) {
    showError("This downloader is set up for Instagram links only. Paste a URL from instagram.com.");
    return;
  }

  setLoading(true);
  hideError();
  hideResult();

  try {
    const response = await fetch(`${API_BASE}/api/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

  if (!response.ok) {
      showError(normalizeErrorMessage(data.error || "Could not fetch Instagram media.", url, data.mediaType));
      return;
    }

    renderResult(data, url);
  } catch {
    showError("The downloader server could not be reached. Make sure the backend is running.");
  } finally {
    setLoading(false);
  }
});

errorClose.addEventListener("click", hideError);

function renderResult({ title, thumbnail: thumb, formats, mediaType }, originalUrl) {
  const safeTitle = title || "Instagram media";
  const items = Array.isArray(formats) ? formats : [];
  const typeLabel = formatInstagramType(mediaType || detectInstagramType(originalUrl));

  thumbnail.src = thumb || buildFallbackThumb(safeTitle);
  thumbnail.alt = safeTitle;
  thumbnail.onerror = () => {
    thumbnail.src = buildFallbackThumb("Instagram");
  };

  mediaTitle.textContent = safeTitle;
  mediaPlatform.textContent = "Instagram";
  contentType.textContent = typeLabel;
  formatCount.textContent = `${items.length} option${items.length === 1 ? "" : "s"}`;

  formatsGrid.innerHTML = "";

  if (!items.length) {
    formatsGrid.innerHTML = `
      <div class="format-card">
        <div class="format-top">
          <span class="format-quality">No media found</span>
          <span class="format-badge video">Info</span>
        </div>
        <span class="format-size">This Instagram URL did not return any downloadable formats.</span>
      </div>
    `;
  } else {
    items.forEach((format) => {
      formatsGrid.appendChild(createFormatCard(format, safeTitle, originalUrl));
    });
  }

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createFormatCard(format, title, sourceUrl) {
  const isAudio = format.kind === "audio" || format.quality === "Audio";
  const isImage = format.kind === "image";
  const ext = format.format || (isAudio ? "mp3" : isImage ? "jpg" : "mp4");
  const filename = `${sanitizeFilename(title)}.${ext}`;
  const subtitle = isAudio
    ? "Audio only"
    : isImage
      ? "Ready for image download"
    : format.source === "merged"
      ? "Higher quality, may take longer to prepare"
      : "Ready for direct download";

  const downloadHref = format.directUrl
    ? `${API_BASE}/api/download?mediaUrl=${encodeURIComponent(format.directUrl)}&filename=${encodeURIComponent(filename)}`
    : `${API_BASE}/api/download?source=${encodeURIComponent(sourceUrl)}&selector=${encodeURIComponent(format.selector || "best")}&filename=${encodeURIComponent(filename)}`;

  const copyText = format.selector
    ? `${sourceUrl}\nformat=${format.selector}`
    : sourceUrl;

  const card = document.createElement("article");
  card.className = "format-card";
  card.innerHTML = `
    <div class="format-top">
      <span class="format-quality">${format.quality || "Best quality"}</span>
      <span class="format-badge ${isAudio ? "audio" : isImage ? "video" : "video"}">${ext}</span>
    </div>
    <span class="format-size">${subtitle}</span>
    ${format.filesize ? `<span class="format-size">${formatBytes(format.filesize)}</span>` : ""}
    <div class="format-actions">
      <a class="btn-download" href="${downloadHref}" download="${filename}">
        <i class="ph-bold ph-download-simple"></i>
        <span>Download</span>
      </a>
      <button class="btn-copy" type="button" title="Copy format info" data-url="${escapeHtml(copyText)}">
        <i class="ph-bold ph-copy"></i>
      </button>
    </div>
  `;

  card.querySelector(".btn-copy").addEventListener("click", async (event) => {
    try {
      await navigator.clipboard.writeText(event.currentTarget.dataset.url);
      showToast("Format details copied.");
    } catch {
      showToast("Copy failed. Try again.");
    }
  });

  return card;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  themeIcon.className = theme === "dark" ? "ph-bold ph-sun" : "ph-bold ph-moon";
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isInstagramUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
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

function formatInstagramType(type) {
  switch (String(type || "").toLowerCase()) {
    case "reel":
      return "Reel";
    default:
      return "Instagram Media";
  }
}

function normalizeErrorMessage(message, originalUrl = "", mediaType = "") {
  const lower = String(message).toLowerCase();
  const detectedType = String(mediaType || detectInstagramType(originalUrl)).toLowerCase();

  if (lower.includes("unsupported")) {
    return "Only Instagram reel URLs are supported in this version of the downloader.";
  }

  if (lower.includes("private") || lower.includes("login")) {
    return "Can't download private reel. Only public Instagram reels are supported.";
  }

  if (lower.includes("not found") || lower.includes("invalid")) {
    return "That Instagram link could not be found. Check the URL and try again.";
  }

  return message;
}

function buildFallbackThumb(label) {
  return `https://placehold.co/800x1000/f6d3bf/7a3124?text=${encodeURIComponent(label)}`;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function sanitizeFilename(name) {
  return (name || "instagram-download")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resolveApiBase() {
  const configured = window.HD_MEDIA_API_BASE || "";
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "";

  return isLocal ? "http://localhost:5000" : "";
}

function setLoading(isLoading) {
  spinner.classList.toggle("hidden", !isLoading);
  fetchBtn.disabled = isLoading;
  fetchBtn.querySelector("span").textContent = isLoading
    ? "Loading Instagram Media..."
    : "Get Download Options";
}

function showError(message) {
  errorMsg.textContent = message;
  errorBanner.classList.remove("hidden");
}

function hideError() {
  errorBanner.classList.add("hidden");
}

function hideResult() {
  resultCard.classList.add("hidden");
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  void toast.offsetWidth;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 250);
  }, 2400);
}
