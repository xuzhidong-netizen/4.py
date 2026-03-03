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
const outlineList = document.querySelector("#outline-list");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");
const toolButtons = document.querySelectorAll(".tool-btn");
const fontFamily = document.querySelector("#font-family");
const fontSize = document.querySelector("#font-size");

const STORAGE_KEY = "ienter-docs-github-config";
const GUIDE_KEY = "ienter-docs-guide-dismissed";
const DRAFT_PREFIX = "ienter-docs-draft";
const HISTORY_INTERVAL_MS = 24 * 60 * 60 * 1000;
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
  updatedAt: "",
  history: [],
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
  const text = (editor.innerText || editor.textContent || "").replace(/\s+/g, "");
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

function normalizeHistory(history = []) {
  return [...history]
    .filter((item) => item && item.id && item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function buildHistoryEntry({ title, content, createdAt }) {
  return {
    id: crypto.randomUUID(),
    label: `自动快照 ${formatTimestamp(createdAt)}`,
    title,
    content,
    createdAt,
  };
}

function buildNextHistory(history, snapshot, skipHistory = false) {
  const normalized = normalizeHistory(history);
  if (skipHistory) {
    return normalized;
  }

  const latest = normalized[0];
  if (!latest || new Date(snapshot.createdAt) - new Date(latest.createdAt) >= HISTORY_INTERVAL_MS) {
    return [buildHistoryEntry(snapshot), ...normalized];
  }

  return normalized;
}

function getPlainPreview(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return (temp.textContent || "").trim().slice(0, 72) || "空白内容";
}

function buildDefaultDocumentMarkup(title = "未命名文档") {
  return `
    <h1>${title}</h1>
    <p>在这里开始记录新的文档内容。你可以直接覆盖下面的小节，也可以继续新增新的标题。</p>
    <h2>一、背景</h2>
    <p>补充本次文档的背景说明、目标范围与上下文。</p>
    <h2>二、正文</h2>
    <p>在这里编写核心内容、结论和执行细节。</p>
    <h2>三、待办</h2>
    <p>记录下一步动作、负责人和截止时间。</p>
  `;
}

function ensureHeadingId(heading, index) {
  if (!heading.id) {
    heading.id = `section-${index + 1}`;
  }
  return heading.id;
}

function buildOutline() {
  outlineList.innerHTML = "";
  const headings = [...editor.querySelectorAll("h1, h2")];

  if (!headings.length) {
    const item = document.createElement("li");
    item.innerHTML = '<a href="#top">当前没有标题</a>';
    outlineList.appendChild(item);
    return;
  }

  headings.forEach((heading, index) => {
    const id = ensureHeadingId(heading, index);
    const item = document.createElement("li");
    item.innerHTML = `<a href="#${id}" data-outline-id="${id}">${heading.textContent.trim()}</a>`;
    outlineList.appendChild(item);
  });
}

function updateActiveOutline() {
  const headings = [...editor.querySelectorAll("h1[id], h2[id]")];
  if (!headings.length) {
    return;
  }

  let activeId = headings[0].id;
  headings.forEach((heading) => {
    const rect = heading.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.28) {
      activeId = heading.id;
    }
  });

  outlineList.querySelectorAll("a").forEach((link) => {
    link.classList.toggle("active", link.dataset.outlineId === activeId);
  });
}

function renderHistory() {
  historyList.innerHTML = "";

  const items = normalizeHistory(activeDocument.history);
  if (!items.length) {
    historyEmpty.hidden = false;
    historyList.appendChild(historyEmpty);
    return;
  }

  historyEmpty.hidden = true;
  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "history-item";
    article.innerHTML = `
      <strong>${item.label}</strong>
      <p>${getPlainPreview(item.content)}</p>
      <small>${formatTimestamp(item.createdAt)}</small>
      <div class="history-actions">
        <button class="mini-btn" data-action="restore" data-id="${item.id}">复原</button>
        <button class="mini-btn" data-action="edit" data-id="${item.id}">编辑</button>
        <button class="mini-btn danger" data-action="delete" data-id="${item.id}">删除</button>
      </div>
    `;
    historyList.appendChild(article);
  });
}

function buildDocumentPayload({ title, content, updatedAt, history = [] }) {
  return JSON.stringify(
    {
      title,
      content,
      updatedAt,
      history,
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
    history: normalizeHistory(parsed.history),
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
    updatedAt: effectiveRecord.updatedAt,
    history: normalizeHistory(effectiveRecord.history),
  };
  docTitle.value = effectiveRecord.title;
  editor.innerHTML = effectiveRecord.content;
  updateStats();
  updateSaveTime(effectiveRecord.updatedAt);
  updateUrlForDocument(effectiveRecord.slug);
  buildOutline();
  updateActiveOutline();
  renderHistory();
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
    activeDocument.history = [];
    renderHistory();
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
  const history = buildNextHistory([], { title, content, createdAt: updatedAt });
  const payload = buildDocumentPayload({ title, content, updatedAt, history });
  const result = await upsertDocumentFile(path, payload);

  return {
    title,
    content,
    updatedAt,
    path: result.content.path,
    sha: result.content.sha,
    slug,
    history,
  };
}

async function persistDocument(options = {}) {
  if (!currentConfig.token) {
    saveDraft();
    setSaveState("未连接");
    updateSaveTime(new Date().toISOString());
    return null;
  }

  markSaving();

  const title = options.title || docTitle.value.trim() || "未命名文档";
  const content = options.content || editor.innerHTML;
  const updatedAt = new Date().toISOString();
  const slug = activeDocument.slug || slugify(title) || `doc-${Date.now()}`;
  const path = activeDocument.path || `${currentConfig.folder}/${slug}.json`;
  const history = buildNextHistory(
    options.history ?? activeDocument.history,
    { title, content, createdAt: updatedAt },
    options.skipHistory === true
  );
  const payload = buildDocumentPayload({ title, content, updatedAt, history });

  try {
    const result = await upsertDocumentFile(path, payload, activeDocument.sha);
    const record = {
      title,
      content,
      updatedAt,
      path: result.content.path,
      sha: result.content.sha,
      slug,
      history,
    };

    activeDocument = {
      path: record.path,
      sha: record.sha,
      slug: record.slug,
      updatedAt: record.updatedAt,
      history: record.history,
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
    setSaveState(options.successState || "已保存");
    updateSaveTime(record.updatedAt);
    updateUrlForDocument(record.slug);
    clearDraft(record.slug);
    renderHistory();
    dirty = false;
    if (options.successToast) {
      showToast(options.successToast);
    }
    return record;
  } catch (error) {
    console.error(error);
    saveDraft();
    setSaveState("保存失败");
    showConnectionState("连接异常", "error");
    updateSaveTime(new Date().toISOString());
    showToast("保存失败，已自动保存在本机草稿");
    return null;
  }
}

async function saveDocument() {
  return persistDocument();
}

function findHistoryItem(historyId) {
  return normalizeHistory(activeDocument.history).find((item) => item.id === historyId);
}

async function renameHistoryItem(historyId) {
  const item = findHistoryItem(historyId);
  if (!item) {
    return;
  }

  const nextLabel = window.prompt("输入历史记录名称", item.label);
  if (!nextLabel || nextLabel.trim() === item.label) {
    return;
  }

  const history = normalizeHistory(activeDocument.history).map((entry) =>
    entry.id === historyId ? { ...entry, label: nextLabel.trim() } : entry
  );

  await persistDocument({
    history,
    skipHistory: true,
    successToast: "历史记录名称已更新",
  });
}

async function deleteHistoryItem(historyId) {
  const item = findHistoryItem(historyId);
  if (!item) {
    return;
  }

  const confirmed = window.confirm(`确定删除历史记录“${item.label}”吗？`);
  if (!confirmed) {
    return;
  }

  const history = normalizeHistory(activeDocument.history).filter((entry) => entry.id !== historyId);

  await persistDocument({
    history,
    skipHistory: true,
    successToast: "历史记录已删除",
  });
}

async function restoreHistoryItem(historyId) {
  const item = findHistoryItem(historyId);
  if (!item) {
    return;
  }

  docTitle.value = item.title;
  editor.innerHTML = item.content;
  updateStats();
  dirty = true;

  await persistDocument({
    title: item.title,
    content: item.content,
    history: activeDocument.history,
    skipHistory: true,
    successToast: `已复原到 ${item.label}`,
  });
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
  buildOutline();
  updateActiveOutline();
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

historyList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  if (action === "edit") {
    await renameHistoryItem(id);
  } else if (action === "delete") {
    await deleteHistoryItem(id);
  } else if (action === "restore") {
    await restoreHistoryItem(id);
  }
});

outlineList.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-outline-id]");
  if (!link) {
    return;
  }

  event.preventDefault();
  const target = editor.querySelector(`#${CSS.escape(link.dataset.outlineId)}`);
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
  updateActiveOutline();
});

window.addEventListener("scroll", updateActiveOutline, { passive: true });

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
  editor.innerHTML = buildDefaultDocumentMarkup("未命名文档");
  docButtons.forEach((doc) => doc.classList.remove("active"));
  activeDocument = {
    path: null,
    sha: null,
    slug: `doc-${Date.now()}`,
    updatedAt: "",
    history: [],
  };
  setSaveState(currentConfig.token ? "待保存" : "未连接");
  updateStats();
  updateSaveTime("");
  updateUrlForDocument(activeDocument.slug);
  buildOutline();
  updateActiveOutline();
  renderHistory();
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
    buildOutline();
    updateActiveOutline();
    if (!docButtons.length) {
      const draft = loadDraft(sharedParams.doc || "draft");
      if (draft) {
        docTitle.value = draft.title;
        editor.innerHTML = draft.content;
        activeDocument.slug = sharedParams.doc || activeDocument.slug;
        activeDocument.history = [];
        updateStats();
        updateSaveTime(draft.updatedAt);
        updateUrlForDocument(activeDocument.slug);
        renderHistory();
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
      activeDocument.history = [];
      updateStats();
      updateSaveTime(draft.updatedAt);
      updateUrlForDocument(activeDocument.slug);
      renderHistory();
      showToast("已从本机草稿恢复未同步内容");
    }
  }
}

boot();
