import assert from "node:assert/strict";
import test from "node:test";
import { bootApp } from "./harness.mjs";

test("slugify keeps Chinese titles readable", async () => {
  const { window } = await bootApp();
  const hooks = window.__IENTER_TEST_HOOKS;

  assert.equal(hooks.slugify("区域 经营 复盘 2026"), "区域-经营-复盘-2026");
  assert.equal(hooks.slugify("  Mixed Title 2026  "), "mixed-title-2026");

  window.close();
});

test("history snapshot logic respects the 24 hour window", async () => {
  const { window } = await bootApp();
  const hooks = window.__IENTER_TEST_HOOKS;

  const history = [
    {
      id: "h-new",
      label: "最新",
      title: "文档",
      content: "<h1>文档</h1>",
      createdAt: "2026-03-03T10:00:00.000Z",
    },
    {
      id: "h-old",
      label: "更早",
      title: "文档",
      content: "<h1>旧文档</h1>",
      createdAt: "2026-03-02T09:00:00.000Z",
    },
  ];

  const within24Hours = hooks.buildNextHistory(history, {
    title: "文档",
    content: "<h1>新内容</h1>",
    createdAt: "2026-03-03T18:00:00.000Z",
  });
  assert.equal(within24Hours.length, 2);

  const after24Hours = hooks.buildNextHistory(history, {
    title: "文档",
    content: "<h1>新内容</h1>",
    createdAt: "2026-03-04T12:30:00.000Z",
  });
  assert.equal(after24Hours.length, 3);
  assert.match(after24Hours[0].label, /^自动快照/);

  window.close();
});

test("default document template always contains a usable outline skeleton", async () => {
  const { window } = await bootApp();
  const hooks = window.__IENTER_TEST_HOOKS;
  const markup = hooks.buildDefaultDocumentMarkup("测试文档");

  assert.match(markup, /<h1>测试文档<\/h1>/);
  assert.equal((markup.match(/<h2>/g) || []).length, 3);

  window.close();
});
