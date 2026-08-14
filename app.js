(() => {
  "use strict";

  // === НАСТРОЙКИ (прописать один раз) ===
  const CONFIG = {
    owner: "XANNYX1337",
    repo: "configs",
    branch: "main",
    folder: "configs"
  };

  const $ = (id) => document.getElementById(id);
  const fileListEl = $("file-list");
  const emptyStateEl = $("empty-state");
  const connStatusEl = $("conn-status");
  const searchInput = $("search-input");
  const countEl = $("file-count");

  let filesCache = [];

  const ICONS = {
    cfg: "⚙️",
    lua: "📜",
    json: "🧩",
    txt: "📄",
    md: "📝",
    zip: "🗜️",
    rar: "🗜️"
  };

  function iconFor(name) {
    const ext = name.split(".").pop().toLowerCase();
    return ICONS[ext] || "📂";
  }

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
      .map((e) => ({ name: e.path, size: e.size }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }

  function renderList(files) {
    fileListEl.innerHTML = "";
    if (!files.length) {
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.textContent = searchInput.value
        ? "Ничего не найдено по запросу «" + searchInput.value + "»"
        : "В папке пока нет файлов.";
      return;
    }
    emptyStateEl.classList.add("hidden");

    const raw = `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/`;
    const frag = document.createDocumentFragment();

    for (const f of files) {
      const name = f.name.includes("/") ? f.name.slice(f.name.lastIndexOf("/") + 1) : f.name;
      const folder = f.name.includes("/") ? f.name.slice(0, f.name.lastIndexOf("/")) + "/" : "";
      const row = document.createElement("div");
      row.className = "thread-row";
      row.innerHTML = `
        <div class="thread-icon"></div>
        <div class="thread-main">
          <div class="thread-title"><a class="dl-link" href="#" target="_blank" rel="noopener"></a></div>
          <div class="thread-meta"></div>
        </div>
        <div class="thread-actions">
          <a class="button" href="#" target="_blank" rel="noopener">Скачать</a>
          <button class="button copy-link" title="Скопировать ссылку">Ссылка</button>
        </div>`;
      row.querySelector(".thread-icon").textContent = iconFor(f.name);
      const url = raw + f.name.split("/").map(encodeURIComponent).join("/");
      row.querySelector(".dl-link").textContent = name;
      row.querySelector(".dl-link").href = url;
      row.querySelector("a.button").href = url;
      row.querySelector(".thread-meta").textContent = [folder, humanSize(f.size)].filter(Boolean).join(" · ");
      row.querySelector(".copy-link").addEventListener("click", () => {
        navigator.clipboard.writeText(url)
          .then(() => toast("Ссылка скопирована", "ok"))
          .catch(() => toast("Не удалось скопировать", "err"));
      });
      frag.appendChild(row);
    }
    fileListEl.appendChild(frag);
  }

  function applyFilter() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q
      ? filesCache.filter((f) => f.name.toLowerCase().includes(q))
      : filesCache;
    countEl.textContent = filtered.length + " файлов";
    renderList(filtered);
  }

  async function refresh() {
    connStatusEl.textContent = "Загрузка…";
    connStatusEl.className = "conn-status";
    try {
      filesCache = await listFiles();
      connStatusEl.textContent = "Онлайн · " + filesCache.length + " cfg";
      connStatusEl.className = "conn-status ok";
      applyFilter();
    } catch (e) {
      connStatusEl.textContent = "Ошибка: " + e.message;
      connStatusEl.className = "conn-status err";
      fileListEl.innerHTML = "";
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.textContent = "Ошибка загрузки";
      toast("Не удалось загрузить список", "err");
    }
  }

  $("btn-refresh").addEventListener("click", refresh);
  searchInput.addEventListener("input", applyFilter);

  refresh();
})();