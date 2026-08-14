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
      .map((e) => ({ name: e.path, size: e.size }));
  }

  function renderList(files) {
    fileListEl.innerHTML = "";
    $("file-count").textContent = files.length + " файлов";
    if (!files.length) {
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.textContent = "В папке пока нет файлов. Конфиги появятся здесь после добавления в репозиторий.";
      return;
    }
    emptyStateEl.classList.add("hidden");

    const raw = `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/`;
    for (const f of files) {
      const name = f.name.includes("/") ? f.name.slice(f.name.lastIndexOf("/") + 1) : f.name;
      const card = document.createElement("div");
      card.className = "file-card";
      card.innerHTML = `
        <div class="file-icon">📄</div>
        <div class="file-meta">
          <div class="file-name"></div>
          <div class="file-info"></div>
        </div>
        <div class="file-actions">
          <a class="btn small ghost" target="_blank" rel="noopener">Скачать</a>
          <button class="btn small ghost copy-link" title="Скопировать ссылку">Ссылка</button>
        </div>`;
      card.querySelector(".file-name").textContent = name;
      card.querySelector(".file-info").textContent = humanSize(f.size);
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
      const files = await listFiles();
      connStatusEl.textContent = "Подключено";
      connStatusEl.className = "conn-status ok";
      renderList(files);
    } catch (e) {
      connStatusEl.textContent = "Ошибка";
      connStatusEl.className = "conn-status err";
      fileListEl.innerHTML = "";
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.textContent = "Ошибка загрузки: " + e.message;
      toast("Не удалось загрузить список", "err");
    }
  }

  $("btn-refresh").addEventListener("click", refresh);

  refresh();
})();