"""Static page builder: wraps every _src/pages/*.html in _src/layout.html and writes it to the site root.

Run from anywhere:  python _tools/build.py
Page files start with a front-matter comment:
    <!--
    title: Dog Boarding
    description: One sentence for search results.
    nav: services            (locations | services | events | about | new — highlights that menu)
    -->
Macros available inside pages:
    [[hero crumb="Services" emoji="🏰" eyebrow="..." title='Dog <span class="s">Boarding</span>' sub="..." img="assets/img/x.webp" alt="..." tag="..."]]
    [[book_cta]]        "Ready to book?" band with both locations + phone
    [[book_buttons]]    the three booking buttons on their own
"""
import hashlib, html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / '_src'
layout = (SRC / 'layout.html').read_text(encoding='utf-8')
bulldog = (SRC / 'bulldog.svg').read_text(encoding='utf-8').strip()   # loader mascot
# cache-busting version: changes whenever any CSS/JS/font file changes
VERSION = hashlib.md5(b''.join(p.read_bytes() for p in sorted((ROOT / 'assets').rglob('*')) if p.suffix in ('.css', '.js'))).hexdigest()[:8]
pup = (SRC / 'pup.svg').read_text(encoding='utf-8').strip()           # chat button icon

BOOK_BUTTONS = ('<a class="btn magnetic" href="book.html?loc=mesa">Book Mesa <span class="arrow">→</span></a>'
                '<a class="btn teal magnetic" href="book.html?loc=chandler">Book Chandler <span class="arrow">→</span></a>'
                '<a class="btn ghost magnetic" href="tel:+14802071852">📞 480-207-1852</a>')
BOOK_CTA = f'''<section style="padding-top:20px"><div class="wrap"><div class="cta-band" data-reveal="scale">
  <div><h2 data-color="white" data-fur="pink">Ready to <span class="s">book?</span></h2><p>Select your nearest location to reserve your spot — or ask Duke, our pup concierge.</p></div>
  <div class="ctas"><a class="btn light magnetic" href="book.html?loc=mesa">Book Mesa <span class="arrow">→</span></a><a class="btn light magnetic" href="book.html?loc=chandler">Book Chandler <span class="arrow">→</span></a><a class="btn ghost magnetic" style="--c:#fff" href="tel:+14802071852">📞 Call</a></div>
</div></div></section>'''

# 5-star reviews quoted (excerpted) from the public Yelp pages, with attribution — see _src/reviews.json
REVIEWS = json.loads((SRC / 'reviews.json').read_text(encoding='utf-8'))
YELP = {'mesa': 'https://www.yelp.com/biz/happy-pets-palace-and-playground-mesa', 'chandler': 'https://www.yelp.com/biz/happy-pets-palace-chandler-chandler'}
def review_card(r, i=0):
    when = f" · {r['date']}" if r['date'] else ''
    return (f'<figure class="rv" style="--i:{i % 6}"><div class="stars" aria-label="5 out of 5 stars">★★★★★</div>'
            f'<blockquote>“{html.escape(r["text"])}”</blockquote>'
            f'<figcaption><span class="av">{html.escape(r["name"][0])}</span><span><b>{html.escape(r["name"])}</b><small>{html.escape(r["from"])}{when}</small></span>'
            f'<a class="src" href="{YELP[r["loc"]]}" target="_blank" rel="noopener">{"Mesa" if r["loc"] == "mesa" else "Chandler"} · Yelp ↗</a></figcaption></figure>')
def reviews_strip():
    half = (len(REVIEWS) + 1) // 2
    rows = [REVIEWS[:half], REVIEWS[half:]]
    out = ''.join(f'<div class="rv-row{" rev" if k else ""}"><div class="rv-track">{"".join(review_card(r) for r in row * 2)}</div></div>' for k, row in enumerate(rows))
    return f'<div class="rv-marquee" aria-label="Customer reviews">{out}</div>'
def reviews_grid():
    return '<div class="rv-grid">' + ''.join(review_card(r, i) for i, r in enumerate(REVIEWS)).replace('<figure class="rv"', '<figure class="rv" data-reveal') + '</div>'

def attrs(s):
    return {m.group(1): m.group(3) if m.group(3) is not None else m.group(4) for m in re.finditer(r'(\w+)=("([^"]*)"|\'([^\']*)\')', s)}

def hero(a):
    plain = re.sub(r'<[^>]+>', '', a['title'])
    crumb = a.get('crumb', '')
    crumbs = '<a href="index.html">Home</a><span>›</span>' + (f'<span>{crumb}</span><span>›</span>' if crumb else '') + f'<span>{a.get("here", plain)}</span>'
    ctas = a.get('ctas', BOOK_BUTTONS)
    img = ''
    if a.get('img'):
        tag = f'<span class="tag">{a["tag"]}</span>' if a.get('tag') else ''
        img = f'''<div data-reveal="scale" style="--i:2"><div class="photo-card tilt"><img src="{a['img']}" alt="{html.escape(a.get('alt', plain))}">{tag}</div></div>'''
    return f'''<header class="page-hero hero">
  <div class="wrap hero-grid">
    <div>
      <nav class="crumbs" aria-label="Breadcrumb">{crumbs}</nav>
      <span class="badge" data-reveal style="margin-top:18px"><span class="trophy">{a.get('emoji', '🐾')}</span>{a.get('eyebrow', '')}</span>
      <h1 class="live-title"{f' data-accent="{a["accent"]}"' if a.get('accent') else ''}>{a['title']}</h1>
      <p class="sub" data-reveal style="--i:3">{a.get('sub', '')}</p>
      <div class="ctas" data-reveal style="--i:4">{ctas}</div>
    </div>
    {img}
  </div>
</header>'''

def build(page):
    text = page.read_text(encoding='utf-8')
    m = re.match(r'\s*<!--(.*?)-->', text, re.S)
    meta = {}
    if m:
        for line in m.group(1).strip().splitlines():
            k, _, v = line.partition(':'); meta[k.strip()] = v.strip()
        text = text[m.end():]
    text = re.sub(r'\[\[hero (.*?)\]\]', lambda mm: hero(attrs(mm.group(1))), text, flags=re.S)
    text = text.replace('[[book_cta]]', BOOK_CTA).replace('[[book_buttons]]', BOOK_BUTTONS).replace('[[reviews_strip]]', reviews_strip()).replace('[[reviews_grid]]', reviews_grid())
    name = page.stem
    title = meta.get('title', 'Happy Pets Palace')
    out = layout
    nav = meta.get('nav', '')
    for key in ('locations', 'services', 'about'):
        out = out.replace('{{cur_%s}}' % key, ' class="cur"' if nav == key else '')
    for key in ('events', 'new'):
        out = out.replace('{{cur_%s}}' % key, ' aria-current="page"' if nav == key else '')
    out = (out.replace('{{doc_title}}', 'Happy Pets Palace' if name == 'index' else f'{title} | Happy Pets Palace')
              .replace('{{description}}', html.escape(meta.get('description', ''), quote=True))
              .replace('{{page}}', name).replace('{{bulldog}}', bulldog).replace('{{pup}}', pup).replace('{{v}}', VERSION).replace('{{body}}', text.strip()))
    (ROOT / f'{name}.html').write_text(out, encoding='utf-8')
    return name

if __name__ == '__main__':
    built = [build(p) for p in sorted((SRC / 'pages').glob('*.html'))]
    print('built', len(built), 'pages:', ', '.join(built))
