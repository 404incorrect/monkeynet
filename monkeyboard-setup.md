# 🐵 MonkeyBoard — vichan setup guide (small budget)

A plan for standing up **MonkeyBoard**, a monkey-themed imageboard built on
[vichan](https://github.com/vichan-devel/vichan), with three boards:

- **/draw/** — oekaki board, draw-only, monkeys only (uses vichan's built-in wPaint oekaki)
- **/monkey/** — general monkey discussion
- **/banana/** — bananas, and how to acquire more bananas

It ties into the wider MonkeyNets world (MonkeyMaker + a future hub/index).

---

## 1. What you're running

vichan is PHP imageboard software (a maintained fork of Tinyboard). It needs a small
Linux server with PHP, MariaDB/MySQL, a web server, and ImageMagick for thumbnails.
It has **no index/landing page by default** — that's where your MonkeyNets hub comes in
later (see §8).

## 2. Budget (realistic monthly/yearly)

| Item | Pick | Cost |
|---|---|---|
| VPS (1 vCPU / 1–2 GB RAM) | Hetzner CX22, DigitalOcean, Vultr, or Hostinger VPS | ~$4–7 / month |
| Domain (e.g. monkeyboard.net) | Cloudflare Registrar, Namecheap, Porkbun | ~$10–15 / year |
| DNS + caching + basic DDoS | Cloudflare free tier | $0 |
| TLS / HTTPS certificate | Let's Encrypt (certbot) | $0 |
| Object storage for images (optional, later) | Cloudflare R2 / Backblaze B2 | ~$0–5 / month |

**Starter total: about $5–8/month + ~$12/year for the domain.** A 1 GB VPS comfortably
runs a small board; bump to 2 GB if oekaki + traffic grow.

> Tip: a $5 VPS + free Cloudflare is the whole MVP. Don't pay for managed hosting —
> vichan needs shell access for oekaki (the drawing tools can't run on cheap shared hosting).

## 3. Point the domain

1. Buy the domain.
2. In Cloudflare, add the site and set an **A record** → your VPS IP (proxy ON, the orange cloud).
3. Wait for DNS to propagate.

## 4. Server prep (Ubuntu 24.04 example)

SSH in as root (or a sudo user) and install the stack. vichan supports PHP 8.x; match the
PHP version your distro ships (here, 8.3):

```bash
apt update && apt upgrade -y
apt install -y nginx mariadb-server \
  php-fpm php-bcmath php-gd php-pdo php-mbstring php-mysql php-redis php-curl php-xml \
  composer imagemagick graphicsmagick gifsicle git
systemctl enable --now nginx mariadb php8.3-fpm
```

Secure the database:

```bash
mysql_secure_installation
```

Create the database and a dedicated user (replace the password):

```sql
mysql -u root -p
CREATE DATABASE monkeyboard CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER 'monkey'@'localhost' IDENTIFIED BY 'CHANGE_ME_strong_pw';
GRANT ALL PRIVILEGES ON monkeyboard.* TO 'monkey'@'localhost';
FLUSH PRIVILEGES; EXIT;
```

## 5. Install vichan

```bash
cd /var/www
git clone https://github.com/vichan-devel/vichan.git monkeyboard
cd monkeyboard
composer install        # pulls PHP dependencies
chown -R www-data:www-data /var/www/monkeyboard
```

Point an nginx server block at `/var/www/monkeyboard` with PHP-FPM, enable HTTPS:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d monkeyboard.net -d www.monkeyboard.net
```

Then open **https://monkeyboard.net/install.php** in your browser and follow the prompts.
Enter the DB name/user/password from step 4. The installer writes
`inc/instance-config.php` and sets up the tables.

**Immediately** log in at `/mod.php` with the default `admin` / `password` and **change the
password** (Account → change password). Then delete or lock down `install.php`.

## 6. Create the three boards

In `/mod.php` → *Manage boards* → create:

| URI | Title | Notes |
|---|---|---|
| `draw` | Monkey Oekaki | enable oekaki (see §7); consider disabling normal file uploads so it's draw-only |
| `monkey` | General Monkey Discussion | standard board |
| `banana` | Banana Board | standard board; subtitle: "how to get more bananas" |

## 7. Enable oekaki (the draw-a-monkey board)

vichan uses **wPaint** for oekaki, pulled as a git submodule:

```bash
cd /var/www/monkeyboard
git submodule update --init --recursive
```

Then enable it in `inc/instance-config.php` by including the oekaki scripts (the list lives
in `js/oekaki.js` / `js/wpaint.js`). Roughly:

```php
// in inc/instance-config.php
$config['additional_javascript'][] = 'js/jquery.min.js';
$config['additional_javascript'][] = 'js/wpaint/wPaint.min.js';
$config['additional_javascript'][] = 'js/wpaint/lib/raphael.js';
$config['additional_javascript'][] = 'js/oekaki.js';
```

(Confirm the exact filenames in your checkout under `js/` — they occasionally change between
versions.) Restrict `/draw/` to oekaki posts so it stays drawings-only, then post a test
monkey to confirm the canvas loads.

## 8. Make it look like MonkeyBoard (theming)

vichan styling is just CSS + templates — no code changes needed for a reskin:

- Drop a custom stylesheet in `stylesheets/` (banana-yellow + jungle-green to match MonkeyMaker:
  `#F5C518`, `#3FA34D`, dark `#14130F`) and set it as the default theme.
- Replace the logo/banner with a monkey wordmark.
- Set board subtitles, the site title ("🐵 MonkeyBoard"), and the spoiler/“no image” placeholders
  to monkey/banana art.
- Custom CSS per board: yellow accents on `/banana/`, green on `/monkey/`.

## 9. The hub / index (do this once boards exist)

vichan ships **no index page**. Two options:

1. **Use a vichan theme** — in `/mod.php` → *Themes*, enable a front-page theme (e.g. the
   "Categories"/frameset theme) so visitors land on a board list instead of a bare directory.
2. **Build a MonkeyNets hub** (recommended later) — a small landing page at the apex domain
   linking out to MonkeyMaker (the meme tool), MonkeyBoard (the boards), and a banana counter.
   This becomes the front door for everything. I can build this hub page when you're ready.

## 10. Basic hardening (don't skip)

- Change the default admin password (step 5) and create a separate non-admin mod account.
- Firewall: `ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable`.
- Keep Cloudflare proxy ON to hide the origin IP (vichan has had IP-leak issues historically).
- Turn on auto security updates: `apt install unattended-upgrades`.
- Set up image/DB backups (a nightly `mysqldump` + copy of the uploads dir to B2/R2).
- Decide moderation rules early; have a working report + ban flow before you publicize it.

---

### Quick recap

1. $5 VPS + domain + free Cloudflare.
2. Install LEMP + ImageMagick, create DB.
3. `git clone` vichan, `composer install`, run `install.php`.
4. Change the admin password, create `/draw/ /monkey/ /banana/`.
5. Enable wPaint oekaki on `/draw/`.
6. Reskin to monkey/banana colors.
7. Add a hub/index page (theme now, custom MonkeyNets hub later).

Don't forget... monkey 🐵 ... banana 🍌
