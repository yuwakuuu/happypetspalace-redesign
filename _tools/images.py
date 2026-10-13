"""Rebuild assets/img/ from the original site's photos — gentle, natural-looking processing.

usage: python _tools/images.py <download_cache_dir>

Rules (the earlier pass over-sharpened):
  * always start from the largest original WordPress keeps (size suffixes like -768x1024 stripped)
  * shrinking: Lanczos + one very light unsharp mask
  * enlarging: capped at 1.6x, bicubic, a whisper of blur first to hide JPEG blocks, no extra sharpening
  * no contrast / saturation boosts
"""
import os, re, sys, urllib.request
from PIL import Image, ImageFilter, ImageOps

U = 'https://happypetspalace.com/wp-content/uploads/'
CACHE = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img')
os.makedirs(CACHE, exist_ok=True)
MAX_UP = 1.6

# name: (path on the old site, kind) — kind: cover WxH | long N | square N
JOBS = {
  'hero': ('2023/05/home-hero-no-text.webp', ('long', 1600)),
  'about': ('2023/01/rotating-banner-about.webp', ('long', 1600)),
  'award': ('2023/01/award-winning-1.png.webp', ('long', 1339)),
  'svc-boarding': ('2024/04/homepage-circles-BOARDING.png.webp', ('square', 360)),
  'svc-daycare': ('2024/04/homepage-circles-DAYCARE.png.webp', ('square', 360)),
  'svc-puppy': ('2023/01/homepage-circles-puppy.webp', ('square', 360)),
  'svc-enrichment': ('2023/01/homepage-circles-daycare.webp', ('square', 360)),
}
for n, p in {'Linda': '2026/09/Linda.jpg', 'Amber': '2024/09/Amber.webp', 'Lucy': '2023/08/Lucy.webp', 'Andrea': '2021/06/Andrea.jpg.webp',
             'Angela': '2022/08/Angela.jpg.webp', 'Askyla': '2026/01/Askyla.jpg.webp', 'Ben': '2026/08/Ben.jpg.webp', 'Caity': '2026/07/Caity.jpg.webp',
             'Calvin': '2024/09/Calvin.webp', 'Charlie': '2021/04/Charlie.jpg.webp', 'David': '2022/08/David.jpg.webp', 'Ella': '2026/07/Ella-1.jpg.webp',
             'Flor': '2024/02/Flor-web.jpg.webp', 'Hailey': '2026/07/Hailey.jpg.webp', 'Jayde': '2025/02/Jayde.jpg.webp', 'Kate': '2026/01/Kate-1.jpeg',
             'Katie': '2026/01/Katie-1.jpeg', 'Keara': '2024/09/Keara.webp', 'Leah': '2025/02/Leah.jpg.webp', 'Lindsay': '2025/02/Lindsay.jpg.webp',
             'Luca': '2026/08/Luca.jpg.webp', 'Makenzie': '2024/09/Makenzie.webp', 'Marcus': '2026/07/Marcus-3.jpg.webp', 'Mia': '2026/08/Mia.jpg.webp',
             'Roxane': '2024/02/Roxane-web.jpg.webp', 'Scott': '2026/01/Scott.png.webp', 'Sophia': '2026/07/Sophia.jpg.webp', 'Will': '2024/09/Will.webp'}.items():
    JOBS['staff-' + n.lower()] = (p, ('cover', 720, 960))
for name, p in {
 'boarding-room': '2023/01/DogBoardingComfyRoomKurandaDogBed.webp', 'boarding-2': '2023/01/dog_boarding2.webp', 'boarding-3': '2024/04/image_123650291.webp',
 'daycare-bubbles': '2022/10/DogDaycareBubbleFun-768x1024.webp', 'daycare-linda': '2023/01/DoggyDaycareLindaLovesMaverick-758x1024-1-edited.webp',
 'daycare-friends': '2023/01/HappyDogsWithTheirDogFriends-edited.jpg.webp', 'daycare-will': '2026/04/WillandHisGoldenGirls-767x1024.jpg.webp',
 'enrich-1': '2023/01/ChandlerBigDogsInside_EnrichmentBrandyAndBulldogPuppy-web.webp', 'enrich-2': '2023/01/DogAgilityEquipmentTeeterTotterDoodle.webp',
 'puppy-1': '2022/10/Puppy1-711x1024.webp', 'puppy-3': '2022/10/Puppy3-768x1024.webp', 'puppy-train': '2019/11/puppy-training2-1.png.webp',
 'train-cooper': '2026/01/AKC_Puppy_Cooper.png.webp', 'train-bella': '2026/01/CGC_Dog_BellaSue-712x1024.jpg.webp',
 'spa-wallaby': '2026/04/Wallaby-Bath-Time-1.jpg.webp', 'spa-husky': '2026/04/Husky-Bath-Time-2.jpg.webp', 'spa-doodle': '2026/04/Doodle-Bath-Time-1024x1024.jpg.webp',
 'spa-labradoodle': '2026/04/Happy-Labradoodle-in-grooming-tub-edited.png.webp', 'spa-sasha': '2022/09/DogBathSashaDFierce-web-1024x1024.jpg.webp',
 'ppa-header': '2026/09/HPP-Website-PPA-Header-1-1024x409.png.webp', 'ppa-bath': '2026/09/PPA-Student-Bathing-Dog.png.webp', 'ppa-portrait': '2026/09/PPA-Student-Pet-Portrait-Studio-1024x683.png.webp',
 'ppa-train': '2026/09/PPA-Student-Training-683x1024.png.webp', 'ppa-collage': '2026/09/PPA-Student-Photo-Collage.png.webp', 'ppa-linda': '2026/09/Linda-New-HPP-Photo-225x300.webp',
 'portrait-sadee': '2020/10/MesaToyDogsInside_BoardingPhotoHappySadee-web.jpg.webp', 'portrait-fireworks': '2026/09/HPP-Portrait-Fireworks-Backdrop.jpg',
 'portrait-blossom': '2026/09/HPP-Portrait-Blossom-Backdrop.jpg', 'portrait-holiday': '2026/09/HPP-Portrait-Holiday-Backdrop.jpg',
 'rv-exterior': '2026/09/HPP-Adventure-RV-Exterior.jpg', 'rv-interior': '2026/09/HPP-Adventure-RV-Interior.jpg', 'rv-floorplan': '2026/09/HPP-Adventure-RV-Floorplan.jpg',
 'loc-mesa': '2026/09/HPPMesa.png.webp', 'loc-chandler': '2022/10/happy-pets-chandler.jpg.webp',
 'events-small': '2023/02/DoggyDaycareOutside_SmallDogs.webp', 'flyer-toy': '2026/09/HPP-Toy-Breed-Social-Meetup-Flyer.jpg', 'flyer-puppy': '2026/09/HPP-Puppy-Social-Meetup-Flyer.jpg',
 'webcam': '2023/01/dogwebcam.jpg.webp', 'newclient-yorkie': '2022/10/CuteYorkieAtDoggyDaycare.webp',
 'blog-boarding': '2024/04/boarding-daycare.webp', 'blog-doghaus': '2023/10/dog-haus-1a.webp', 'blog-food': '2018/01/Blog11PoopPictures.jpg.webp', 'blog-fomo': '2023/02/DoggyDaycareOutside_TiredOutDoodle.webp',
}.items():
    JOBS[name] = (p, ('long', 1400))

def get(path):
    f = os.path.join(CACHE, re.sub(r'[^\w.-]', '_', path))
    if not os.path.exists(f):
        try:
            with urllib.request.urlopen(urllib.request.Request(U + path, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as r: open(f, 'wb').write(r.read())
        except Exception: return None
    return f

def best_original(path):
    base = re.sub(r'-\d+x\d+(?=\.)', '', path)
    found = []
    for c in dict.fromkeys([base, re.sub(r'\.webp$', '', base), base.replace('-edited', ''), path]):
        f = get(c)
        if f:
            try: found.append((Image.open(f).size[0] * Image.open(f).size[1], f))
            except Exception: pass
    return max(found)[1] if found else None

def resize(im, w, h):
    s = w / im.width
    if s <= 1:
        return im.resize((w, h), Image.LANCZOS, reducing_gap=3.0).filter(ImageFilter.UnsharpMask(radius=.6, percent=30, threshold=3))
    return im.filter(ImageFilter.GaussianBlur(.35)).resize((w, h), Image.BICUBIC)

def process(im, kind):
    if kind[0] == 'cover':                      # crop to aspect, then size (never enlarge past MAX_UP)
        tw, th = kind[1], kind[2]
        ar = tw / th
        if im.width / im.height > ar: cw, ch = round(im.height * ar), im.height
        else: cw, ch = im.width, round(im.width / ar)
        x = (im.width - cw) // 2; y = max(0, min(im.height - ch, int(im.height * .38 - ch / 2)))
        im = im.crop((x, y, x + cw, y + ch))
        s = min(tw / cw, MAX_UP)
        return resize(im, round(cw * s), round(ch * s))
    if kind[0] == 'square':
        s = min(kind[1] / im.width, MAX_UP)
        return resize(im, round(im.width * s), round(im.height * s))
    s = min(kind[1] / max(im.size), MAX_UP)
    return resize(im, round(im.width * s), round(im.height * s))

for name, (path, kind) in JOBS.items():
    f = best_original(path)
    if not f: print('MISSING', name); continue
    src = ImageOps.exif_transpose(Image.open(f))
    alpha = src.mode in ('RGBA', 'LA', 'P') and name.startswith(('svc-', 'award'))
    im = process(src.convert('RGBA' if alpha else 'RGB'), kind)
    o = os.path.join(OUT, name + '.webp')
    im.save(o, 'WEBP', quality=90, method=6)
    print(f'{name:18} {src.width}x{src.height} -> {im.width}x{im.height}')
