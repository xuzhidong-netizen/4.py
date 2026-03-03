import assert from "node:assert/strict";
import test from "node:test";
import { bootApp, createMockDocument } from "./harness.mjs";

test("editing the title keeps the main heading and outline in sync", async () => {
  const app = await bootApp({
    config: { token: "test-token" },
  });
  const { document, window } = app;

  const titleInput = document.querySelector("#doc-title");
  titleInput.value = "区域经营复盘 2026";
  titleInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await app.settle(900);

  assert.equal(document.querySelector("#editor h1").textContent.trim(), "区域经营复盘 2026");
  assert.equal(
    document.querySelector("#outline-list a[data-outline-id]").textContent.trim(),
    "区域经营复盘 2026"
  );
  assert.equal(document.querySelector("#doc-list .doc-item.active strong").textContent.trim(), "区域经营复盘 2026");

  const stored = app.getStoredDoc("2026-market-plan");
  assert.equal(stored.title, "区域经营复盘 2026");
  assert.match(stored.content, /区域经营复盘 2026/);

  window.close();
});

test("history rename and delete update both UI and persisted file", async () => {
  const app = await bootApp({
    config: { token: "test-token" },
    promptReturn: "手动命名版本",
  });
  const { document, window } = app;

  document
    .querySelector('#history-list button[data-action="edit"]')
    .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await app.settle(80);

  assert.match(document.querySelector("#history-list .history-item strong").textContent, /手动命名版本/);
  assert.equal(app.getStoredDoc("2026-market-plan").history[0].label, "手动命名版本");

  document
    .querySelector('#history-list button[data-action="delete"]')
    .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await app.settle(80);

  assert.equal(document.querySelectorAll("#history-list .history-item").length, 0);
  assert.equal(app.getStoredDoc("2026-market-plan").history.length, 0);

  window.close();
});

test("history restore rewrites current content and rebuilds the outline", async () => {
  const app = await bootApp({
    config: { token: "test-token" },
    docs: [
      createMockDocument({
        history: [
          {
            id: "snapshot-1",
            label: "自动快照 2026/3/2 18:00:00",
            title: "历史版本标题",
            content: "<h1>历史版本标题</h1><h2>恢复章节</h2><p>恢复内容</p>",
            createdAt: "2026-03-02T10:00:00.000Z",
          },
        ],
      }),
    ],
  });
  const { document, window } = app;

  document.querySelector("#editor h2").textContent = "当前章节";
  document.querySelector("#editor").dispatchEvent(new window.Event("input", { bubbles: true }));
  await app.settle(900);

  document
    .querySelector('#history-list button[data-action="restore"]')
    .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await app.settle(80);

  assert.equal(document.querySelector("#doc-title").value, "历史版本标题");
  assert.equal(document.querySelector("#outline-list a[data-outline-id]").textContent.trim(), "历史版本标题");
  assert.match(document.querySelector("#editor").innerHTML, /恢复章节/);
  assert.match(app.getStoredDoc("2026-market-plan").content, /恢复章节/);

  window.close();
});
