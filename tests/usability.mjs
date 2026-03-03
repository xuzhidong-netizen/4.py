import assert from "node:assert/strict";
import test from "node:test";
import { bootApp, defaultConfig, getDraftKey } from "./harness.mjs";

test("search empty state and clear-token flow stay understandable", async () => {
  const app = await bootApp({
    config: { token: "test-token" },
  });
  const { document, window } = app;

  document.querySelector("#clear-token").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.querySelector("#connection-state").textContent.trim(), "未连接 GitHub");
  assert.match(document.querySelector("#session-summary").textContent, /当前未连接 GitHub/);

  const storedConfig = JSON.parse(window.localStorage.getItem("ienter-docs-github-config"));
  assert.equal(storedConfig.token, "");

  const search = document.querySelector("#doc-search");
  search.value = "不会匹配";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(document.querySelector("#doc-empty").hidden, false);

  search.value = "2026";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(document.querySelector("#doc-empty").hidden, true);

  window.close();
});

test("local drafts recover after read failures and rebuild the outline", async () => {
  const slug = "offline-draft";
  const draft = {
    title: "离线草稿",
    content: "<h1>离线草稿</h1><h2>待完善</h2><p>本机内容</p>",
    updatedAt: "2026-03-03T18:30:00.000Z",
  };

  const app = await bootApp({
    readFailure: true,
    url: `https://xuzhidong-netizen.github.io/4.py/?doc=${slug}`,
    localStorage: {
      [getDraftKey(slug, defaultConfig)]: JSON.stringify(draft),
    },
  });
  const { document, window } = app;

  assert.equal(document.querySelector("#doc-title").value, "离线草稿");
  assert.equal(document.querySelector("#save-state").textContent.trim(), "草稿已恢复");
  assert.deepEqual(
    [...document.querySelectorAll("#outline-list a[data-outline-id]")].map((item) => item.textContent.trim()),
    ["离线草稿", "待完善"]
  );

  window.close();
});
