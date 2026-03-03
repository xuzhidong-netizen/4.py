const editor = document.querySelector("#editor");
const saveState = document.querySelector("#save-state");
const docTitle = document.querySelector("#doc-title");
const docItems = document.querySelectorAll(".doc-item");
const docSearch = document.querySelector("#doc-search");
const toast = document.querySelector("#toast");
const shareButton = document.querySelector("#share-btn");
const exportButton = document.querySelector("#export-btn");
const newDocButton = document.querySelector("#new-doc");
const connectButton = document.querySelector("#connect-btn");
const connectionState = document.querySelector("#connection-state");
const configDialog = document.querySelector("#config-dialog");
const configForm = document.querySelector("#config-form");
const closeConfigButton = document.querySelector("#close-config");
const supabaseUrlInput = document.querySelector("#supabase-url");
const supabaseKeyInput = document.querySelector("#supabase-key");
const toolButtons = document.querySelectorAll(".tool-btn");
const fontFamily = document.querySelector("#font-family");
const fontSize = document.querySelector("#font-size");

const STORAGE_KEY = "ienter-docs-supabase-config";
let saveTimer = null;
let activeDocumentId = null;
let activeDocumentSlug = "2026-market-plan";
let currentConfig = loadConfig();
let docButtons = [...docItems];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function markSaving() {
  saveState.textContent = "保存中...";
  saveState.classList.add("saving");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveState.textContent = "已保存";
    saveState.classList.remove("saving");
  }, 900);
}

function setSaveError(message) {
  window.clearTimeout(saveTimer);
  saveState.textContent = message;
  saveState.classList.remove("saving");
}

function showConnectionState(text, status) {
  connectionState.textContent = text;
  connectionState.classList.remove("connected", "error");
  if (status) {
    connectionState.classList.add(status);
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistConfig(config) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  currentConfig = config;
}

function getHeaders() {
  return {
    apikey: currentConfig.key,
    Authorization: `Bearer ${currentConfig.key}`,
    "Content-Type": "application/json",
  };
}

async function supabaseRequest(path, options = {}) {
  if (!currentConfig?.url || !currentConfig?.key) {
    throw new Error("missing_config");
  }

  const response = await fetch(`${currentConfig.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

function updateDocumentButton(button, title) {
  button.dataset.title = title;
  const titleNode = button.querySelector("strong");
  if (titleNode) {
    titleNode.textContent = title;
  }
}

function activateButton(target) {
  docButtons.forEach((button) => button.classList.remove("active"));
  target.classList.add("active");
}

function createDocumentButton(record) {
  const button = document.createElement("button");
  button.className = "doc-item";
  button.dataset.title = record.title;
  button.dataset.id = record.id;
  button.dataset.slug = record.slug;
  button.innerHTML = `
    <strong>${record.title}</strong>
    <small>${new Date(record.updated_at).toLocaleString("zh-CN")}</small>
  `;
  button.addEventListener("click", () => handleDocumentSelection(button));
  return button;
}

function setEditorContent(record) {
  activeDocumentId = record.id;
  activeDocumentSlug = record.slug;
  docTitle.value = record.title;
  editor.innerHTML = record.content;
}

async function fetchDocuments() {
  const records = await supabaseRequest(
    "documents?select=id,slug,title,content,updated_at&order=updated_at.desc"
  );

  const list = document.querySelector("#doc-list");
  list.innerHTML = "";

  if (!records.length) {
    const created = await createRemoteDocument("2026 市场合作方案", editor.innerHTML);
    records.push(created);
  }

  records.forEach((record, index) => {
    const button = createDocumentButton(record);
    list.appendChild(button);
    if (index === 0) {
      activateButton(button);
      setEditorContent(record);
    }
  });

  docButtons = [...list.querySelectorAll(".doc-item")];
}

async function createRemoteDocument(title, content) {
  const slug = slugify(title) || `doc-${Date.now()}`;
  const body = {
    slug,
    title,
    content,
  };

  const created = await supabaseRequest("documents", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  return created[0];
}

async function saveDocument() {
  if (!currentConfig) {
    setSaveError("未连接");
    return;
  }

  markSaving();

  const title = docTitle.value.trim() || "未命名文档";
  const payload = {
    slug: activeDocumentSlug || slugify(title) || `doc-${Date.now()}`,
    title,
    content: editor.innerHTML,
    updated_at: new Date().toISOString(),
  };

  try {
    let record;

    if (activeDocumentId) {
      const updated = await supabaseRequest(`documents?id=eq.${activeDocumentId}`, {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });
      record = updated[0];
    } else {
      record = await createRemoteDocument(payload.title, payload.content);
    }

    activeDocumentId = record.id;
    activeDocumentSlug = record.slug;

    let activeButton =
      document.querySelector(`.doc-item[data-id="${activeDocumentId}"]`) ||
      document.querySelector(".doc-item.active");

    if (!activeButton) {
      activeButton = createDocumentButton(record);
      const list = document.querySelector("#doc-list");
      list.prepend(activeButton);
      docButtons = [...list.querySelectorAll(".doc-item")];
    }

    if (activeButton) {
      activateButton(activeButton);
      updateDocumentButton(activeButton, record.title);
      activeButton.dataset.id = record.id;
      activeButton.dataset.slug = record.slug;
      const meta = activeButton.querySelector("small");
      if (meta) {
        meta.textContent = new Date(record.updated_at).toLocaleString("zh-CN");
      }
    }

    showConnectionState("Supabase 已连接", "connected");
    markSaving();
  } catch (error) {
    console.error(error);
    setSaveError("保存失败");
    showConnectionState("连接异常", "error");
    showToast("保存失败，请检查 Supabase 配置、表结构或 RLS 策略");
  }
}

function scheduleSave() {
  markSaving();
  window.clearTimeout(scheduleSave.timer);
  scheduleSave.timer = window.setTimeout(saveDocument, 800);
}

async function handleDocumentSelection(button) {
  activateButton(button);

  if (!currentConfig || !button.dataset.id) {
    docTitle.value = button.dataset.title;
    activeDocumentId = button.dataset.id || null;
    activeDocumentSlug = button.dataset.slug || slugify(button.dataset.title);
    showToast(`已切换到《${button.dataset.title}》`);
    return;
  }

  try {
    const records = await supabaseRequest(
      `documents?id=eq.${button.dataset.id}&select=id,slug,title,content,updated_at`
    );
    if (records[0]) {
      setEditorContent(records[0]);
    }
    showToast(`已切换到《${button.dataset.title}》`);
  } catch (error) {
    console.error(error);
    showToast("读取文档失败，请检查数据库连接");
  }
}

editor.addEventListener("input", scheduleSave);
docTitle.addEventListener("input", () => {
  activeDocumentSlug = slugify(docTitle.value) || activeDocumentSlug;
  scheduleSave();
});

docButtons.forEach((item) => {
  item.addEventListener("click", () => handleDocumentSelection(item));
});

docSearch.addEventListener("input", (event) => {
  const keyword = event.target.value.trim().toLowerCase();

  docButtons.forEach((item) => {
    const matched = !keyword || item.textContent.toLowerCase().includes(keyword);
    item.classList.toggle("match", keyword && matched);
    item.style.display = matched ? "flex" : "none";
  });
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const command = button.dataset.command;
    document.execCommand(command, false);

    if (["bold", "italic", "underline"].includes(command)) {
      button.classList.toggle("active");
    }

    editor.focus();
    scheduleSave();
  });
});

fontFamily.addEventListener("change", (event) => {
  document.execCommand("fontName", false, event.target.value);
  editor.focus();
  scheduleSave();
});

fontSize.addEventListener("change", (event) => {
  editor.style.fontSize = event.target.value;
  scheduleSave();
});

shareButton.addEventListener("click", () => {
  showToast("分享链接已复制到剪贴板的模拟流程已触发");
});

exportButton.addEventListener("click", () => {
  showToast("已触发导出为 Word/PDF 的模拟流程");
});

newDocButton.addEventListener("click", () => {
  docTitle.value = "未命名文档";
  editor.innerHTML =
    "<h1>未命名文档</h1><p>在这里开始记录新的文档内容。工具栏、自动保存与协作动态会随编辑同步更新。</p>";
  docButtons.forEach((doc) => doc.classList.remove("active"));
  activeDocumentId = null;
  activeDocumentSlug = `doc-${Date.now()}`;
  scheduleSave();
  showToast("已创建新的空白文档");
});

connectButton.addEventListener("click", () => {
  supabaseUrlInput.value = currentConfig?.url || "";
  supabaseKeyInput.value = currentConfig?.key || "";
  configDialog.showModal();
});

closeConfigButton.addEventListener("click", () => {
  configDialog.close();
});

configForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const config = {
    url: supabaseUrlInput.value.trim().replace(/\/$/, ""),
    key: supabaseKeyInput.value.trim(),
  };

  persistConfig(config);
  showConnectionState("连接中...", "");

  try {
    await fetchDocuments();
    showConnectionState("Supabase 已连接", "connected");
    showToast("数据库连接成功，文档将真实保存");
    configDialog.close();
  } catch (error) {
    console.error(error);
    showConnectionState("连接异常", "error");
    showToast("连接失败，请确认 documents 表和 RLS 策略已配置");
  }
});

async function boot() {
  if (!currentConfig) {
    showConnectionState("未连接 Supabase", "");
    setSaveError("未连接");
    return;
  }

  showConnectionState("连接中...", "");

  try {
    await fetchDocuments();
    showConnectionState("Supabase 已连接", "connected");
    setSaveError("已保存");
  } catch (error) {
    console.error(error);
    showConnectionState("连接异常", "error");
    setSaveError("连接失败");
  }
}

boot();
