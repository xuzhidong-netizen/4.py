const navItems = document.querySelectorAll(".nav-item");
const sections = {
  workspace: document.querySelector("#workspace"),
  approval: document.querySelector("#approval"),
  operation: document.querySelector("#operation"),
  knowledge: document.querySelector("#knowledge"),
  profile: document.querySelector("#profile"),
};

const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#search-input");
const appTiles = document.querySelectorAll(".app-tile");
const launchAssistant = document.querySelector("#launch-assistant");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navItems.forEach((nav) => nav.classList.remove("active"));
    item.classList.add("active");

    const target = item.dataset.target;
    sections[target]?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`已切换到${item.querySelector("span").textContent}`);
  });
});

searchInput.addEventListener("input", (event) => {
  const value = event.target.value.trim();
  const keyword = value.toLowerCase();

  appTiles.forEach((tile) => {
    const text = tile.textContent.toLowerCase();
    const matched = keyword && text.includes(keyword);
    tile.classList.toggle("match", matched);
    tile.style.opacity = !keyword || matched ? "1" : "0.38";
  });
});

appTiles.forEach((tile) => {
  tile.addEventListener("click", () => {
    showToast(`${tile.querySelector("strong").textContent} 模块已打开`);
  });
});

launchAssistant.addEventListener("click", () => {
  showToast("AI 助理已就绪，可用于审批、知识检索与经营分析。");
});
