import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { TextDecoder, TextEncoder } from "node:util";
import { JSDOM } from "jsdom";

const cwd = "/Volumes/Extreme SSD/icen空间";
const indexHtml = await fs.readFile(path.join(cwd, "index.html"), "utf8");
const appJs = await fs.readFile(path.join(cwd, "app.js"), "utf8");

const mockDocument = {
  title: "2026 市场合作方案",
  content: `
    <h1>2026 市场合作方案</h1>
    <p>文档说明</p>
    <h2 id="section-1">一、年度目标</h2>
    <p>内容 A</p>
    <h2 id="section-2">二、合作模式</h2>
    <p>内容 B</p>
    <h2 id="section-3">三、投放节奏</h2>
    <p>内容 C</p>
    <h2 id="section-4">四、预算安排</h2>
    <p>内容 D</p>
  `,
  updatedAt: "2026-03-03T14:00:00.000Z",
  history: [
    {
      id: "h1",
      label: "自动快照 2026-03-02",
      title: "2026 市场合作方案",
      content: "<h1>历史版本</h1><p>旧内容</p>",
      createdAt: "2026-03-02T10:00:00.000Z"
    }
  ]
};

function encodeBase64Utf8(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

const fetchLog = [];
const dom = new JSDOM(indexHtml.replace('<script src="./app.js"></script>', ""), {
  runScripts: "dangerously",
  url: "https://xuzhidong-netizen.github.io/4.py/",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem(
      "ienter-docs-github-config",
      JSON.stringify({
        owner: "xuzhidong-netizen",
        repo: "4.py",
        branch: "main",
        folder: "documents",
        token: "test-token"
      })
    );

    window.fetch = async (input, init = {}) => {
      const url = String(input);
      fetchLog.push({ url, method: init.method || "GET" });

      if (url.includes("/contents/documents?")) {
        return {
          ok: true,
          json: async () => [
            {
              type: "file",
              name: "2026-market-plan.json",
              path: "documents/2026-market-plan.json",
              sha: "sha-1"
            }
          ]
        };
      }

      if (url.includes("/contents/documents/2026-market-plan.json?")) {
        return {
          ok: true,
          json: async () => ({
            name: "2026-market-plan.json",
            path: "documents/2026-market-plan.json",
            sha: "sha-1",
            content: encodeBase64Utf8(JSON.stringify(mockDocument))
          })
        };
      }

      if (url.includes("/contents/documents/") && (init.method || "GET") === "PUT") {
        const body = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            content: {
              path: "documents/2026-market-plan.json",
              sha: "sha-updated"
            }
          })
        };
      }

      return {
        ok: false,
        text: async () => `Unhandled fetch ${url}`
      };
    };

    window.navigator.clipboard = {
      _text: "",
      writeText: async (text) => {
        window.navigator.clipboard._text = text;
      }
    };

    window.TextEncoder = TextEncoder;
    window.TextDecoder = TextDecoder;
    window.HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    window.HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
    window.confirm = () => true;
    window.prompt = () => "重命名快照";
  }
});

dom.window.eval(appJs);
await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

const { document, Event, MouseEvent } = dom.window;

const outlineLinks = [...document.querySelectorAll("#outline-list a[data-outline-id]")];
assert.equal(outlineLinks.length, 5, "initial outline should include h1 and h2 headings");
assert.equal(outlineLinks[0].textContent.trim(), "2026 市场合作方案");

const historyButtons = [...document.querySelectorAll("#history-list button[data-action]")];
assert.ok(historyButtons.length >= 3, "history actions should render");

document.querySelector("#new-doc").dispatchEvent(new MouseEvent("click", { bubbles: true }));
await new Promise((resolve) => dom.window.setTimeout(resolve, 10));

const newOutlineLinks = [...document.querySelectorAll("#outline-list a[data-outline-id]")];
assert.ok(newOutlineLinks.length >= 4, "new document should generate a usable outline");
assert.equal(newOutlineLinks[0].textContent.trim(), "未命名文档");

const firstSection = document.querySelector("#editor h2");
firstSection.textContent = "一、修订后的背景";
document.querySelector("#editor").dispatchEvent(new Event("input", { bubbles: true }));
await new Promise((resolve) => dom.window.setTimeout(resolve, 10));

const refreshedOutlineLinks = [...document.querySelectorAll("#outline-list a[data-outline-id]")];
assert.equal(refreshedOutlineLinks[1].textContent.trim(), "一、修订后的背景");

document.querySelector("#doc-search").value = "不存在的文档";
document.querySelector("#doc-search").dispatchEvent(new Event("input", { bubbles: true }));
assert.equal(document.querySelector("#doc-empty").hidden, false, "empty state should show when no docs match");

document.querySelector("#share-btn").dispatchEvent(new MouseEvent("click", { bubbles: true }));
await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
assert.ok(
  document.defaultView.navigator.clipboard._text.startsWith("https://xuzhidong-netizen.github.io/4.py/"),
  "share should copy the production URL"
);

assert.ok(fetchLog.some((entry) => entry.method === "GET"), "boot should perform repository reads");
console.log("smoke tests passed");
