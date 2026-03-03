import fs from "node:fs/promises";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { TextDecoder, TextEncoder } from "node:util";
import { JSDOM } from "jsdom";

export const cwd = "/Volumes/Extreme SSD/icen空间";
export const storageKey = "ienter-docs-github-config";
export const draftPrefix = "ienter-docs-draft";
export const defaultConfig = {
  owner: "xuzhidong-netizen",
  repo: "4.py",
  branch: "main",
  folder: "documents",
  token: "",
};

const indexHtml = await fs.readFile(path.join(cwd, "index.html"), "utf8");
const appJs = await fs.readFile(path.join(cwd, "app.js"), "utf8");
const appMarkup = indexHtml.replace(/<script[^>]*src="\.\/app\.js"[^>]*><\/script>/, "");

export function createMockDocument({
  slug = "2026-market-plan",
  title = "2026 市场合作方案",
  content = `
    <h1>2026 市场合作方案</h1>
    <p>文档说明</p>
    <h2 id="section-1">一、年度目标</h2>
    <p>内容 A</p>
    <h2 id="section-2">二、合作模式</h2>
    <p>内容 B</p>
    <h2 id="section-3">三、投放节奏</h2>
    <p>内容 C</p>
  `,
  updatedAt = "2026-03-03T14:00:00.000Z",
  history = [
    {
      id: "snapshot-1",
      label: "自动快照 2026/3/2 18:00:00",
      title: "2026 市场合作方案",
      content: "<h1>历史版本</h1><p>旧内容</p>",
      createdAt: "2026-03-02T10:00:00.000Z",
    },
  ],
} = {}) {
  return {
    slug,
    title,
    content,
    updatedAt,
    history,
    sha: `sha-${slug}`,
  };
}

export function encodeBase64Utf8(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

export function decodeBase64Utf8(value) {
  return Buffer.from(value, "base64").toString("utf8");
}

export function getDraftKey(slug, config = defaultConfig) {
  return `${draftPrefix}:${config.owner}:${config.repo}:${config.branch}:${config.folder}:${slug}`;
}

export function wait(window, ms = 30) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function bootApp(options = {}) {
  const docs = new Map(
    (options.docs || [createMockDocument()]).map((record) => [record.slug, clone(record)])
  );
  const fetchLog = [];
  let shaCounter = 100;

  const config = {
    ...defaultConfig,
    ...(options.config || {}),
  };

  const dom = new JSDOM(appMarkup, {
    runScripts: "dangerously",
    url: options.url || "https://xuzhidong-netizen.github.io/4.py/",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.crypto = webcrypto;
      window.CSS = window.CSS || {};
      window.CSS.escape =
        window.CSS.escape ||
        ((value) => String(value).replace(/[^a-zA-Z0-9\-_]/g, "\\$&"));

      if (options.persistConfig !== false) {
        window.localStorage.setItem(storageKey, JSON.stringify(config));
      }

      for (const [key, value] of Object.entries(options.localStorage || {})) {
        window.localStorage.setItem(key, value);
      }

      window.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const method = init.method || "GET";
        fetchLog.push({ url: url.toString(), method });

        if (options.readFailure && method === "GET") {
          return {
            ok: false,
            status: 500,
            text: async () => "read failure",
          };
        }

        if (options.writeFailure && method !== "GET") {
          return {
            ok: false,
            status: 500,
            text: async () => "write failure",
          };
        }

        const match = url.pathname.match(/\/contents\/(.+)$/);
        const contentPath = match ? decodeURIComponent(match[1]) : "";

        if (method === "GET" && contentPath === config.folder) {
          return {
            ok: true,
            json: async () =>
              [...docs.values()].map((record) => ({
                type: "file",
                name: `${record.slug}.json`,
                path: `${config.folder}/${record.slug}.json`,
                sha: record.sha,
              })),
          };
        }

        if (method === "GET" && contentPath.startsWith(`${config.folder}/`) && contentPath.endsWith(".json")) {
          const slug = path.basename(contentPath, ".json");
          const record = docs.get(slug);
          if (!record) {
            return {
              ok: false,
              status: 404,
              text: async () => "not found",
            };
          }

          return {
            ok: true,
            json: async () => ({
              name: `${record.slug}.json`,
              path: `${config.folder}/${record.slug}.json`,
              sha: record.sha,
              content: encodeBase64Utf8(
                JSON.stringify(
                  {
                    title: record.title,
                    content: record.content,
                    updatedAt: record.updatedAt,
                    history: record.history,
                  },
                  null,
                  2
                )
              ),
            }),
          };
        }

        if (method === "PUT" && contentPath.startsWith(`${config.folder}/`) && contentPath.endsWith(".json")) {
          const slug = path.basename(contentPath, ".json");
          const body = JSON.parse(init.body);
          const decoded = JSON.parse(decodeBase64Utf8(body.content));
          const sha = `sha-${shaCounter++}`;
          docs.set(slug, {
            slug,
            title: decoded.title,
            content: decoded.content,
            updatedAt: decoded.updatedAt,
            history: decoded.history || [],
            sha,
          });

          return {
            ok: true,
            json: async () => ({
              content: {
                path: `${config.folder}/${slug}.json`,
                sha,
              },
            }),
          };
        }

        return {
          ok: false,
          status: 404,
          text: async () => `Unhandled fetch ${method} ${url.toString()}`,
        };
      };

      window.navigator.clipboard = {
        _text: "",
        writeText: async (text) => {
          window.navigator.clipboard._text = text;
        },
      };
      window.console.error = () => {};

      window.HTMLDialogElement.prototype.showModal = function showModal() {
        this.open = true;
      };
      window.HTMLDialogElement.prototype.close = function close() {
        this.open = false;
      };
      window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
        this.dataset.scrolled = "1";
      };
      window.document.execCommand = () => true;
      window.confirm = () => options.confirmReturn ?? true;
      window.prompt = () => options.promptReturn ?? "重命名快照";
      window.alert = () => {};
    },
  });

  dom.window.eval(appJs);
  await wait(dom.window, options.bootDelayMs ?? 40);

  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    fetchLog,
    docs,
    getStoredDoc(slug) {
      return clone(docs.get(slug));
    },
    getWriteCount() {
      return fetchLog.filter((entry) => entry.method === "PUT").length;
    },
    async settle(ms = 40) {
      await wait(dom.window, ms);
    },
  };
}
