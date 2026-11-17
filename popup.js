"use strict";

const TWEET_RE =
  /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com|fixvx\.com)\/(?:i\/(?:web\/)?status|([A-Za-z0-9_]{1,15})\/status)\/(\d+)/i;

const $ = (id) => document.getElementById(id);
const urlInput = $("url");
const goBtn = $("go");
const statusEl = $("status");
const resultEl = $("result");

// ---------- Parsing ----------

function parseTweet(text) {
  const m = String(text || "").trim().match(TWEET_RE);
  if (!m) return null;
  return { handle: m[1] || "i", id: m[2] };
}

function dimsFromUrl(url) {
  const m = String(url).match(/\/(\d{2,5})x(\d{2,5})\//);
  return m ? { width: +m[1], height: +m[2] } : { width: 0, height: 0 };
}

function qualityLabel(w, h) {
  const p = Math.min(w, h) || Math.max(w, h);
  return p ? p + "p" : "MP4";
}

function toVariants(list) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    if (!item || !item.url) continue;
    const type = item.content_type || item.contentType || item.container || "";
    const isHls = /mpegurl|m3u8/i.test(type) || /\.m3u8(\?|$)/i.test(item.url);
    const isMp4 = /mp4/i.test(type) || /\.mp4(\?|$)/i.test(item.url);
    if (isHls || !isMp4 || seen.has(item.url)) continue;
    seen.add(item.url);
    let { width, height } = dimsFromUrl(item.url);
    if (!width && item.width) { width = item.width; height = item.height || 0; }
    out.push({
      url: item.url,
      bitrate: Number(item.bitrate) || 0,
      width, height,
      label: qualityLabel(width, height)
    });
  }
  out.sort((a, b) => b.width * b.height - a.width * a.height || b.bitrate - a.bitrate);
  return out;
}

// ---------- API (fxtwitter → vxtwitter) ----------

async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) throw new Error("Postingan tidak ditemukan, dihapus, atau tidak publik.");
    if (!res.ok) throw new Error("Permintaan gagal (" + res.status + ").");
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function fromFx(data, id) {
  const t = data.tweet || data;
  const media = t.media || {};
  let vids = media.videos || (media.all || []).filter((m) => /video|gif/.test(m.type));
  const videos = vids.map((v) => {
    let variants = toVariants(v.variants || v.formats);
    if (!variants.length && v.url) variants = toVariants([{ url: v.url, content_type: "video/mp4", width: v.width, height: v.height }]);
    return { thumbnail: v.thumbnail_url || "", duration: v.duration || 0, variants };
  }).filter((v) => v.variants.length);

  // Video di dalam postingan yang di-quote
  if (t.quote && t.quote.media) {
    try { videos.push(...fromFx({ tweet: t.quote }, id).videos); } catch (_) {}
  }

  return {
    id: String(t.id || id),
    handle: (t.author && t.author.screen_name) || "",
    name: (t.author && t.author.name) || "",
    text: t.text || "",
    videos
  };
}

function fromVx(data, id) {
  const videos = (data.media_extended || [])
    .filter((m) => /video|gif/.test(m.type))
    .map((m) => ({
      thumbnail: m.thumbnail_url || "",
      duration: m.duration_millis ? m.duration_millis / 1000 : 0,
      variants: toVariants([{ url: m.url, content_type: "video/mp4", width: m.size && m.size.width, height: m.size && m.size.height }])
    }))
    .filter((v) => v.variants.length);
  return {
    id: String(data.tweetID || id),
    handle: data.user_screen_name || "",
    name: data.user_name || "",
    text: data.text || "",
    videos
  };
}

async function resolveTweet(p) {
  const path = encodeURIComponent(p.handle) + "/status/" + p.id;
  let tweet = null;
  let lastErr = null;
  try {
    const d = await getJson("https://api.fxtwitter.com/" + path);
    if (d && d.code && d.code !== 200) throw new Error(d.message || "Postingan tidak ditemukan.");
    tweet = fromFx(d, p.id);
  } catch (e) { lastErr = e; }

  if (!tweet || !tweet.videos.length) {
    try {
      const d = await getJson("https://api.vxtwitter.com/" + path);
      const vx = fromVx(d, p.id);
      if (!tweet || vx.videos.length) tweet = vx;
    } catch (e) { lastErr = lastErr || e; }
  }

  if (!tweet) throw lastErr || new Error("Tidak bisa memuat postingan.");
  return tweet;
}

// ---------- UI ----------

function setStatus(msg, isError) {
  statusEl.hidden = !msg;
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", !!isError);
}

function fmtSize(v) {
  const parts = [];
  if (v.width && v.height) parts.push(v.width + "×" + v.height);
  if (v.bitrate) parts.push(v.bitrate >= 1e6 ? (v.bitrate / 1e6).toFixed(1) + " Mbps" : Math.round(v.bitrate / 1e3) + " kbps");
  return parts.join(" · ");
}

function fmtDuration(s) {
  s = Math.round(Number(s) || 0);
  if (!s) return "";
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function safeName(s) {
  return String(s).replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "video";
}

function render(tweet) {
  resultEl.textContent = "";
  const post = document.createElement("div");
  post.className = "post";

  const author = document.createElement("p");
  author.className = "author";
  const b = document.createElement("b");
  b.textContent = tweet.name || tweet.handle || "Postingan X";
  author.append(b, tweet.handle ? " @" + tweet.handle : "");
  post.append(author);

  if (tweet.text) {
    const tx = document.createElement("p");
    tx.className = "text";
    tx.textContent = tweet.text;
    post.append(tx);
  }

  tweet.videos.forEach((video, i) => {
    const box = document.createElement("div");
    box.className = "video";

    if (video.thumbnail) {
      const img = document.createElement("img");
      img.src = video.thumbnail;
      img.alt = "";
      box.append(img);
    }

    const ctl = document.createElement("div");
    ctl.className = "controls";

    const label = document.createElement("div");
    label.className = "label";
    const dur = fmtDuration(video.duration);
    label.textContent = (tweet.videos.length > 1 ? "Video " + (i + 1) : "Video") + (dur ? " · " + dur : "");

    const select = document.createElement("select");
    video.variants.forEach((v, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      const extra = fmtSize(v);
      opt.textContent = v.label + (idx === 0 ? " (terbaik)" : "") + (extra ? " — " + extra : "");
      select.append(opt);
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Unduh";
    btn.addEventListener("click", async () => {
      const v = video.variants[Number(select.value)];
      const suffix = tweet.videos.length > 1 ? "_" + (i + 1) : "";
      const filename =
        "X-Videos/" + safeName((tweet.handle || "x") + "_" + tweet.id + suffix + "_" + v.label) + ".mp4";
      btn.disabled = true;
      try {
        await chrome.downloads.download({ url: v.url, filename, conflictAction: "uniquify" });
        btn.textContent = "Diunduh ✓";
      } catch (e) {
        setStatus("Gagal mengunduh: " + (e.message || e), true);
        btn.disabled = false;
      }
    });

    ctl.append(label, select, btn);
    box.append(ctl);
    post.append(box);
  });

  resultEl.append(post);
}

async function lookup() {
  const parsed = parseTweet(urlInput.value);
  resultEl.textContent = "";
  if (!parsed) {
    setStatus("Tempel link postingan X, contoh: x.com/user/status/123…", true);
    return;
  }
  goBtn.disabled = true;
  setStatus("Memuat…");
  try {
    const tweet = await resolveTweet(parsed);
    if (!tweet.videos.length) {
      setStatus("Postingan ini tidak berisi video.", true);
      return;
    }
    setStatus("");
    render(tweet);
  } catch (e) {
    setStatus(e.name === "AbortError" ? "Waktu habis. Coba lagi." : e.message || String(e), true);
  } finally {
    goBtn.disabled = false;
  }
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  lookup();
});

// Isi otomatis dari tab aktif (activeTab) jika sedang membuka postingan X
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab && tab.url && parseTweet(tab.url)) {
    urlInput.value = tab.url;
    lookup();
  } else {
    urlInput.focus();
  }
}).catch(() => urlInput.focus());
