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
const clearTokenButton = document.querySelector("#clear-token");
const guideDialog = document.querySelector("#guide-dialog");
const dismissGuideButton = document.querySelector("#dismiss-guide");
const guideConnectButton = document.querySelector("#guide-connect");
const githubOwnerInput = document.querySelector("#github-owner");
const githubRepoInput = document.querySelector("#github-repo");
const githubBranchInput = document.querySelector("#github-branch");
const githubFolderInput = document.querySelector("#github-folder");
const githubTokenInput = document.querySelector("#github-token");
const docStats = document.querySelector("#doc-stats");
const saveTime = document.querySelector("#save-time");
const sessionSummary = document.querySelector("#session-summary");
const docEmpty = document.querySelector("#doc-empty");
const toolButtons = document.querySelectorAll(".tool-btn");
const fontFamily = document.querySelector("#font-family");
const fontSize = document.querySelector("#font-size");

const STORAGE_KEY = "ienter-docs-github-config";
const GUIDE_KEY = "ienter-docs-guide-dismissed";
const DRAFT_PREFIX = "ienter-docs-draft";
const SHARE_BASE_URL = "https://xuzhidong-netizen.github.io/4.py/";
const DEFAULT_CONFIG = {
  owner: "xuzhidong-netizen",
  repo: "4.py",
  branch: "main",
  folder: "documents",
  token: "",
};

let saveTimer = null;
let dirty = false;
let activeDocument = {
  path: null,
  sha: null,
  slug: "2026-market-plan",
};
let currentConfig = loadConfig();
let docButtons = [...docItems];
const sharedParams = readSharedParams();

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
  updateSessionSummary();
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

function getDraftKey(slug = activeDocument.slug || "draft") {
  return `${DRAFT_PREFIX}:${currentConfig.owner}:${currentConfig.repo}:${currentConfig.branch}:${currentConfig.folder}:${slug}`;
}

function saveDraft() {
  const slug = activeDocument.slug || slugify(docTitle.value) || "draft";
  const draft = {
    title: docTitle.value.trim() || "未命名文档",
    content: editor.innerHTML,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(getDraftKey(slug), JSON.stringify(draft));
}

function loadDraft(slug = activeDocument.slug || sharedParams.doc || "draft") {
  try {
    const raw = window.localStorage.getItem(getDraftKey(slug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft(slug = activeDocument.slug || "draft") {
  window.localStorage.removeItem(getDraftKey(slug));
}

function clearStoredToken() {
  currentConfig = { ...currentConfig, token: "" };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
}

function readSharedParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    owner: params.get("owner") || "",
    repo: params.get("repo") || "",
    branch: params.get("branch") || "",
    folder: params.get("folder") || "",
    doc: params.get("doc") || "",
  };
}

function applySharedParams() {
  const nextConfig = { ...currentConfig };

  if (sharedParams.owner) {
    nextConfig.owner = sharedParams.owner;
  }
  if (sharedParams.repo) {
    nextConfig.repo = sharedParams.repo;
  }
  if (sharedParams.branch) {
    nextConfig.branch = sharedParams.branch;
  }
  if (sharedParams.folder) {
    nextConfig.folder = sharedParams.folder;
  }

  currentConfig = nextConfig;
}

function shouldShowGuide() {
  return window.localStorage.getItem(GUIDE_KEY) !== "1";
}

function dismissGuide() {
  window.localStorage.setItem(GUIDE_KEY, "1");
  guideDialog.close();
}

function updateSaveTime(value) {
  saveTime.textContent = value ? `最近保存 ${formatTimestamp(value)}` : "尚未保存";
}

function updateStats() {
  const text = editor.innerText.replace(/\s+/g, "");
  const paragraphs = editor.querySelectorAll("p, h1, h2, li").length;
  docStats.textContent = `${text.length} 字 · ${paragraphs} 段`;
}

function updateSessionSummary() {
  if (!currentConfig.token) {
    sessionSummary.textContent = "当前未连接 GitHub。修改会先保存在本机草稿里，连接仓库后再写回云端。";
    return;
  }

  sessionSummary.textContent = `当前保存目标：${currentConfig.owner}/${currentConfig.repo} · ${currentConfig.branch}/${currentConfig.folder}`;
}

function updateUrlForDocument(slug = activeDocument.slug || "draft") {
  const url = new URL(window.location.href);
  url.searchParams.set("owner", currentConfig.owner);
  url.searchParams.set("repo", currentConfig.repo);
  url.searchParams.set("branch", currentConfig.branch);
  url.searchParams.set("folder", currentConfig.folder);
  url.searchParams.set("doc", slug);
  window.history.replaceState({}, "", url);
}

function restoreDraftIfNeeded(record) {
  const draft = loadDraft(record.slug);
  if (!draft) {
    return record;
  }

  if (new Date(draft.updatedAt) > new Date(record.updatedAt)) {
    return {
      ...record,
      title: draft.title,
      content: draft.content,
      updatedAt: draft.updatedAt,
    };
  }

  return record;
}

function getApiUrl(path) {
  return `https://api.github.com/repos/${currentConfig.owner}/${currentConfig.repo}/contents/${path}`;
}

function getHeaders(includeAuth = true) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  if (includeAuth && currentConfig.token) {
    headers.Authorization = `Bearer ${currentConfig.token}`;
  }

  return headers;
}

async function githubRequest(path, options = {}) {
  const method = options.method || "GET";
  const includeAuth = Boolean(currentConfig.token);

  if (method !== "GET" && !currentConfig.token) {
    throw new Error("missing_token");
  }

  const url = new URL(getApiUrl(path));
  url.searchParams.set("ref", currentConfig.branch);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(includeAuth),
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

function buildShareUrl() {
  const url = new URL(SHARE_BASE_URL);
  url.searchParams.set("owner", currentConfig.owner);
  url.searchParams.set("repo", currentConfig.repo);
  url.searchParams.set("branch", currentConfig.branch);
  url.searchParams.set("folder", currentConfig.folder);
  url.searchParams.set("doc", activeDocument.slug || "draft");
  return url.toString();
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
  const effectiveRecord = restoreDraftIfNeeded(record);
  activeDocument = {
    path: effectiveRecord.path,
    sha: effectiveRecord.sha,
    slug: effectiveRecord.slug,
  };
  docTitle.value = effectiveRecord.title;
  editor.innerHTML = effectiveRecord.content;
  updateStats();
  updateSaveTime(effectiveRecord.updatedAt);
  updateUrlForDocument(effectiveRecord.slug);
  dirty = false;
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
  if (!workingRecords.length && currentConfig.token) {
    const created = await createRemoteDocument("2026 市场合作方案", editor.innerHTML);
    workingRecords = [created];
  }

  if (!workingRecords.length) {
    docButtons = [];
    docEmpty.hidden = false;
    return;
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
  docEmpty.hidden = true;

  if (sharedParams.doc) {
    const requestedButton = docButtons.find((button) => button.dataset.slug === sharedParams.doc);
    if (requestedButton) {
      await handleDocumentSelection(requestedButton);
    }
  }
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
    saveDraft();
    setSaveState("未连接");
    updateSaveTime(new Date().toISOString());
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
    updateSaveTime(record.updatedAt);
    updateUrlForDocument(record.slug);
    clearDraft(record.slug);
    dirty = false;
  } catch (error) {
    console.error(error);
    saveDraft();
    setSaveState("保存失败");
    showConnectionState("连接异常", "error");
    updateSaveTime(new Date().toISOString());
    showToast("保存失败，已自动保存在本机草稿");
  }
}

function scheduleSave() {
  markSaving();
  dirty = true;
  saveDraft();
  window.clearTimeout(scheduleSave.timer);
  scheduleSave.timer = window.setTimeout(saveDocument, 800);
}

async function handleDocumentSelection(button) {
  activateButton(button);

  if (!button.dataset.path) {
    docTitle.value = button.dataset.title;
    activeDocument = {
      path: null,
      sha: null,
      slug: button.dataset.slug || slugify(button.dataset.title),
    };
    updateUrlForDocument(activeDocument.slug);
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

editor.addEventListener("input", () => {
  updateStats();
  scheduleSave();
});

docTitle.addEventListener("input", () => {
  if (!activeDocument.path) {
    activeDocument.slug = slugify(docTitle.value) || activeDocument.slug;
  }
  dirty = true;
  scheduleSave();
});

docButtons.forEach((item) => {
  item.addEventListener("click", () => handleDocumentSelection(item));
});

docSearch.addEventListener("input", (event) => {
  const keyword = event.target.value.trim().toLowerCase();
  let visibleCount = 0;

  docButtons.forEach((item) => {
    const matched = !keyword || item.textContent.toLowerCase().includes(keyword);
    item.classList.toggle("match", keyword && matched);
    item.style.display = matched ? "flex" : "none";
    if (matched) {
      visibleCount += 1;
    }
  });

  docEmpty.hidden = visibleCount !== 0;
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

shareButton.addEventListener("click", async () => {
  const url = buildShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    showToast("线上分享链接已复制，可直接发给别人");
  } catch {
    showToast(url);
  }
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
  updateStats();
  updateSaveTime("");
  updateUrlForDocument(activeDocument.slug);
  saveDraft();
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

clearTokenButton.addEventListener("click", () => {
  clearStoredToken();
  githubTokenInput.value = "";
  showConnectionState("未连接 GitHub", "");
  setSaveState("未连接");
  showToast("已清除本地 token");
});

closeConfigButton.addEventListener("click", () => {
  configDialog.close();
});

dismissGuideButton.addEventListener("click", () => {
  dismissGuide();
});

guideConnectButton.addEventListener("click", () => {
  dismissGuide();
  githubOwnerInput.value = currentConfig.owner;
  githubRepoInput.value = currentConfig.repo;
  githubBranchInput.value = currentConfig.branch;
  githubFolderInput.value = currentConfig.folder;
  githubTokenInput.value = currentConfig.token;
  configDialog.showModal();
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

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveDocument();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!dirty) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
});

async function boot() {
  applySharedParams();

  if (shouldShowGuide()) {
    guideDialog.showModal();
  }

  if (!currentConfig.token && !(currentConfig.owner && currentConfig.repo)) {
    showConnectionState("未连接 GitHub", "");
    setSaveState("未连接");
    return;
  }

  showConnectionState(currentConfig.token ? "连接中..." : "只读访问中...", "");

  try {
    await fetchDocuments();
    showConnectionState(currentConfig.token ? "GitHub 已连接" : "GitHub 只读访问", "connected");
    setSaveState(currentConfig.token ? "已保存" : "只读");
    updateStats();
    updateSessionSummary();
    if (!docButtons.length) {
      const draft = loadDraft(sharedParams.doc || "draft");
      if (draft) {
        docTitle.value = draft.title;
        editor.innerHTML = draft.content;
        activeDocument.slug = sharedParams.doc || activeDocument.slug;
        updateStats();
        updateSaveTime(draft.updatedAt);
        updateUrlForDocument(activeDocument.slug);
        setSaveState("草稿已恢复");
      }
    }
  } catch (error) {
    console.error(error);
    showConnectionState("连接异常", "error");
    setSaveState("连接失败");
    const draft = loadDraft(sharedParams.doc || "draft");
    if (draft) {
      docTitle.value = draft.title;
      editor.innerHTML = draft.content;
      activeDocument.slug = sharedParams.doc || activeDocument.slug;
      updateStats();
      updateSaveTime(draft.updatedAt);
      updateUrlForDocument(activeDocument.slug);
      showToast("已从本机草稿恢复未同步内容");
    }
  }
}

boot();
