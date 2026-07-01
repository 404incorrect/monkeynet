# 🐵 MonkeyNet

An untamed, chaotic thicket of the web engineered specifically for forging high-frequency simian signals, and executing a violent vertical ascent out of the flat human mud.

## Pages

| File | What it is |
|---|---|
| `index.html` | Hub / landing page |
| `monkey-maker.html` | The meme studio (posts straight to the Gallery) |
| `monkey-gallery.html` | Shared gallery — hang a monkey, no accounts/feed (wire up Supabase — see `monkeynet-deploy.md`) |
| `monkeynet-writings.html` | The Simian Singularity manifesto |

## Deploy

See `monkeynet-deploy.md` for the full Cloudflare Pages + Supabase setup.

**Quick version:**
1. Connect this repo in Cloudflare Pages (Framework: None, Output dir: `/`, Build command: blank)
2. Create a Supabase project, run the SQL in `monkeynet-deploy.md`, paste the URL + anon key into `monkey-gallery.html`

## Stack

- Pure HTML/CSS/JS — no build step, no dependencies, no npm
- Cloudflare Pages (free hosting, works with private repos)
- Supabase free tier (Monkey Wall backend)

---

*I monkey, therefore we climb.* 🐵🍌
