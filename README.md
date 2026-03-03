# iEnter Docs

Static online document editor page with real persistence via GitHub repository files.

Live URL:

- [https://xuzhidong-netizen.github.io/4.py/](https://xuzhidong-netizen.github.io/4.py/)

## Run locally

```bash
python3 -m http.server 8080
```

Then open:

- [http://localhost:8080](http://localhost:8080)

## GitHub setup

Click `连接仓库` in the page and fill:

- `Owner`
- `Repository`
- `Branch`
- `Folder` such as `documents`
- `GitHub fine-grained token`

The page reads and writes JSON files like `documents/2026-market-plan.json`.

Recommended token permissions:

- Repository access: only the target repo
- `Contents`: `Read and write`

Stored file format:

```json
{
  "title": "2026 市场合作方案",
  "content": "<h1>2026 市场合作方案</h1><p>...</p>",
  "updatedAt": "2026-03-03T04:00:00.000Z",
  "history": []
}
```

Notes:

- The token is stored in browser `localStorage` on the current device.
- This is suitable for internal tooling or prototypes, not for an untrusted public deployment.
- Existing files in the target folder will be loaded into the left document list automatically.

## Test commands

```bash
npm run test:unit
npm run test:integration
npm run test:system
npm run test:stability
npm run test:usability
npm run test:all
npm run check
```

Coverage:

- Unit tests: helpers such as slug generation and history snapshot rules
- Integration tests: title-outline sync, history rename/delete/restore
- System tests: link opening, share flow, new document flow
- Stability tests: debounced saves and repeated history-safe saves
- Usability tests: clear-token flow, empty states, local draft recovery

## Deploy

Push to `main`. GitHub Actions in `.github/workflows/deploy.yml` deploys the site to GitHub Pages.
