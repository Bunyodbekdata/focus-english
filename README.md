# Focus English

**One Platform. Four Skills. No Distractions.**

Focus English is a full-stack minimalist English-learning platform with five centrally managed themes (`Sage Green`, `Ocean Blue`, `Warm Sand`, `Soft Lavender`, and `Dark Forest`), built with Next.js App Router, Turso (libSQL), and Vercel Blob.

## Features

- **Home / Dashboard (`/`)**: Welcome header with theme-adaptive botanical accent, four skill cards, Continue Learning resume card, Recent Notes, and My Vocabulary word counter.
- **Listening (`/listening`)**: Distraction-free YouTube study studio (`youtube.com/watch`, `youtu.be`, `youtube.com/shorts`), official YouTube IFrame Player with progress saving, auto-saving Notes with timestamp insertion, and inline Vocabulary capture.
- **Reading (`/reading`)**: Curated CEFR (`A1`–`C2`) library across 6 subjects, extensible passage creator, personal PDF upload & in-browser **PDF.js** viewer, adjustable width & font size, and paired Notes & Vocabulary.
- **Speaking (`/speaking`)**: Structured **IELTS Speaking (Part 1–3)** and **CEFR Speaking (A1–C2)** examiner studio with real browser microphone recording, live audio waveform, playback, and multimodal audio-based AI assessment.
- **Writing (`/writing`)**: **IELTS Academic**, **IELTS General Training**, and **CEFR Writing (A1–C2)** with word counter, lightweight formatting bar, saved drafts, and diagnostic rubric feedback.
- **Personal Vocabulary (`/vocabulary`)**: Unified English–Uzbek vocabulary collection aggregating entries from Listening, Reading, PDFs, and manual additions.
- **Settings (`/settings`)**: Appearance 5-theme selector, learner profile, reading comfort defaults, AI examiner status, and storage diagnostics.

## Architecture (Dual-Mode Local + Vercel Production)

- **Database**: `@libsql/client`
  - **On Vercel / Production**: Connects to **Turso Cloud** using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Schema & Reading Library seed automatically on first request.
  - **Local Development**: Automatically uses a local SQLite file (`data/focus-english.db`) when `TURSO_DATABASE_URL` is unset.
- **File Storage (PDFs & Speaking Audio)**: `@vercel/blob`
  - **On Vercel / Production**: Uses **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`), supporting both Public and Private stores automatically.
  - **Local Development**: Automatically saves under `data/uploads/` when `BLOB_READ_WRITE_TOKEN` is unset.

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploying to Vercel + Turso + Vercel Blob

1. **Create a Turso Database**:
   - Sign in at [turso.tech](https://turso.tech) (or add Turso via Vercel Marketplace: `vercel integration add tursocloud`).
   - Create a database (e.g. `focus-english`) and copy its `TURSO_DATABASE_URL` (`libsql://...`) and `TURSO_AUTH_TOKEN`.
2. **Push Code to GitHub & Import into Vercel**:
   - Push this folder to a GitHub repository.
   - In Vercel Dashboard → **Add New Project**, import the repository (Framework: Next.js).
3. **Connect Vercel Blob Storage**:
   - In your Vercel Project → **Storage** tab → **Create Database → Blob** → connect to the project (this automatically adds `BLOB_READ_WRITE_TOKEN`).
4. **Add Environment Variables in Vercel** (Settings → Environment Variables):
   - `TURSO_DATABASE_URL` = `libsql://your-db-name.turso.io`
   - `TURSO_AUTH_TOKEN` = `your-turso-token`
   - `AI_PROVIDER` = `gemini` *(or `openai`)*
   - `GEMINI_API_KEY` = `your-gemini-api-key` *(optional, enables live Speaking & Writing AI evaluation)*
   - `GEMINI_MODEL` = `gemini-2.5-flash`
5. **Deploy**: Click **Deploy** (or run `vercel --prod`). On the first visit, Focus English automatically creates all tables in Turso and seeds the CEFR Reading Library.
