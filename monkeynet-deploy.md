# 🐵 MonkeyNet — deploy & backend guide ($0)

Everything here is free. Two parts: **(A)** put the site online from a **private** repo, and
**(B)** turn on the Monkey Wall backend with Supabase.

The files:

```
monkeynet-hub.html        ← index / landing
monkey-maker.html         ← the meme studio
monkey-wall.html          ← the social feed (needs Supabase to go public)
monkeynet-writings.html   ← the manifesto
```

---

## A. Host it: private GitHub repo + Cloudflare Pages (free)

> Heads-up: **GitHub Pages does NOT serve private repos on the free plan** — it needs a paid
> plan (Pro/Team). **Cloudflare Pages deploys a private repo for free**, so use that for hosting
> while keeping the repo private for version control.

1. **Create the repo (private).** On GitHub → New repository → name it `monkeynet`, set
   **Private**, create.
2. **Push your files.** Rename `monkeynet-hub.html` to **`index.html`** so it's the home page,
   then from the folder with all four files:
   ```bash
   git init
   git add .
   git commit -m "MonkeyNet: first climb"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/monkeynet.git
   git push -u origin main
   ```
   (Update the internal links from `monkeynet-hub.html` to `index.html` where they point home.)
3. **Connect Cloudflare Pages.** Cloudflare dashboard → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git** → authorize GitHub → pick the **private** `monkeynet` repo.
4. **Build settings:** Framework preset = **None**. Build command = *(blank)*. Build output
   directory = **`/`** (root). Deploy.
5. You get a free `your-project.pages.dev` URL with HTTPS. Every `git push` redeploys automatically.
6. (Optional) Add a custom domain later in Pages → Custom domains.

---

## B. Monkey Wall backend: Supabase (free tier)

Free tier gives you a Postgres database + file storage — plenty for a starting wall, no card required.

### 1. Create the project
- Go to supabase.com → New project. Pick a name and a region near you. Wait for it to provision.

### 2. Create the posts table
In the Supabase dashboard → **SQL Editor** → run:

```sql
create table posts (
  id          uuid primary key default gen_random_uuid(),
  caption     text,
  image_url   text not null,
  created_at  timestamptz default now()
);

alter table posts enable row level security;

-- anyone can read the wall
create policy "read posts" on posts
  for select using (true);

-- anyone can post (open wall; tighten later with auth/captcha)
create policy "insert posts" on posts
  for insert with check (true);
```

### 3. Create the image bucket
- **Storage** → **New bucket** → name it **`monkeys`** → mark it **Public** → create.
- Then allow anonymous uploads (SQL Editor):

```sql
create policy "upload monkeys" on storage.objects
  for insert with check (bucket_id = 'monkeys');
```

(Public bucket already allows public read of the image URLs.)

### 4. Wire up the wall
- Supabase → **Settings → API**. Copy the **Project URL** and the **anon public** key.
- Open `monkey-wall.html`, find the CONFIG block at the top of the script, and paste them in:
  ```js
  const SUPABASE_URL  = 'https://xxxxxxxx.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOi...';   // the anon public key
  const BUCKET = 'monkeys';
  ```
- The anon key is **meant to be public** — it only allows what your RLS policies above permit.
- Commit + push. Cloudflare redeploys. The wall is now a real, shared, public feed.

> Until you paste the keys, `monkey-wall.html` runs in **local demo mode** (browser-only storage)
> so you can test the flow — it just isn't shared between people yet.

### 5. When you grow (later, still cheap/free)
- Add light moderation: a `hidden` boolean column + an admin view; or require sign-in
  (Supabase Auth has a free tier) before posting.
- Add basic rate-limiting / a captcha to stop spam once you have traffic.
- Free tier limits: ~500 MB database + ~1 GB storage. Images are downscaled before upload, so
  that's a lot of monkeys before you'd ever pay.

---

### Recap
1. Private GitHub repo (version control) → Cloudflare Pages (free hosting, serves private repos).
2. Rename hub to `index.html`; build preset None; output `/`.
3. Supabase free project → `posts` table + `monkeys` public bucket + the 3 RLS policies.
4. Paste URL + anon key into `monkey-wall.html`, push, done.

Don't forget... monkey 🐵 ... banana 🍌
