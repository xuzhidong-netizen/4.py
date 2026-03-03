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
const collabButton = document.querySelector("#collab-btn");
const connectionState = document.querySelector("#connection-state");
const configDialog = document.querySelector("#config-dialog");
const configForm = document.querySelector("#config-form");
const closeConfigButton = document.querySelector("#close-config");
const collabDialog = document.querySelector("#collab-dialog");
const collabForm = document.querySelector("#collab-form");
const closeCollabButton = document.querySelector("#close-collab");
const presenceList = document.querySelector("#presence-list");
const presenceState = document.querySelector("#presence-state");
const guideDialog = document.querySelector("#guide-dialog");
const dismissGuideButton = document.querySelector("#dismiss-guide");
const guideConnectButton = document.querySelector("#guide-connect");
const githubOwnerInput = document.querySelector("#github-owner");
const githubRepoInput = document.querySelector("#github-repo");
const githubBranchInput = document.querySelector("#github-branch");
const githubFolderInput = document.querySelector("#github-folder");
const githubTokenInput = document.querySelector("#github-token");
const collabUrlInput = document.querySelector("#collab-url");
const collabKeyInput = document.querySelector("#collab-key");
const collabNameInput = document.querySelector("#collab-name");
const toolButtons = document.querySelectorAll(".tool-btn");
const fontFamily = document.querySelector("#font-family");
const fontSize = document.querySelector("#font-size");

const STORAGE_KEY = "ienter-docs-github-config";
const COLLAB_KEY = "ienter-docs-collab-config";
const GUIDE_KEY = "ienter-docs-guide-dismissed";
const DEFAULT_CONFIG = {
  owner: "xuzhidong-netizen",
  repo: "4.py",
  branch: "main",
  folder: "documents",
  token: "",
};
const DEFAULT_COLLAB_CONFIG = {
  url: "",
  key: "",
  name: "",
};

let saveTimer = null;
let broadcastTimer = null;
let activeDocument = {
  path: null,
  sha: null,
  slug: "2026-market-plan",
};
let currentConfig = loadConfig();
let collabConfig = loadCollabConfig();
let docButtons = [...docItems];
let supabaseClient = null;
let collabChannel = null;
let collabEnabled = false;
let applyingRemote = false;
let lastRemoteTimestamp = 0;
const clientId = `client-${crypto.randomUUID()}`;
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
}

function setPresenceState(text) {
  presenceState.textContent = text;
}

function renderPresence(peers = []) {
  presenceList.innerHTML = "";
  if (!peers.length) {
    const empty = document.createElement("span");
    empty.className = "presence-empty";
    empty.textContent = "仅本地编辑";
    presenceList.appendChild(empty);
    return;
  }

  peers.forEach((peer) => {
    const chip = document.createElement("span");
    chip.className = "presence-chip";
    chip.textContent = peer.name || "协作者";
    presenceList.appendChild(chip);
  });
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

function loadCollabConfig() {
  try {
    const raw = window.localStorage.getItem(COLLAB_KEY);
    return raw ? { ...DEFAULT_COLLAB_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_COLLAB_CONFIG };
  } catch {
    return { ...DEFAULT_COLLAB_CONFIG };
  }
}

function persistCollabConfig(config) {
  collabConfig = { ...DEFAULT_COLLAB_CONFIG, ...config };
  window.localStorage.setItem(COLLAB_KEY, JSON.stringify(collabConfig));
}

function readSharedParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    owner: params.get("owner") || "",
    repo: params.get("repo") || "",
    branch: params.get("branch") || "",
    folder: params.get("folder") || "",
    doc: params.get("doc") || "",
    collabUrl: params.get("collabUrl") || "",
    collabKey: params.get("collabKey") || "",
  };
}

function applySharedParams() {
  const nextConfig = { ...currentConfig };
  const nextCollabConfig = { ...collabConfig };

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
  if (sharedParams.collabUrl) {
    nextCollabConfig.url = sharedParams.collabUrl;
  }
  if (sharedParams.collabKey) {
    nextCollabConfig.key = sharedParams.collabKey;
  }

  currentConfig = nextConfig;
  collabConfig = nextCollabConfig;
}

function shouldShowGuide() {
  return window.localStorage.getItem(GUIDE_KEY) !== "1";
}

function dismissGuide() {
  window.localStorage.setItem(GUIDE_KEY, "1");
  guideDialog.close();
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
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("owner", currentConfig.owner);
  url.searchParams.set("repo", currentConfig.repo);
  url.searchParams.set("branch", currentConfig.branch);
  url.searchParams.set("folder", currentConfig.folder);
  url.searchParams.set("doc", activeDocument.slug || "draft");

  if (collabConfig.url) {
    url.searchParams.set("collabUrl", collabConfig.url);
  }
  if (collabConfig.key) {
    url.searchParams.set("collabKey", collabConfig.key);
  }

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
  activeDocument = {
    path: record.path,
    sha: record.sha,
    slug: record.slug,
  };
  docTitle.value = record.title;
  editor.innerHTML = record.content;
}

async function ensureSupabaseClient() {
  if (!collabConfig.url || !collabConfig.key) {
    return null;
  }

  if (!supabaseClient) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabaseClient = createClient(collabConfig.url, collabConfig.key);
  }

  return supabaseClient;
}

async function leaveCollabChannel() {
  if (supabaseClient && collabChannel) {
    await supabaseClient.removeChannel(collabChannel);
  }

  collabChannel = null;
  collabEnabled = false;
  renderPresence([]);
}

function handlePresenceSync() {
  if (!collabChannel) {
    renderPresence([]);
    return;
  }

  const state = collabChannel.presenceState();
  const peers = Object.values(state)
    .flat()
    .map((entry) => ({
      name: entry.name,
      clientId: entry.clientId,
    }));

  renderPresence(peers);
  setPresenceState(peers.length ? `${peers.length} 人在线` : "仅本地编辑");
}

function applyRemoteUpdate(payload) {
  if (payload.clientId === clientId) {
    return;
  }

  if (payload.updatedAt <= lastRemoteTimestamp) {
    return;
  }

  applyingRemote = true;
  docTitle.value = payload.title;
  editor.innerHTML = payload.content;
  activeDocument.slug = payload.slug || activeDocument.slug;
  applyingRemote = false;
  lastRemoteTimestamp = payload.updatedAt;
  setSaveState("已同步");
  showToast(`${payload.author || "协作者"} 的修改已同步`);
}

async function joinCollabChannel() {
  if (!collabConfig.url || !collabConfig.key || !collabConfig.name) {
    setPresenceState("未开启实时协同");
    renderPresence([]);
    return;
  }

  const client = await ensureSupabaseClient();
  if (!client) {
    return;
  }

  await leaveCollabChannel();

  const room = `doc-${activeDocument.slug || "draft"}`;
  collabChannel = client
    .channel(room, {
      config: {
        broadcast: { self: false },
        presence: { key: clientId },
      },
    })
    .on("broadcast", { event: "doc:update" }, ({ payload }) => {
      applyRemoteUpdate(payload);
    })
    .on("presence", { event: "sync" }, handlePresenceSync);

  setPresenceState("连接协同中...");

  await collabChannel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      collabEnabled = true;
      await collabChannel.track({
        clientId,
        name: collabConfig.name,
        slug: activeDocument.slug,
      });
      handlePresenceSync();
      setPresenceState("实时协同已连接");
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      collabEnabled = false;
      setPresenceState("实时协同异常");
    }
  });
}

function scheduleBroadcast() {
  if (!collabEnabled || applyingRemote || !collabChannel) {
    return;
  }

  window.clearTimeout(broadcastTimer);
  broadcastTimer = window.setTimeout(async () => {
    const payload = {
      clientId,
      author: collabConfig.name || "协作者",
      slug: activeDocument.slug,
      title: docTitle.value.trim() || "未命名文档",
      content: editor.innerHTML,
      updatedAt: Date.now(),
    };

    lastRemoteTimestamp = payload.updatedAt;

    try {
      await collabChannel.send({
        type: "broadcast",
        event: "doc:update",
        payload,
      });
    } catch (error) {
      console.error(error);
      setPresenceState("实时协同异常");
    }
  }, 250);
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
  scheduleBroadcast();
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
    await joinCollabChannel();
    showToast(`已切换到《${button.dataset.title}》`);
    return;
  }

  try {
    const data = await githubRequest(button.dataset.path);
    const record = parseDocumentFile(data, decodeBase64Utf8(data.content));
    setEditorContent(record);
    updateDocumentButton(button, record);
    await joinCollabChannel();
    showToast(`已切换到《${record.title}》`);
  } catch (error) {
    console.error(error);
    showToast("读取文档失败，请检查仓库连接");
  }
}

editor.addEventListener("input", () => {
  if (applyingRemote) {
    return;
  }
  scheduleSave();
});

docTitle.addEventListener("input", () => {
  if (applyingRemote) {
    return;
  }
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
  const url = buildShareUrl();
  navigator.clipboard
    .writeText(url)
    .then(() => {
      showToast("文档分享链接已复制");
    })
    .catch(() => {
      showToast(`分享链接：${url}`);
    });
});

exportButton.addEventListener("click", () => {
  showToast("已触发导出为 Word/PDF 的模拟流程");
});

newDocButton.addEventListener("click", async () => {
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
  await joinCollabChannel();
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

collabButton.addEventListener("click", () => {
  collabUrlInput.value = collabConfig.url;
  collabKeyInput.value = collabConfig.key;
  collabNameInput.value = collabConfig.name;
  collabDialog.showModal();
});

closeConfigButton.addEventListener("click", () => {
  configDialog.close();
});

closeCollabButton.addEventListener("click", () => {
  collabDialog.close();
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
    await joinCollabChannel();
    showToast("仓库连接成功，文档会写入 GitHub 文件");
    configDialog.close();
  } catch (error) {
    console.error(error);
    showConnectionState("连接异常", "error");
    setSaveState("连接失败");
    showToast("连接失败，请检查 token、仓库名或分支名");
  }
});

collabForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  persistCollabConfig({
    url: collabUrlInput.value.trim().replace(/\/$/, ""),
    key: collabKeyInput.value.trim(),
    name: collabNameInput.value.trim(),
  });

  try {
    await joinCollabChannel();
    collabDialog.close();
    showToast("实时协同已启用");
  } catch (error) {
    console.error(error);
    setPresenceState("实时协同异常");
    showToast("实时协同连接失败，请检查 Supabase Realtime 配置");
  }
});

async function boot() {
  applySharedParams();

  if (shouldShowGuide()) {
    guideDialog.showModal();
  }

  renderPresence([]);

  if (!currentConfig.token && !(currentConfig.owner && currentConfig.repo)) {
    showConnectionState("未连接 GitHub", "");
    setSaveState("未连接");
    setPresenceState(collabConfig.url ? "待连接文档" : "未开启实时协同");
    return;
  }

  showConnectionState(currentConfig.token ? "连接中..." : "只读访问中...", "");

  try {
    await fetchDocuments();
    showConnectionState(currentConfig.token ? "GitHub 已连接" : "GitHub 只读访问", "connected");
    setSaveState(currentConfig.token ? "已保存" : "只读");
    await joinCollabChannel();
  } catch (error) {
    console.error(error);
    showConnectionState("连接异常", "error");
    setSaveState("连接失败");
    setPresenceState("实时协同未连接");
  }
}

boot();
