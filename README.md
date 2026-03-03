# iEnter Docs

Static online document editor page with real persistence via Supabase REST.

## Run locally

Open `index.html` directly in a browser.

## Supabase setup

Create a table named `documents`:

```sql
create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content text not null default '',
  updated_at timestamptz not null default now()
);
```

Enable RLS and add prototype policies for browser-side saving:

```sql
alter table public.documents enable row level security;

create policy "public read documents"
on public.documents
for select
to anon
using (true);

create policy "public insert documents"
on public.documents
for insert
to anon
with check (true);

create policy "public update documents"
on public.documents
for update
to anon
using (true)
with check (true);
```

Then click `连接数据库` in the page and paste:

- `Project URL`
- `anon key` or `publishable key`

## Deploy

Push to `main`. GitHub Actions in `.github/workflows/deploy.yml` deploys the site to GitHub Pages.
