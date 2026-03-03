# iEnter Docs

Static online document editor page with real persistence via GitHub repository files.

## Run locally

Open `index.html` directly in a browser.

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
  "updatedAt": "2026-03-03T04:00:00.000Z"
}
```

Notes:

- The token is stored in browser `localStorage` on the current device.
- This is suitable for internal tooling or prototypes, not for an untrusted public deployment.
- Existing files in the target folder will be loaded into the left document list automatically.

## Lightweight collaboration

The page can also use Supabase Realtime for lightweight multi-user sync while still saving final content to GitHub files.

Open `协同设置` and fill:

- `Supabase URL`
- `Publishable key` or `anon key`
- `Your name`

What it does:

- Broadcasts title and editor content to other online users in the same document room
- Shows current online collaborators
- Keeps GitHub as the source of persisted document files

Limitations:

- This is last-write-wins sync, not CRDT/OT
- It does not sync cursor positions or comments
- It is suitable for lightweight collaboration, not for Google Docs-level conflict handling

## Deploy

Push to `main`. GitHub Actions in `.github/workflows/deploy.yml` deploys the site to GitHub Pages.
