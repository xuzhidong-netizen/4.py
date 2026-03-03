import assert from "node:assert/strict";
import test from "node:test";
import { bootApp, createMockDocument } from "./harness.mjs";

test("shared links open the target document and copy the production URL", async () => {
  const app = await bootApp({
    docs: [
      createMockDocument(),
      createMockDocument({
        slug: "meeting-notes",
        title: "客户会议纪要",
        content: "<h1>客户会议纪要</h1><h2>结论</h2><p>会议内容</p>",
        updatedAt: "2026-03-03T16:00:00.000Z",
        history: [],
      }),
    ],
    url: "https://xuzhidong-netizen.github.io/4.py/?doc=meeting-notes",
  });
  const { document, window } = app;

  assert.equal(document.querySelector("#doc-title").value, "客户会议纪要");
  assert.equal(document.querySelector("#connection-state").textContent.trim(), "GitHub 只读访问");

  document.querySelector("#share-btn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await app.settle(30);

  assert.equal(
    window.navigator.clipboard._text,
    "https://xuzhidong-netizen.github.io/4.py/?doc=meeting-notes"
  );

  window.close();
});

test("creating a new document flushes pending changes before resetting the editor", async () => {
  const app = await bootApp({
    config: { token: "test-token" },
  });
  const { document, window } = app;

  document.querySelector("#editor h2").textContent = "保存前章节";
  document.querySelector("#editor").dispatchEvent(new window.Event("input", { bubbles: true }));
  document.querySelector("#new-doc").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await app.settle(80);

  assert.match(app.getStoredDoc("2026-market-plan").content, /保存前章节/);
  assert.equal(document.querySelector("#doc-title").value, "未命名文档");

  const outlineTexts = [...document.querySelectorAll("#outline-list a[data-outline-id]")].map((item) =>
    item.textContent.trim()
  );
  assert.deepEqual(outlineTexts, ["未命名文档", "一、背景", "二、正文", "三、待办"]);

  window.close();
});
