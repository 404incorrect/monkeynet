/* ── The Wire Protocol ─────────────────────────────────────────────────
   MonkeyNet, in formats meant for machines rather than eyes.

   Everything under /feeds/ is derived, never hand-kept. The Climb Log
   feed reads the same commits the log page reads, through the same
   "log:" rule. The MonkeyNews feed reads monkey-news.html itself. Add a
   dispatch to the page, or push a tagged commit, and the feeds follow on
   the next request. There is no second copy to forget to update.

   Assets win before this Worker ever runs, so the site is untouched:
   only paths with no file behind them land here, and anything that
   isn't a feed is handed straight back to the asset server.       */

const SITE = 'https://monkeynet.org';
const REPO = 'onehundredbeers/monkeynet';
const UA   = 'MonkeyNet-Feeds/1.0 (+https://monkeynet.org/feeds/)';

const EDGE_TTL   = 900;   // how long the edge may hold a rendered feed
const GITHUB_TTL = 600;   // how long the edge may hold GitHub's answer

/* ── small helpers ──────────────────────────────────────────────────── */

const XML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return XML[c]; }); }

// Collapse the whitespace that indented HTML leaves inside a text node.
function tidy(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

// Dates on this site are plain YYYY-MM-DD. Noon UTC keeps every reader
// in every timezone on the day we actually meant.
function at(iso) { return new Date(iso + 'T12:00:00Z'); }
function rfc822(iso) { return at(iso).toUTCString(); }
function rfc3339(iso) { return at(iso).toISOString().replace(/\.\d+Z$/, 'Z'); }

function slug(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/* The asset server redirects /page.html to /page, and a binding fetch does
   not follow redirects on its own. Chase it once so the parsers below get
   markup instead of a 307. */
async function asset(env, origin, path) {
  let res = await env.ASSETS.fetch(new Request(origin + path));
  if (res.status >= 300 && res.status < 400) {
    const to = res.headers.get('Location');
    if (to) res = await env.ASSETS.fetch(new Request(new URL(to, origin).toString()));
  }
  return res;
}

function send(body, type) {
  return new Response(body, {
    headers: {
      'Content-Type': type + '; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=' + EDGE_TTL,
      'Access-Control-Allow-Origin': '*',
      'X-Monkey': 'I monkey, therefore we climb.'
    }
  });
}

/* ── the Climb Log ──────────────────────────────────────────────────────
   Same two sources the page uses, merged the same way: the hand-written
   seed rungs in the HTML, plus every commit whose subject starts with
   "log:". If GitHub is asleep the seed still stands, so the feed is
   never empty.                                                        */

async function seedRungs(env, origin) {
  const res = await asset(env, origin, '/climb-log.html');
  if (!res.ok) return [];

  const rungs = [];
  let cur = null;

  const out = new HTMLRewriter()
    .on('ol.vine li',      { element: function ()   { cur = { date: '', title: '', note: '' }; rungs.push(cur); } })
    .on('ol.vine li time', { element: function (el) { if (cur) cur.date = el.getAttribute('datetime') || ''; } })
    .on('ol.vine li h2',   { text:    function (t)  { if (cur) cur.title += t.text; } })
    .on('ol.vine li p',    { text:    function (t)  { if (cur) cur.note  += t.text; } })
    .transform(res);
  await out.arrayBuffer();

  return rungs
    .map(function (r) { return { date: r.date, title: tidy(r.title), note: tidy(r.note) }; })
    .filter(function (r) { return r.date && r.title; });
}

async function commitRungs() {
  let commits;
  try {
    const res = await fetch(
      'https://api.github.com/repos/' + REPO + '/commits?per_page=100',
      {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': UA },
        cf: { cacheTtl: GITHUB_TTL, cacheEverything: true }
      }
    );
    if (!res.ok) return [];
    commits = await res.json();
  } catch (e) {
    return [];   // the canopy keeps its own counsel
  }
  if (!Array.isArray(commits)) return [];

  const rungs = [];
  for (const c of commits) {
    const msg = (c.commit && c.commit.message) || '';
    // Drop a leading emoji run, then require the subject to start with log:
    const subject = msg.split('\n')[0].replace(/^[^A-Za-z0-9]+/, '').trim();
    if (!/^log:/i.test(subject)) continue;

    const title = subject.replace(/^log:\s*/i, '').trim();
    const date  = ((c.commit.author && c.commit.author.date) || '').slice(0, 10);
    if (!title || !date) continue;

    let note = '';
    const blank = msg.indexOf('\n\n');
    if (blank >= 0) {
      note = msg.slice(blank + 2).split('\n').filter(function (l) {
        l = l.trim();
        return l && !/^(co-authored-by|signed-off-by|co-committed-by):/i.test(l) && l.indexOf('🤖') !== 0;
      }).join(' ');
    }

    rungs.push({ date: date, title: title, note: tidy(note), sha: c.sha || '' });
  }
  return rungs;
}

async function climbItems(env, origin) {
  const pair = await Promise.all([commitRungs(), seedRungs(env, origin)]);
  const seen = Object.create(null);
  const merged = [];

  // Tagged commits first, so a rung that exists in both keeps its sha.
  for (const r of pair[0].concat(pair[1])) {
    const key = r.date + '|' + r.title.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    merged.push(r);
  }

  // Newest first. Ties hold the order above rather than shuffling.
  return merged
    .map(function (r, i) { return [r, i]; })
    .sort(function (a, b) {
      if (a[0].date !== b[0].date) return a[0].date < b[0].date ? 1 : -1;
      return a[1] - b[1];
    })
    .map(function (p) {
      const r = p[0];
      return {
        title: r.title,
        body:  r.note,
        date:  r.date,
        url:   SITE + '/climb-log.html',
        guid:  'monkeynet:climb/' + r.date + '/' + slug(r.title),
        extra: r.sha ? { commit: r.sha } : null
      };
    });
}

/* ── MonkeyNews ─────────────────────────────────────────────────────────
   Read straight out of the page. Each dispatch carries an id and a
   data-date so it has a permalink and a place in time; everything else
   here is just lifting the markup that was already there.            */

async function newsItems(env, origin) {
  const res = await asset(env, origin, '/monkey-news.html');
  if (!res.ok) return [];

  const found = [];
  let cur = null;

  const out = new HTMLRewriter()
    .on('article.wire', {
      element: function (el) {
        cur = {
          id: el.getAttribute('id') || '',
          date: el.getAttribute('data-date') || '',
          tone: (el.getAttribute('class') || '').split(/\s+/)
                  .filter(function (c) { return c && c !== 'wire'; })[0] || '',
          beat: '', title: '', dateline: '', body: '', src: '', srcName: ''
        };
        found.push(cur);
      }
    })
    .on('article.wire .beat',     { text: function (t) { if (cur) cur.beat += t.text; } })
    .on('article.wire h2',        { text: function (t) { if (cur) cur.title += t.text; } })
    .on('article.wire .dateline', { text: function (t) { if (cur) cur.dateline += t.text; } })
    .on('article.wire p', {
      element: function () { if (cur && cur.body) cur.body += '\n\n'; },
      text:    function (t) { if (cur) cur.body += t.text; }
    })
    .on('article.wire a.src', {
      element: function (el) { if (cur) cur.src = el.getAttribute('href') || ''; },
      text:    function (t)  { if (cur) cur.srcName += t.text; }
    })
    .transform(res);
  await out.arrayBuffer();

  return found
    .filter(function (d) { return d.id && d.date && tidy(d.title); })
    .map(function (d) {
      const body = d.body.split('\n\n').map(tidy).filter(Boolean).join('\n\n');
      return {
        title: tidy(d.title),
        body:  body,
        date:  d.date,
        url:   SITE + '/monkey-news.html#' + d.id,
        guid:  SITE + '/monkey-news.html#' + d.id,
        permalink: true,
        category: tidy(d.beat).replace(/^[^A-Za-z0-9]+/, ''),
        extra: {
          tone: d.tone,
          dateline: tidy(d.dateline),
          source: d.src || null,
          source_name: tidy(d.srcName).replace(/\s*→\s*$/, '') || null
        }
      };
    });
}

/* ── renderers ──────────────────────────────────────────────────────── */

function rss(feed) {
  let xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '<channel>\n' +
    '<title>' + esc(feed.title) + '</title>\n' +
    '<link>' + esc(feed.link) + '</link>\n' +
    '<description>' + esc(feed.description) + '</description>\n' +
    '<language>en</language>\n' +
    '<lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>\n' +
    '<atom:link href="' + esc(SITE + feed.self) + '" rel="self" type="application/rss+xml"/>\n';

  for (const it of feed.items) {
    xml +=
      '<item>\n' +
      '<title>' + esc(it.title) + '</title>\n' +
      '<link>' + esc(it.url) + '</link>\n' +
      '<guid isPermaLink="' + (it.permalink ? 'true' : 'false') + '">' + esc(it.guid) + '</guid>\n' +
      '<pubDate>' + rfc822(it.date) + '</pubDate>\n' +
      (it.category ? '<category>' + esc(it.category) + '</category>\n' : '') +
      (it.body ? '<description>' + esc(it.body) + '</description>\n' : '') +
      '</item>\n';
  }

  return xml + '</channel>\n</rss>\n';
}

function jsonFeed(feed) {
  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: feed.title,
    home_page_url: feed.link,
    feed_url: SITE + feed.self,
    description: feed.description,
    language: 'en',
    icon: SITE + '/og-image.png',
    items: feed.items.map(function (it) {
      const item = {
        id: it.guid,
        url: it.url,
        title: it.title,
        date_published: rfc3339(it.date)
      };
      if (it.body) item.content_text = it.body;
      if (it.category) item.tags = [it.category];
      if (it.extra) item._monkeynet = it.extra;
      return item;
    })
  }, null, 2) + '\n';
}

/* ── the index at /feeds/ ───────────────────────────────────────────── */

function feedIndex() {
  return `<!doctype html>
<meta charset="utf-8">
<title>Feeds · MonkeyNet</title>
<meta name="description" content="MonkeyNet in machine-readable form: RSS and JSON Feed for the Climb Log and MonkeyNews.">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--bg:#12160F;--panel:#1B231D;--ink:#F5F2E9;--muted:#AFC1B4;
    --banana:#F2D479;--jungle:#67C389;--line:#37463C}
  *{box-sizing:border-box}
  body{margin:0;padding:3rem 1.25rem;background:var(--bg);color:var(--ink);
    font:16px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  main{max-width:44rem;margin:0 auto}
  h1{font-size:1.6rem;margin:0 0 .5rem;color:var(--banana)}
  p{color:var(--muted);margin:0 0 1.5rem}
  a{color:var(--jungle)}
  ul{list-style:none;padding:0;margin:0 0 2rem}
  li{border:1px solid var(--line);background:var(--panel);border-radius:.5rem;
    padding:.9rem 1rem;margin-bottom:.6rem}
  li b{display:block;color:var(--ink);font-weight:600}
  li span{color:var(--muted);font-size:.86rem}
  footer{border-top:1px solid var(--line);padding-top:1.25rem;color:var(--muted);font-size:.86rem}
</style>
<main>
  <h1>Feeds</h1>
  <p>MonkeyNet, in formats meant for machines. Nothing here is hand-kept: the
  Climb Log feed reads the same commits the log reads, and the news feed reads
  the news page itself. CORS is open, so help yourself.</p>
  <ul>
    <li><b><a href="/feeds/climb-log.xml">/feeds/climb-log.xml</a></b>
        <span>The Climb Log, RSS 2.0. Every rung, newest first.</span></li>
    <li><b><a href="/feeds/climb-log.json">/feeds/climb-log.json</a></b>
        <span>The same, JSON Feed 1.1. Carries the commit sha per rung.</span></li>
    <li><b><a href="/feeds/news.xml">/feeds/news.xml</a></b>
        <span>MonkeyNews dispatches, RSS 2.0.</span></li>
    <li><b><a href="/feeds/news.json">/feeds/news.json</a></b>
        <span>The same, JSON Feed 1.1. Carries tone, dateline and source.</span></li>
  </ul>
  <footer>
    <a href="/">MonkeyNet</a> · <a href="/humans.txt">humans.txt</a> ·
    <a href="/climb-log.html">Climb Log</a> · <a href="/monkey-news.html">MonkeyNews</a>
    <br>I monkey, therefore we climb. 🐵
  </footer>
</main>
`;
}

/* ── routing ────────────────────────────────────────────────────────── */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const origin = url.origin;

    if (path === '/feeds') {
      return send(feedIndex(), 'text/html');
    }

    let feed = null;

    if (path === '/feeds/climb-log.xml' || path === '/feeds/climb-log.json') {
      feed = {
        title: 'MonkeyNet · The Climb Log',
        link: SITE + '/climb-log.html',
        description: 'What MonkeyNet has built, in order, read from the ground up.',
        self: path,
        items: await climbItems(env, origin)
      };
    } else if (path === '/feeds/news.xml' || path === '/feeds/news.json') {
      feed = {
        title: 'MonkeyNews · The Canopy Wire',
        link: SITE + '/monkey-news.html',
        description: 'Real dispatches on real monkeys out in the world, with links out to every source.',
        self: path,
        items: await newsItems(env, origin)
      };
    }

    if (feed) {
      return path.endsWith('.json')
        ? send(jsonFeed(feed), 'application/feed+json')
        : send(rss(feed), 'application/rss+xml');
    }

    // Not ours. Hand it back to the asset server.
    return env.ASSETS.fetch(request);
  }
};
