(() => {
  "use strict";

  // === НАСТРОЙКИ (прописать один раз) ===
  const CONFIG = {
    owner: "XANNYX1337",
    repo: "configs",
    branch: "main",
    folder: "configs",
    // Токен вводится на сайте (кнопка «🔑 Токен») и хранится в браузере,
    // чтобы не светить его в коде страницы.
    token: ""
  };

  const TOKEN_LS_KEY = "cfg-token";
  let token = localStorage.getItem(TOKEN_LS_KEY) || CONFIG.token;

  const META_FILE = "configs.json";

  const $ = (id) => document.getElementById(id);
  const fileListEl = $("file-list");
  const emptyStateEl = $("empty-state");
  const connStatusEl = $("conn-status");

  function toast(msg, type) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast " + (type || "");
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.add("hidden"), 4000);
  }

  function humanSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return bytes + " Б";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
    return (bytes / 1024 / 1024).toFixed(2) + " МБ";
  }

  function api(path, opts) {
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch("https://api.github.com" + path, Object.assign({ headers }, opts));
  }

  async function apiJson(path, opts) {
    const res = await api(path, opts);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub: ${res.status} ${res.statusText}${body ? " — " + body.slice(0, 200) : ""}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function encodeB64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function decodeB64(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  // Список файлов из папки (включая вложенные) одним запросом через git tree
  async function listFiles() {
    const res = await fetch(
      `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/git/trees/${CONFIG.branch}?recursive=1`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) {
      if (res.status === 404) throw new Error("Репозиторий или ветка не найдены");
      if (res.status === 403) throw new Error("Лимит GitHub API. Подождите немного");
      throw new Error(`GitHub: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const folder = CONFIG.folder.replace(/^\/+|\/+$/g, "");
    return (data.tree || [])
      .filter((e) => e.type === "blob" && (!folder || e.path === folder || e.path.startsWith(folder + "/")))
      .map((e) => ({ name: e.path, size: e.size }));
  }

  // Описания конфигов хранятся в configs.json в корне репозитория
  async function loadMeta() {
    try {
      const d = await apiJson(`/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${META_FILE}?ref=${CONFIG.branch}`);
      return JSON.parse(decodeB64(d.content.replace(/\n/g, "")));
    } catch (e) {
      return {};
    }
  }

  async function saveMeta(meta) {
    const payload = { message: "Update metadata", content: encodeB64(JSON.stringify(meta, null, 2)), branch: CONFIG.branch };
    const d = await apiJson(`/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${META_FILE}?ref=${CONFIG.branch}`).catch(() => null);
    if (d && d.sha) payload.sha = d.sha;
    await apiJson(`/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${META_FILE}`, { method: "PUT", body: JSON.stringify(payload) });
  }

  async function getFileSha(name) {
    try {
      const d = await apiJson(`/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${encodeURIComponent(name)}?ref=${CONFIG.branch}`);
      return d.sha;
    } catch (e) {
      return null;
    }
  }

  function renderList(files, meta) {
    fileListEl.innerHTML = "";
    $("file-count").textContent = files.length + " файлов";
    if (!files.length) {
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.textContent = "В папке пока нет файлов. Добавьте первый конфиг!";
      return;
    }
    emptyStateEl.classList.add("hidden");

    const metaFiles = (meta && meta.files) || {};
    const raw = `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/`;

    const sorted = files.slice().sort((a, b) => {
      const ad = metaFiles[a.name] && metaFiles[a.name].date ? metaFiles[a.name].date : 0;
      const bd = metaFiles[b.name] && metaFiles[b.name].date ? metaFiles[b.name].date : 0;
      return String(bd).localeCompare(String(ad));
    });

    for (const f of sorted) {
      const name = f.name.includes("/") ? f.name.slice(f.name.lastIndexOf("/") + 1) : f.name;
      const m = metaFiles[f.name] || {};
      const card = document.createElement("div");
      card.className = "file-card";
      card.innerHTML = `
        <div class="file-icon">📄</div>
        <div class="file-meta">
          <div class="file-name"></div>
          ${m.desc ? `<div class="file-desc"></div>` : ""}
          <div class="file-info"></div>
        </div>
        <div class="file-actions">
          <a class="btn small ghost" target="_blank" rel="noopener">Скачать</a>
          <button class="btn small ghost copy-link" title="Скопировать ссылку">Ссылка</button>
        </div>`;
      card.querySelector(".file-name").textContent = name;
      if (m.desc) card.querySelector(".file-desc").textContent = m.desc;
      const size = f.size != null ? humanSize(f.size) : (m.size ? humanSize(m.size) : "");
      const date = m.date ? new Date(m.date).toLocaleString("ru-RU") : "";
      card.querySelector(".file-info").textContent = [size, date].filter(Boolean).join(" · ");
      const url = raw + f.name.split("/").map(encodeURIComponent).join("/");
      card.querySelector("a").href = url;
      card.querySelector(".copy-link").addEventListener("click", () => {
        navigator.clipboard.writeText(url)
          .then(() => toast("Ссылка скопирована", "ok"))
          .catch(() => toast("Не удалось скопировать", "err"));
      });
      fileListEl.appendChild(card);
    }
  }

  async function refresh() {
    connStatusEl.textContent = "Обновление...";
    connStatusEl.className = "conn-status";
    try {
      const [files, meta] = await Promise.all([listFiles(), loadMeta()]);
      connStatusEl.textContent = "Подключено";
      connStatusEl.className = "conn-status ok";
      renderList(files, meta);
    } catch (e) {
      connStatusEl.textContent = "Ошибка";
      connStatusEl.className = "conn-status err";
      fileListEl.innerHTML = "";
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.textContent = "Ошибка загрузки: " + e.message;
      toast("Не удалось загрузить список", "err");
    }
  }

  function base64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result.split(",")[1]);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  async function uploadFiles(files, desc) {
    if (!token) { toast("Токен не настроен — нажмите «🔑 Токен»", "err"); return; }
    let ok = 0;
    const box = $("upload-progress");
    box.classList.remove("hidden");
    box.innerHTML = `<div>Загрузка 0/${files.length}...</div><div class="bar"><div></div></div>`;
    const bar = box.querySelector(".bar > div");
    const update = (done) => {
      bar.style.width = Math.round((done / files.length) * 100) + "%";
      if (done === files.length) setTimeout(() => box.classList.add("hidden"), 800);
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.replace(/[^\w.\-а-яёА-ЯЁ ]/gu, "_").trim();
      const ext = name.split(".").pop().toLowerCase();
      if (ext !== "cfg") {
        toast(`"${file.name}" — не .cfg файл, пропущен`, "err");
        update(i + 1);
        continue;
      }
      try {
        const content = await base64(file);
        const path = CONFIG.folder + "/" + name;
        const payload = {
          message: desc ? `Add ${name} (${desc})` : `Add ${name}`,
          content,
          branch: CONFIG.branch
        };
        const sha = await getFileSha(path);
        if (sha) payload.sha = sha;
        await apiJson(`/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${encodeURIComponent(path)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        const meta = await loadMeta();
        meta.files = meta.files || {};
        meta.files[path] = { desc: desc || "", date: new Date().toISOString(), size: file.size };
        await saveMeta(meta);
        ok++;
      } catch (e) {
        toast(`Ошибка: ${name} — ${e.message}`, "err");
      }
      update(i + 1);
    }
    if (ok) toast(`Загружено: ${ok}`, "ok");
    refresh();
  }

  $("btn-upload").addEventListener("click", () => {
    const files = $("file-input").files;
    if (!files.length) { toast("Выберите файл", "err"); return; }
    const desc = $("upload-desc").value.trim();
    $("file-input").value = "";
    $("upload-desc").value = "";
    uploadFiles(Array.from(files), desc);
  });

  $("btn-token").addEventListener("click", () => {
    $("set-token").value = token || "";
    $("token-modal").classList.remove("hidden");
  });
  $("btn-token-cancel").addEventListener("click", () => $("token-modal").classList.add("hidden"));
  $("btn-token-save").addEventListener("click", () => {
    token = $("set-token").value.trim();
    if (token) localStorage.setItem(TOKEN_LS_KEY, token);
    else localStorage.removeItem(TOKEN_LS_KEY);
    $("token-modal").classList.add("hidden");
    toast("Токен сохранён", "ok");
  });

  $("btn-refresh").addEventListener("click", refresh);

  refresh();
})();