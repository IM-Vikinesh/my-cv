# Deployment setup

The admin panel used to save to `localStorage`, which is per-browser. That is why edits
showed up on your PC but never on your phone. Content now lives in **Cloud Firestore**
behind a small API, so every device reads and writes the same copy.

Firestore is only ever reached through the `api/` functions using the Firebase Admin
SDK. Your service-account key never reaches the browser, and Firestore security rules
can stay completely closed (`allow read, write: if false;`) because the Admin SDK
bypasses them.

## One-time setup

1. **Create a Firebase project** at <https://console.firebase.google.com> and add a
   **Web app** to it (the web config is not used by this project &mdash; only the service
   account is). Then in **Project settings &rarr; Service accounts**, click
   **Generate new private key** and download a JSON file.

2. **Push this folder to a GitHub repo** and import it into Vercel, or run
   `vercel --prod` from this folder.

3. **Create the Firestore database.** In the Firebase console: **Build &rarr; Firestore
   Database &rarr; Create database** &rarr; *Start in production mode*. Nothing else is
   needed: the code uses the Admin SDK, so no client-side rules are required. If you
   prefer maximum safety, publish `firestore.rules` containing only
   `rules_version = '2'; service cloud.firestore { match /databases/{db}/documents { match /{document=**} { allow read, write: if false; } } }`.

4. **Add the environment variables.** **Settings &rarr; Environment Variables**:

   | Name | Value | Notes |
   | --- | --- | --- |
   | `FIREBASE_SERVICE_ACCOUNT` | the whole downloaded JSON, on one line | The private key must keep its `\n` escapes. |
   | `ADMIN_TOKEN` | a strong password | This is the admin panel password. |
   | `ADMIN_USER` | `admin` | Optional, this is the default. |

   Apply to **Production** and **Preview**, then redeploy.

   If pasting multi-line JSON is awkward, delete `FIREBASE_SERVICE_ACCOUNT` and set these
   three instead &mdash; they are equivalent:

   | Name | Value |
   | --- | --- |
   | `FIREBASE_PROJECT_ID` | `project_id` from the JSON |
   | `FIREBASE_CLIENT_EMAIL` | `client_email` from the JSON |
   | `FIREBASE_PRIVATE_KEY` | `private_key` from the JSON, with real line breaks |

5. Sign in by triple-clicking the copyright line at the bottom of the page, then enter
   that username and password.

## What lives where

| Firestore path | Contents |
| --- | --- |
| `portfolio/site` | One document holding the whole site as JSON, plus `updatedAt`. |
| `portfolioMessages` | One document per contact-form submission. Newest 200 are kept. |

## What changed

- `api/auth.js` &mdash; checks the password against `ADMIN_TOKEN` and returns a signed,
  14-day session token. The password is no longer written anywhere in `index.html`, so
  it can no longer be read by viewing the page source.
- `api/data.js` &mdash; `GET` returns the shared content (public, it is a portfolio),
  `PUT` replaces it and requires a valid session.
- `api/messages.js` &mdash; stores contact-form submissions server-side so the inbox is
  the same on every device. `GET`/`DELETE` require a session.
- `api/_lib.js` &mdash; session signing, input cleaning, and the Firestore store.
- `index.html` &mdash; renders from the `localStorage` cache immediately, then swaps in
  the server copy. Edits are debounced by 700&nbsp;ms and pushed once. The public page
  re-checks every 20&nbsp;s and on tab focus, so a change made on one device shows up on
  another without a reload. A badge in the admin sidebar reports
  `Saved - live everywhere`, `Saving...`, or the server's actual error if a save failed.

`localStorage` is still used, but only as an offline cache. If the API is unreachable the
site still renders and the panel shows the reason instead of silently losing your work.

## Changing the password later

Update `ADMIN_TOKEN` in Vercel and redeploy. Every device will be asked to sign in again.

## Local development

```bash
npm install
npx vercel env pull .env.local   # pulls FIREBASE_SERVICE_ACCOUNT / ADMIN_TOKEN
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
- Treat the service-account JSON like a password. Anyone holding it can read and write
  your Firestore database.
