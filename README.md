# Supabase DB Browser

A single-page web client to connect to any Supabase project and browse all tables and data. No install, no build step — just open in a browser.

## Files

- `index.html` — Page structure
- `styles.css` — Styling
- `app.js` — Logic (4 modules: Connection, Schema, TableBrowser, UI)

## Usage

1. Open `index.html` in a browser
2. Enter your **Project URL** and **API Key**
3. Click **Connect**
4. Browse tables in the sidebar, click to view data

## Where to find credentials

Go to **Supabase Dashboard > Project Settings > API**:

- **Project URL** — `https://<project-ref>.supabase.co`
- **API Keys** — Use `service_role` key for full access (bypasses RLS), or `anon` key for RLS-restricted access

These are API keys, not the database password. No direct DB connection is used.

## How it works

- Discovers tables via the PostgREST OpenAPI endpoint (`/rest/v1/`)
- Fetches data using the Supabase JS client (loaded from CDN)
- Paginates at 100 rows per page with "Load more"
- Shows total row count per table
