(() => {
  "use strict";

  const LS_KEY = "cfg-workshop-settings";

  // Значения по умолчанию — можно прописать сразу здесь
  const CONFIG = {
    owner: "XANNYX1337",
    repo: "configs",
    branch: "main",
    folder: "configs"
  };

  let settings = loadSettings();

  const $ = (id) => document.getElementById(id);
  const fileListEl = $("file-list");
  const emptyStateEl = $("empty-state");
  const connStatusEl = $("conn-status");

  function loadSettings() {
    try {
      return Object.assign({}, CONFIG, JSON.parse(localStorage.getItem(LS_KEY) || "{}"));
    } catch (e) {
      return Object.assign({}, CONFIG);
    }
  }

  function saveSettings() {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
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

  // Через git tree получаем весь список файлов одной папки (включая вложенные) за один запрос
  async function listFiles() {
    const res = await fetch(
      `https://api.github.com/repos/${settings.owner}/${settings.repo}/git/trees/${settings.branch}?recursive=1`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) {
      if (res.status === 404) throw new Error("Репозиторий или ветка не найдены");
      if (res.status === 403) throw new Error("Лимит GitHub API (60 запросов/час). Подождите немного");
      throw new Error(`GitHub: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const folder = settings.folder.replace(/^\/+|\/+$/g, "");
    const files = (data.tree || []).filter((e) => {
      if (e.type !== "blob") return false;
      const p = e.path;
      if (!folder) return true;
      return p === folder || p.startsWith(folder + "/");
    });
    return files.map((e) => ({
      name: e.path,
      size: e.size
    }));
  }

  function renderList(files) {
    fileListEl.innerHTML = "";
    $("file-count").textContent = files.length + " файлов";
    if (!files.length) {
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.textContent = "В папке пока нет файлов. Закиньте конфиги в репозиторий и обновите список.";
      return;
    }
    emptyStateEl.classList.add("hidden");

    const raw = `https://raw.githubusercontent.com/${settings.owner}/${settings.repo}/${settings.branch}/`;
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
    if (!settings.owner || !settings.repo) {
      connStatusEl.textContent = "Не настроено";
      connStatusEl.className = "conn-status err";
      return;
    }
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

  // Настройки
  $("btn-settings").addEventListener("click", () => {
    $("set-owner").value = settings.owner;
    $("set-repo").value = settings.repo;
    $("set-branch").value = settings.branch;
    $("set-folder").value = settings.folder;
    $("settings-modal").classList.remove("hidden");
  });
  $("btn-cancel").addEventListener("click", () => $("settings-modal").classList.add("hidden"));
  $("btn-save").addEventListener("click", () => {
    settings = {
      owner: $("set-owner").value.trim(),
      repo: $("set-repo").value.trim(),
      branch: $("set-branch").value.trim() || "main",
      folder: $("set-folder").value.trim() || "configs"
    };
    saveSettings();
    $("settings-modal").classList.add("hidden");
    refresh();
  });

  $("btn-refresh").addEventListener("click", refresh);

  refresh();
})();