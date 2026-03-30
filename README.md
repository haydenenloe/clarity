# Clarity — Your Therapy Co-Pilot

> Make every therapy session count.

A clean waitlist landing page for [Clarity](https://github.com/haydenenloe/clarity), the local-first therapy session co-pilot.

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Supabase** (waitlist storage)

---

## Deploy to Vercel in 3 Steps

**1. Set up Supabase**

- Create a free project at [supabase.com](https://supabase.com)
- Open **SQL Editor** and run `supabase/migrations/001_waitlist.sql`
- Copy your **Project URL** and **anon public key** from Settings → API

**2. Deploy to Vercel**

```bash
# Option A — Vercel CLI
npx vercel --prod

# Option B — GitHub integration
# Push this repo to GitHub, then import at vercel.com/new
```

**3. Add environment variables in Vercel**

In your Vercel project → Settings → Environment Variables, add:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |

That's it. Vercel will auto-redeploy on every `git push`.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your Supabase credentials
cp .env.local.example .env.local

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
clarity-web/
├── app/
│   ├── layout.tsx        # Root layout + metadata
│   ├── page.tsx          # Landing page + waitlist form
│   └── globals.css       # Tailwind base styles
├── lib/
│   └── supabase.ts       # Supabase client factory
├── supabase/
│   └── migrations/
│       └── 001_waitlist.sql  # Waitlist table + RLS policies
├── .env.local.example    # Env var template
└── README.md
```

---

## Viewing Waitlist Signups

Log into your Supabase dashboard → Table Editor → `waitlist`.

Or run:
```sql
select * from waitlist order by created_at desc;
```
