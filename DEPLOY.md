# Deployment setup

The admin panel used to save to `localStorage`, which is per-browser. That is why edits
showed up on your PC but never on your phone. Content now lives in a Postgres database
behind a small API, so every device reads and writes the same copy.

## One-time setup on Vercel

1. **Push this folder to a GitHub repo** and import it into Vercel
   (Project &rarr; Add New &rarr; Project &rarr; Import). Keep the build command empty
   and the output directory empty; Vercel serves `index.html` and the `api/` functions
   as-is.

2. **Create the database.** In the Vercel project: **Storage &rarr; Create Database**
   &rarr; Postgres (the Hobby tier has a free one). Vercel links it and injects
   `POSTGRES_URL` automatically. The two tables are created automatically on the first
   request &mdash; there is no migration step.

3. **Add the admin password.** **Settings &rarr; Environment Variables**:

   | Name | Value | Notes |
   | --- | --- | --- |
   | `ADMIN_TOKEN` | a strong password | This is the admin panel password. |
   | `ADMIN_USER` | `admin` | Optional, this is the default. |

   Apply to **Production** and **Preview**, then redeploy.

4. Sign in at `your-site.com/#admin` using that username and password.

## What changed

- `api/auth.js` &mdash; checks the password against `ADMIN_TOKEN` and returns a signed,
  14-day session token. The password is no longer written anywhere in `index.html`, so
  it can no longer be read by viewing the page source.
- `api/data.js` &mdash; `GET` returns the shared content (public, it is a portfolio),
  `PUT` replaces it and requires a valid session.
- `api/messages.js` &mdash; stores contact-form submissions server-side so the inbox is
  the same on every device. `GET`/`DELETE` require a session.
- `index.html` &mdash; renders from the `localStorage` cache immediately, then swaps in
  the server copy. Edits are debounced by 700&nbsp;ms and pushed once. The public page
  re-checks every 20&nbsp;s and on tab focus, so a change made on one device shows up on
  another without a reload. A badge in the admin sidebar reports
  `Saved - live everywhere`, `Saving...`, or the error if a save failed.

`localStorage` is still used, but only as an offline cache. If the API is unreachable the
site still renders and the panel shows an amber "Offline" notice instead of silently
losing your work.

## Changing the password later

Update `ADMIN_TOKEN` in Vercel and redeploy. Every device will be asked to sign in again.

## Local development

```bash
npm install
npx vercel env pull .env.local   # pulls POSTGRES_URL / ADMIN_TOKEN
npx vercel dev
```

Opening `index.html` straight off the filesystem also still works &mdash; the API calls
just fail and the site falls back to the cached copy.

## Notes

- `Admin &rarr; Backup &rarr; Download index.html` still bakes the current content into
  the file as defaults. That is now only useful as a standalone copy, not as a way to
  publish changes.
- Messages that were stranded in a browser's `localStorage` are pushed to the shared
  inbox the first time you open `Admin &rarr; Messages`.
