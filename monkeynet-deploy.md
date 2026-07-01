# 🐵 MonkeyNet — deploy & backend guide ($0)

Everything here is free. Two parts: **(A)** put the site online from a **private** repo, and
**(B)** turn on the Monkey Gallery backend with Supabase.

The files:

```
index.html                ← hub / landing
monkey-maker.html         ← the meme studio (can post straight to the Gallery)
monkey-gallery.html       ← the shared gallery (needs Supabase to go public)
monkeynet-writings.html   ← the manifesto
```

---

## A. Host it: private GitHub repo + Cloudflare Pages (free)

> Heads-up: **GitHub Pages does NOT serve private repos on the free plan** — it needs a paid
> plan (Pro/Team). **Cloudflare Pages deploys a private repo for free**, so use that for hosting
> while keeping the repo private for version control.

1. **Create the repo (private).** On GitHub → New repository → name it `monkeynet`, set
   **Private**, create.
2. **Push your files.** The home page is already **`index.html`**, so from the folder with all
   the files:
   ```bash
   git init
   git add .
   git commit -m "MonkeyNet: first climb"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/monkeynet.git
   git push -u origin main
   ```
3. **Connect Cloudflare Pages.** Cloudflare dashboard → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git** → authorize GitHub → pick the **private** `monkeynet` repo.
4. **Build settings:** Framework preset = **None**. Build command = *(blank)*. Build output
   directory = **`/`** (root). Deploy.
5. You get a free `your-project.pages.dev` URL with HTTPS. Every `git push` redeploys automatically.
6. (Optional) Add a custom domain later in Pages → Custom domains.

---

## B. Monkey Gallery backend: Supabase (free tier)

Free tier gives you a Postgres database + file storage — plenty for a shared gallery, no card required.

The gallery is not a social feed: **no accounts, no algorithm.** Monkeys go up and stay up.
People can optionally scrawl a throwaway **handle** and a caption. There is **no admin control on
the page** — you moderate from the Supabase dashboard by flagging a monkey `hidden` (or deleting it).

Follow these in order; the whole thing takes ~10 minutes.

### 1. Create the project
- Go to [supabase.com](https://supabase.com) → sign in → **New project**.
- Pick a name (e.g. `monkeynet`), set a database password (save it somewhere), choose a region
  near you, and create. Wait ~2 min for it to provision.

### 2. Create the posts table
In the Supabase dashboard → **SQL Editor** → **New query** → paste and **Run**:

```sql
create table posts (
  id          uuid primary key default gen_random_uuid(),
  handle      text,                            -- optional throwaway name (no account)
  caption     text,
  image_url   text not null,
  hidden      boolean not null default false,  -- your moderation flag
  created_at  timestamptz default now()
);

alter table posts enable row level security;

-- anyone can read monkeys that you haven't hidden
create policy "read posts" on posts
  for select using (hidden = false);

-- anyone can hang a monkey (open gallery)
create policy "insert posts" on posts
  for insert with check (true);
```

> Note there is **no update/delete policy** — so nobody using the site can hide or remove a
> monkey. Only you can, from the dashboard (you have full access there). That's the whole
> moderation model, and it's why there's no admin button on the page.

> Already ran the older SQL? Migrate instead of recreating:
> ```sql
> alter table posts add column if not exists handle text;
> alter table posts add column if not exists hidden boolean not null default false;
> drop policy if exists "read posts" on posts;
> create policy "read posts" on posts for select using (hidden = false);
> drop policy if exists "hide posts" on posts;   -- remove the old public take-down policy
> ```

### 3. Create the image bucket
- **Storage** → **New bucket** → name it exactly **`monkeys`** → toggle **Public** on → create.
- Then allow anonymous uploads: **SQL Editor** → **New query** → **Run**:

```sql
create policy "upload monkeys" on storage.objects
  for insert with check (bucket_id = 'monkeys');
```

(A public bucket already allows anyone to *view* the image URLs; this policy lets them *upload*.)

### 4. Wire up the gallery
- Supabase → **Project Settings → API**. Copy two things: the **Project URL** and the
  **anon public** key (the long one labelled `anon` / `public`).
- Open `monkey-gallery.html`, find the `CONFIG` block near the top of the `<script>`, and paste:
  ```js
  const SUPABASE_URL  = 'https://xxxxxxxx.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOi...';   // the anon public key
  const BUCKET = 'monkeys';
  ```
- The anon key is **meant to be public** — it only allows what your RLS policies above permit
  (read visible monkeys, insert new ones, upload images). It cannot hide or delete anything.
- Commit + push. Cloudflare redeploys. The gallery is now a real, shared, public gallery.

> Until you paste the keys, `monkey-gallery.html` runs in **local demo mode** (browser-only
> storage) so you can test the flow — it just isn't shared between people yet.

### 5. Moderating (taking a monkey down)
All from the Supabase dashboard — no page login, no admin URL:
- **Hide it (reversible):** Table editor → `posts` → find the row → set **`hidden`** to `true`.
  It disappears from the gallery immediately; set it back to `false` to restore it.
- **Delete it (permanent):** Table editor → select the row → **Delete**. (The image file also
  lingers in Storage → `monkeys`; delete it there too if you want it fully gone.)

### 6. When you grow (later, still cheap/free)
- Add a captcha / basic rate-limiting to slow spam once you have traffic.
- Want contributors to moderate too? Turn on Supabase Auth (free tier) and add an update policy
  scoped to signed-in admins — but you don't need any of that to launch.
- Free tier limits: ~500 MB database + ~1 GB storage. Images are downscaled before upload, so
  that's a lot of monkeys before you'd ever pay.

---

### Recap
1. Private GitHub repo (version control) → Cloudflare Pages (free hosting, serves private repos).
2. Home page is already `index.html`; build preset None; output `/`.
3. Supabase free project → `posts` table (`handle` + `hidden`) + `monkeys` public bucket + the read/insert/upload policies.
4. Paste URL + anon key into `monkey-gallery.html`, push, done.
5. Moderate from the dashboard by flipping `hidden` (or deleting the row).

Don't forget... monkey 🐵 ... banana 🍌
