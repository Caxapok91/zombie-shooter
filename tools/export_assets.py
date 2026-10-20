"""Rebuild the browser build assets (docs/assets + docs/js/level.js) from the
pygame game data: maps/level1.tmx, img/, snd/, music/.

Usage (from the repository root or anywhere):

    pip install pygame pytmx
    python docs/tools/export_assets.py
"""
import os
import json
import shutil
import sys

os.environ.setdefault('SDL_VIDEODRIVER', 'dummy')
os.environ.setdefault('SDL_AUDIODRIVER', 'dummy')
os.environ.setdefault('PYGAME_HIDE_SUPPORT_PROMPT', '1')

import pygame as pg

TOOLS = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.dirname(TOOLS)
ROOT = os.path.dirname(DOCS)
sys.path.insert(0, ROOT)

IMG = os.path.join(DOCS, 'assets', 'img')
SND = os.path.join(DOCS, 'assets', 'snd')
MUS = os.path.join(DOCS, 'assets', 'music')
FNT = os.path.join(DOCS, 'assets', 'fonts')
JS = os.path.join(DOCS, 'js')
for directory in (IMG, SND, os.path.join(SND, 'pain'), MUS, FNT, JS):
    os.makedirs(directory, exist_ok=True)

pg.init()
pg.display.set_mode((64, 64))

from tilemap import TiledMap  # noqa: E402

# ---- map image ----
tm = TiledMap(os.path.join(ROOT, 'maps', 'level1.tmx'))
surf = tm.make_map()
pg.image.save(surf, os.path.join(DOCS, 'assets', 'map.png'))
print('map.png', surf.get_width(), surf.get_height())

# ---- sprites / fonts ----
IMG_MAP = {
    'manBlue_gun.png': 'player.png',
    'zombie1_hold.png': 'zombie.png',
    'bullet.png': 'bullet.png',
    'splat green.png': 'splat.png',
    'health_pack.png': 'health.png',
    'obj_shotgun.png': 'shotgun.png',
    'whitePuff15.png': 'flash1.png',
    'whitePuff16.png': 'flash2.png',
    'whitePuff17.png': 'flash3.png',
    'whitePuff18.png': 'flash4.png',
    'crosshair.png': 'crosshair.png',
}
for src, dst in IMG_MAP.items():
    shutil.copy2(os.path.join(ROOT, 'img', src), os.path.join(IMG, dst))

shutil.copy2(os.path.join(ROOT, 'img', 'ZOMBIE.TTF'), os.path.join(FNT, 'ZOMBIE.TTF'))
shutil.copy2(os.path.join(ROOT, 'img', 'Impacted2.0.ttf'), os.path.join(FNT, 'Impacted.ttf'))

# small bullet (the game scales the big one down to 10x10)
small = pg.transform.scale(
    pg.image.load(os.path.join(ROOT, 'img', 'bullet.png')).convert_alpha(), (10, 10))
pg.image.save(small, os.path.join(IMG, 'bullet_sm.png'))

# ---- sounds ----
SOUNDS = [
    'pistol.wav', 'shotgun.wav', 'brains2.wav', 'brains3.wav',
    'zombie-roar-1.wav', 'zombie-roar-2.wav', 'zombie-roar-3.wav',
    'zombie-roar-5.wav', 'zombie-roar-6.wav', 'zombie-roar-7.wav',
    'splat-15.wav', 'level_start.wav', 'health_pack.wav', 'gun_pickup.wav',
]
for name in SOUNDS:
    shutil.copy2(os.path.join(ROOT, 'snd', name), os.path.join(SND, name))
for name in ('8.wav', '9.wav', '10.wav', '11.wav'):
    shutil.copy2(os.path.join(ROOT, 'snd', 'pain', name), os.path.join(SND, 'pain', name))
shutil.copy2(os.path.join(ROOT, 'music', 'level_music.ogg'),
             os.path.join(MUS, 'level_music.ogg'))

# ---- level data ----
walls, zombies, items, player = [], [], [], None
for obj in tm.tmxdata.objects:
    cx = obj.x + obj.width / 2
    cy = obj.y + obj.height / 2
    if obj.name == 'wall':
        walls.append([obj.x, obj.y, obj.width, obj.height])
    elif obj.name == 'player':
        player = {'x': cx, 'y': cy}
    elif obj.name == 'zombie':
        zombies.append({'x': cx, 'y': cy})
    elif obj.name in ('health', 'shotgun'):
        items.append({'type': obj.name, 'x': cx, 'y': cy})

level = {
    'width': tm.width,
    'height': tm.height,
    'tilewidth': tm.tmxdata.tilewidth,
    'tileheight': tm.tmxdata.tileheight,
    'player': player,
    'zombies': zombies,
    'items': items,
    'walls': walls,
}
with open(os.path.join(JS, 'level.js'), 'w', encoding='utf-8') as f:
    f.write('window.LEVEL = ')
    json.dump(level, f, separators=(',', ':'))
    f.write(';\n')

print('player', player)
print('zombies', len(zombies), 'items', len(items), 'walls', len(walls))
print('done')
