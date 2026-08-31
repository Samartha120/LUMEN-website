# LUMEN Report — citizen mobile app

An Expo (React Native) app for filing civic damage reports from a phone. It
photographs the damage, attaches a location, and shows what the detector found.

It is **not a second system**. It talks to the same Express backend as the web
console, through the same `POST /api/complaints` endpoint, and the reports it
files appear in the supervisor queue immediately. There is one database, one
detector and one set of business rules.

## Running it

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** (free, on the App Store and Play Store). No
build, no developer account, no cable.

### Pointing it at the backend

The phone is not the machine running the server, so `localhost` means the phone
itself and will always fail. Set the address explicitly:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.7:4000 npx expo start
```

Use the laptop's address on the same wifi — Expo prints it when it starts. The
sign-in screen shows the address it is using, so a wrong one is obvious.

For a deployed backend, use the public URL instead:

```bash
EXPO_PUBLIC_API_URL=https://lumen-api.onrender.com npx expo start
```

## How it authenticates

The web app keeps its session in an httpOnly cookie, which a native app cannot
use — there is no cookie jar tied to an origin. The app sends the **same signed
token** in an `Authorization: Bearer` header instead.

The server accepts either. `attachSession` reads the cookie first and falls back
to the header, so there is one session format, one secret and one expiry — not a
second auth system for the phone. The token is returned in the sign-in response
only when the client asks for it (`client: "mobile"`), so the web app's session
stays in the cookie where a cross-site script cannot reach it.

On the device the token is held in `expo-secure-store`, which is the iOS
keychain and the Android keystore, so it survives a restart without sitting in
plain text.

## Deploying for free

Four pieces, each on a free tier. The only one that needs care is the AI
service, because it loads PyTorch.

| Piece | Free host | Note |
|---|---|---|
| AI service (FastAPI + YOLO) | **Hugging Face Spaces**, CPU basic | 16 GB RAM, free indefinitely. The only free tier that comfortably fits PyTorch and the weights. |
| Backend (Express) | **Render** free web service | 512 MB. Sleeps after 15 min idle and takes ~30 s to wake. |
| Web console (Vite) | **Netlify** or **Vercel** | Static build, generous free tier. |
| Mobile app | **Expo Go** | Free to run. `eas build -p android --profile preview` gives a free APK to share. |

### The two things that will bite you

**SQLite on a free tier is ephemeral.** Render's free disk is wiped on every
deploy and on every wake from sleep, so seeded complaints disappear. For a demo
that is often fine — reseed on boot. To keep data, move Prisma to a free hosted
Postgres (Neon or Supabase) and change one connection string; the schema is
already Prisma-managed.

**Uploaded photos live on that same disk.** `backend/uploads` is wiped with it.
For a persistent deployment, store them in Supabase Storage or Cloudinary's free
tier and keep the URL in `ComplaintImage.path` — the app and the web console
both already accept an absolute URL there, so no client change is needed.

### Backend environment

```
AI_SERVICE_URL=https://<your-space>.hf.space
FRONTEND_ORIGIN=https://<your-web-app>.netlify.app,http://localhost:5173
JWT_SECRET=<a long random string>
```

`FRONTEND_ORIGIN` is comma-separated so the deployed and local web apps can both
be served without a rebuild. The mobile app is unaffected either way: a native
request carries no `Origin` header, so CORS never applies to it.

## What the app does

- **Report** — up to five photographs from the camera or gallery, a one-line
  description, and the location if granted. Location is a convenience, never a
  blocker.
- **Check what the AI sees** — runs the detector over the photo and shows the
  outlines, classes, confidences and severity **before anything is filed**. If
  the photo is too dark, too far away or of the wrong thing, it can be retaken
  on the spot rather than rejected hours later. Nothing is written server-side,
  so checking three angles leaves no half-complaints behind.
- **Works offline** — with no signal the report is written to the device and
  sent by itself when the network returns. Civic damage is often exactly where
  there is no coverage, and the person standing in front of the hazard will not
  walk back.
- **My reports** — only the reports you filed, with search, open/resolved
  filters, and a count of what you have filed and what has been resolved. That
  scoping is enforced in the database query, not filtered afterwards, so another
  resident's complaint never leaves the server.
- **Updates** — status changes on your reports, with an unread badge.
- **Detail** — the annotated image the detector produced, what it found and with
  what confidence, the severity, and the progress timeline.

Duplicate reports are surfaced honestly: if the backend recognises the same
problem nearby, the app says so and explains that the report still counts,
because repeat reports raise a complaint's priority.
