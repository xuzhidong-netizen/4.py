import assert from "node:assert/strict";
import test from "node:test";
import { bootApp, createMockDocument } from "./harness.mjs";

test("rapid continuous editing is debounced into a single save", async () => {
  const app = await bootApp({
    config: { token: "test-token" },
  });
  const { document, window } = app;

  for (let index = 0; index < 20; index += 1) {
    document.querySelector("#editor h2").textContent = `第 ${index} 次修订`;
    document.querySelector("#editor").dispatchEvent(new window.Event("input", { bubbles: true }));
  }

  await app.settle(900);

  assert.equal(app.getWriteCount(), 1);
  assert.match(app.getStoredDoc("2026-market-plan").content, /第 19 次修订/);

  window.close();
});

test("multiple saves within 24 hours do not duplicate history snapshots", async () => {
  const app = await bootApp({
    config: { token: "test-token" },
    docs: [
      createMockDocument({
        history: [
          {
            id: "snapshot-1",
            label: "自动快照 2026/3/3 20:00:00",
            title: "2026 市场合作方案",
            content: "<h1>旧快照</h1>",
            createdAt: "2026-03-03T12:00:00.000Z",
          },
        ],
      }),
    ],
  });
  const { document, window } = app;

  for (let index = 0; index < 3; index += 1) {
    document.querySelector("#editor p").textContent = `第 ${index} 次正文修订`;
    document.querySelector("#editor").dispatchEvent(new window.Event("input", { bubbles: true }));
    await app.settle(900);
  }

  assert.equal(app.getStoredDoc("2026-market-plan").history.length, 1);

  window.close();
});
