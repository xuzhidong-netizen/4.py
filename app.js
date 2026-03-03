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
const githubOwnerInput = document.querySelector("#github-owner");
const githubRepoInput = document.querySelector("#github-repo");
const githubBranchInput = document.querySelector("#github-branch");
const githubFolderInput = document.querySelector("#github-folder");
const githubTokenInput = document.querySelector("#github-token");
const toolButtons = document.querySelectorAll(".tool-btn");
const fontFamily = document.querySelector("#font-family");
const fontSize = document.querySelector("#font-size");

const STORAGE_KEY = "ienter-docs-github-config";
const DEFAULT_CONFIG = {
  owner: "xuzhidong-netizen",
  repo: "4.py",
  branch: "main",
  folder: "documents",
  token: "",
};

let saveTimer = null;
let activeDocument = {
  path: null,
  sha: null,
  slug: "2026-market-plan",
};
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

function setSaveState(text, status = "") {
  window.clearTimeout(saveTimer);
  saveState.textContent = text;
  saveState.classList.remove("saving");
  if (status === "saving") {
    saveState.classList.add("saving");
  }
}

function markSaving() {
  setSaveState("保存中...", "saving");
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
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function persistConfig(config) {
  currentConfig = { ...DEFAULT_CONFIG, ...config };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
}

function getApiUrl(path) {
  return `https://api.github.com/repos/${currentConfig.owner}/${currentConfig.repo}/contents/${path}`;
}

function getHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${currentConfig.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function githubRequest(path, options = {}) {
  if (!currentConfig.token) {
    throw new Error("missing_token");
  }

  const url = new URL(getApiUrl(path));
  url.searchParams.set("ref", currentConfig.branch);

  const response = await fetch(url, {
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

  return response.json();
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function formatTimestamp(date) {
  return new Date(date).toLocaleString("zh-CN");
}

function buildDocumentPayload({ title, content, updatedAt }) {
  return JSON.stringify(
    {
      title,
      content,
      updatedAt,
    },
    null,
    2
  );
}

function parseDocumentFile(file, rawContent) {
  const parsed = JSON.parse(rawContent);
  const slug = file.name.replace(/\.json$/i, "");
  return {
    title: parsed.title || slug,
    content: parsed.content || "",
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    path: file.path,
    sha: file.sha,
    slug,
  };
}

function updateDocumentButton(button, record) {
  button.dataset.title = record.title;
  button.dataset.path = record.path;
  button.dataset.sha = record.sha || "";
  button.dataset.slug = record.slug;
  button.querySelector("strong").textContent = record.title;
  button.querySelector("small").textContent = formatTimestamp(record.updatedAt);
}

function activateButton(target) {
  docButtons.forEach((button) => button.classList.remove("active"));
  target.classList.add("active");
}

function createDocumentButton(record) {
  const button = document.createElement("button");
  button.className = "doc-item";
  button.innerHTML = "<strong></strong><small></small>";
  updateDocumentButton(button, record);
  button.addEventListener("click", () => handleDocumentSelection(button));
  return button;
}

function setEditorContent(record) {
  activeDocument = {
    path: record.path,
    sha: record.sha,
    slug: record.slug,
  };
  docTitle.value = record.title;
  editor.innerHTML = record.content;
}

async function listDocumentFiles() {
  try {
    const entries = await githubRequest(currentConfig.folder);
    return Array.isArray(entries)
      ? entries.filter((entry) => entry.type === "file" && entry.name.endsWith(".json"))
      : [];
  } catch (error) {
    if (String(error.message).includes("404")) {
      return [];
    }
    throw error;
  }
}

async function readDocumentFile(file) {
  const data = await githubRequest(file.path);
  return parseDocumentFile(data, decodeBase64Utf8(data.content));
}

async function fetchDocuments() {
  const files = await listDocumentFiles();
  const records = await Promise.all(files.map((file) => readDocumentFile(file)));
  records.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const list = document.querySelector("#doc-list");
  list.innerHTML = "";

  let workingRecords = records;
  if (!workingRecords.length) {
    const created = await createRemoteDocument("2026 市场合作方案", editor.innerHTML);
    workingRecords = [created];
  }

  workingRecords.forEach((record, index) => {
    const button = createDocumentButton(record);
    list.appendChild(button);
    if (index === 0) {
      activateButton(button);
      setEditorContent(record);
    }
  });

  docButtons = [...list.querySelectorAll(".doc-item")];
}

async function upsertDocumentFile(path, content, sha) {
  const body = {
    message: `${sha ? "Update" : "Create"} ${path}`,
    content: encodeBase64Utf8(content),
    branch: currentConfig.branch,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(getApiUrl(path), {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

async function createRemoteDocument(title, content) {
  const updatedAt = new Date().toISOString();
  const slug = slugify(title) || `doc-${Date.now()}`;
  const path = `${currentConfig.folder}/${slug}.json`;
  const payload = buildDocumentPayload({ title, content, updatedAt });
  const result = await upsertDocumentFile(path, payload);

  return {
    title,
    content,
    updatedAt,
    path: result.content.path,
    sha: result.content.sha,
    slug,
  };
}

async function saveDocument() {
  if (!currentConfig.token) {
    setSaveState("未连接");
    return;
  }

  markSaving();

  const title = docTitle.value.trim() || "未命名文档";
  const updatedAt = new Date().toISOString();
  const slug = activeDocument.slug || slugify(title) || `doc-${Date.now()}`;
  const path = activeDocument.path || `${currentConfig.folder}/${slug}.json`;
  const payload = buildDocumentPayload({
    title,
    content: editor.innerHTML,
    updatedAt,
  });

  try {
    const result = await upsertDocumentFile(path, payload, activeDocument.sha);
    const record = {
      title,
      content: editor.innerHTML,
      updatedAt,
      path: result.content.path,
      sha: result.content.sha,
      slug,
    };

    activeDocument = {
      path: record.path,
      sha: record.sha,
      slug: record.slug,
    };

    let activeButton =
      document.querySelector(`.doc-item[data-path="${record.path}"]`) ||
      document.querySelector(".doc-item.active");

    if (!activeButton) {
      activeButton = createDocumentButton(record);
      const list = document.querySelector("#doc-list");
      list.prepend(activeButton);
      docButtons = [...list.querySelectorAll(".doc-item")];
    }

    updateDocumentButton(activeButton, record);
    activateButton(activeButton);
    showConnectionState("GitHub 已连接", "connected");
    setSaveState("已保存");
  } catch (error) {
    console.error(error);
    setSaveState("保存失败");
    showConnectionState("连接异常", "error");
    showToast("保存失败，请检查 token 权限或仓库配置");
  }
}

function scheduleSave() {
  markSaving();
  window.clearTimeout(scheduleSave.timer);
  scheduleSave.timer = window.setTimeout(saveDocument, 800);
}

async function handleDocumentSelection(button) {
  activateButton(button);

  if (!currentConfig.token || !button.dataset.path) {
    docTitle.value = button.dataset.title;
    activeDocument = {
      path: button.dataset.path || null,
      sha: button.dataset.sha || null,
      slug: button.dataset.slug || slugify(button.dataset.title),
    };
    showToast(`已切换到《${button.dataset.title}》`);
    return;
  }

  try {
    const data = await githubRequest(button.dataset.path);
    const record = parseDocumentFile(data, decodeBase64Utf8(data.content));
    setEditorContent(record);
    updateDocumentButton(button, record);
    showToast(`已切换到《${record.title}》`);
  } catch (error) {
    console.error(error);
    showToast("读取文档失败，请检查仓库连接");
  }
}

editor.addEventListener("input", scheduleSave);
docTitle.addEventListener("input", () => {
  if (!activeDocument.path) {
    activeDocument.slug = slugify(docTitle.value) || activeDocument.slug;
  }
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
    "<h1>未命名文档</h1><p>在这里开始记录新的文档内容。保存后会写入 GitHub 仓库文件。</p>";
  docButtons.forEach((doc) => doc.classList.remove("active"));
  activeDocument = {
    path: null,
    sha: null,
    slug: `doc-${Date.now()}`,
  };
  setSaveState(currentConfig.token ? "待保存" : "未连接");
  showToast("已创建新的空白文档");
});

connectButton.addEventListener("click", () => {
  githubOwnerInput.value = currentConfig.owner;
  githubRepoInput.value = currentConfig.repo;
  githubBranchInput.value = currentConfig.branch;
  githubFolderInput.value = currentConfig.folder;
  githubTokenInput.value = currentConfig.token;
  configDialog.showModal();
});

closeConfigButton.addEventListener("click", () => {
  configDialog.close();
});

configForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  persistConfig({
    owner: githubOwnerInput.value.trim(),
    repo: githubRepoInput.value.trim(),
    branch: githubBranchInput.value.trim() || "main",
    folder: githubFolderInput.value.trim() || "documents",
    token: githubTokenInput.value.trim(),
  });

  showConnectionState("连接中...", "");

  try {
    await fetchDocuments();
    showConnectionState("GitHub 已连接", "connected");
    setSaveState("已保存");
    showToast("仓库连接成功，文档会写入 GitHub 文件");
    configDialog.close();
  } catch (error) {
    console.error(error);
    showConnectionState("连接异常", "error");
    setSaveState("连接失败");
    showToast("连接失败，请检查 token、仓库名或分支名");
  }
});

async function boot() {
  if (!currentConfig.token) {
    showConnectionState("未连接 GitHub", "");
    setSaveState("未连接");
    return;
  }

  showConnectionState("连接中...", "");

  try {
    await fetchDocuments();
    showConnectionState("GitHub 已连接", "connected");
    setSaveState("已保存");
  } catch (error) {
    console.error(error);
    showConnectionState("连接异常", "error");
    setSaveState("连接失败");
  }
}

boot();
