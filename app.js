const editor = document.querySelector("#editor");
const saveState = document.querySelector("#save-state");
const docTitle = document.querySelector("#doc-title");
const docItems = document.querySelectorAll(".doc-item");
const docSearch = document.querySelector("#doc-search");
const toast = document.querySelector("#toast");
const shareButton = document.querySelector("#share-btn");
const exportButton = document.querySelector("#export-btn");
const newDocButton = document.querySelector("#new-doc");
const toolButtons = document.querySelectorAll(".tool-btn");
const fontFamily = document.querySelector("#font-family");
const fontSize = document.querySelector("#font-size");

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
  window.clearTimeout(markSaving.timer);
  markSaving.timer = window.setTimeout(() => {
    saveState.textContent = "已保存";
    saveState.classList.remove("saving");
  }, 900);
}

editor.addEventListener("input", markSaving);
docTitle.addEventListener("input", markSaving);

docItems.forEach((item) => {
  item.addEventListener("click", () => {
    docItems.forEach((doc) => doc.classList.remove("active"));
    item.classList.add("active");
    docTitle.value = item.dataset.title;
    markSaving();
    showToast(`已切换到《${item.dataset.title}》`);
  });
});

docSearch.addEventListener("input", (event) => {
  const keyword = event.target.value.trim().toLowerCase();

  docItems.forEach((item) => {
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
    markSaving();
  });
});

fontFamily.addEventListener("change", (event) => {
  document.execCommand("fontName", false, event.target.value);
  editor.focus();
  markSaving();
});

fontSize.addEventListener("change", (event) => {
  editor.style.fontSize = event.target.value;
  markSaving();
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
  docItems.forEach((doc) => doc.classList.remove("active"));
  markSaving();
  showToast("已创建新的空白文档");
});
