# VillageTrain Signage Admin

Local-first admin web app for digital signage: **media uploads**, **playlists**, **train assignment**, and **basic monitoring**. Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Firebase** (Auth, Firestore, Storage).

## Prerequisites

- Node.js 20+
- A Firebase project with **Authentication** (Email/Password), **Firestore**, and **Storage** enabled

## Quick start

```bash
cd SignageCloudServer
cp .env.local.example .env.local
# Edit .env.local — paste your Firebase web app config (all NEXT_PUBLIC_* vars)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are sent to `/login`.

Production build:

```bash
npm run build
npm start
```

## Connect Firebase

1. In [Firebase Console](https://console.firebase.google.com/), create or open your project.
2. **Project settings → General → Your apps → Web** — register an app and copy the config values.
3. Paste them into **`.env.local`** (never commit `.env.local`; use `.env.local.example` only as a template).
4. **Authentication → Sign-in method**: enable **Email/Password**.
5. **Firestore Database**: create database (production mode is fine once rules are set).
6. **Storage**: click Get started and create the default bucket.

### Security rules (MVP: authenticated admin only)

Until you need public read for players, restrict Firestore and Storage to signed-in users:

**Firestore**

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Storage**

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Tighten these before exposing media URLs to untrusted clients (e.g. public read for playback hosts only).

### Firestore indexes

If the console prompts for a composite index when ordering **playlists** by `updatedAt`, create the suggested index. Single-field indexes on `createdAt` / `updatedAt` are usually created automatically.

## Create the first admin user

1. Firebase Console → **Authentication → Users → Add user**.
2. Enter email and password → **Add user**.
3. Run the app, go to `/login`, and sign in with that email/password.

## Test the app

1. **Media**: upload a video or image; set category; for images set duration (default 6s). Open the preview thumbnail.
2. **Playlists**: create a playlist, open it, add media from the library, reorder with ↑/↓, **Save playlist**.
3. **Trains**: add a train; assign an **active playlist** from the dropdown.
4. **Monitoring**: see all trains; **Online** means `lastHeartbeat` is within the last **2 minutes** (see `lib/constants.ts`). Until field devices write heartbeats to Firestore, trains will show **Offline** — you can test by temporarily editing a train document in Firestore and setting `lastHeartbeat` to a recent timestamp.

## Data model (collections)

| Collection   | Purpose |
|-------------|---------|
| `media`     | Metadata + `storagePath`, `downloadUrl`, `mediaType`, `category`, `duration` (images). |
| `playlists` | `title`, `loop`, `items[]` with `mediaId`, `title`, `mediaType`, `downloadUrl`, `duration`. |
| `trains`    | `name`, `activePlaylistId`, `activePlaylistTitle`, `status`, `lastHeartbeat`, `connectedTvs[]`, `createdAt`. |

## Project layout

- `app/login` — email/password sign-in  
- `app/(shell)/*` — sidebar layout + protected pages (`dashboard`, `media`, `playlists`, `trains`, `monitoring`)  
- `lib/firebase/client.ts` — Firebase init from env  
- `lib/services/*` — Firestore + Storage helpers (client-side only; no API routes in this MVP)

## Secrets

Do **not** commit real API keys. If keys were ever exposed in git or chat, rotate them in the Google Cloud / Firebase console.

## Roadmap (out of scope for this MVP)

- Raspberry / local server sync  
- HTTP API routes  
- Versioning and audit logs  

---

**VillageTrain** — signage admin scaffold for `localhost:3000` and future deploy at `https://signage.villagetrain.gr`.
