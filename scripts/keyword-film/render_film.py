#!/usr/bin/env python3
"""Render an original 50-second motion-design film from YEARLY_KEYWORDS.

Requires Pillow, FFmpeg, and macOS system fonts (or --font-dir equivalents).
No stock footage, external images, or generated personal facts are used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import re
import subprocess
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'keyword-film'
WORK = ROOT / '.film-work'
W, H, FPS, DURATION = 1920, 1080, 30, 50
INK = '#493b31'
MUTED = '#8b7b6b'
RUST = '#a66445'
PAPER = '#f2ecdf'
SAGE = '#7c876c'
SERIF = '/System/Library/Fonts/Supplemental/Songti.ttc'
LATIN = '/System/Library/Fonts/Supplemental/Baskerville.ttc'
SANS = '/System/Library/Fonts/Avenir Next.ttc'

source = (ROOT / 'src/data/portfolio.ts').read_text()
block = source.split('export const YEARLY_KEYWORDS = [', 1)[1].split('] as const', 1)[0]
YEARS = sorted([(int(y), k) for y, k in re.findall(r"year:\s*(\d{4}),\s*keywords:\s*'([^']+)'", block)])
assert len(YEARS) == 6, 'Film duration/layout expects six source records; update chapters deliberately.'
STARTS = [0, 5, 11, 17, 23, 29, 35, 41]
ENDS = [5, 11, 17, 23, 29, 35, 41, 50]
ACCENTS = ['#a66445', '#b27149', '#8b8567', '#ae7653', '#9a7860', '#7f8a70', '#9e7154', '#a66445']


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def rgb(c):
    return tuple(bytes.fromhex(c.lstrip('#')))


@lru_cache(maxsize=100)
def font(size, face='serif', weight=0):
    path, idx = (SERIF, 1 if weight else 3) if face == 'serif' else ((LATIN, weight) if face == 'latin' else (SANS, 2))
    return ImageFont.truetype(path, size, index=idx)


@lru_cache(maxsize=300)
def label(text, size, color=INK, face='serif', weight=0):
    f = font(size, face, weight)
    box = f.getbbox(text)
    im = Image.new('RGBA', (max(1, box[2] - box[0] + 10), box[3] - box[1] + 10))
    ImageDraw.Draw(im).text((5 - box[0], 5 - box[1]), text, font=f, fill=color)
    return im


def put(im, text, x, y, size, color=INK, face='serif', weight=0, alpha=1, center=False):
    sprite = label(text, size, color, face, weight)
    if alpha < 1:
        sprite = sprite.copy()
        sprite.putalpha(sprite.getchannel('A').point(lambda a: round(a * clamp(alpha))))
    if center:
        x -= sprite.width / 2
    im.paste(sprite, (round(x), round(y)), sprite)


def line(draw, points, color=RUST, width=3):
    draw.line(points, fill=color, width=width, joint='curve')


def arc(draw, box, start, end, fill=RUST, width=3):
    draw.arc(box, start, end, fill=fill, width=width)


def leaf(draw, x, y, angle, length=50, color=SAGE):
    # A pointed, asymmetric botanical leaf, constructed from two curves.
    points = []
    for side in (1, -1):
        steps = range(21) if side == 1 else range(20, -1, -1)
        for n in steps:
            t = n / 20
            px = length * t
            py = side * math.sin(math.pi * t) * length * .22
            points.append((x + px * math.cos(angle) - py * math.sin(angle), y + px * math.sin(angle) + py * math.cos(angle)))
    draw.polygon(points, fill=color)


def branch(draw, x, y, scale=1, flip=1):
    points = [(x, y), (x + 14 * flip * scale, y - 85 * scale), (x + 4 * flip * scale, y - 170 * scale), (x + 30 * flip * scale, y - 245 * scale)]
    line(draw, points, '#82775d', max(2, int(3 * scale)))
    for n, (dx, dy) in enumerate([(12, 50), (10, 99), (7, 150), (20, 205)]):
        leaf(draw, x + dx * flip * scale, y - dy * scale, (-.65 if n % 2 == 0 else -2.5) * flip, (56 - n * 3) * scale)


@lru_cache(maxsize=8)
def artwork(chapter):
    """Original vector-like paper illustration, animated by the compositor."""
    im = Image.new('RGBA', (760, 760))
    d = ImageDraw.Draw(im)
    # Rounded arch: a recurring window through the years.
    d.rounded_rectangle((100, 55, 660, 710), radius=280, fill='#e7dbc5')
    d.rectangle((100, 360, 660, 710), fill='#e7dbc5')
    d.ellipse((186, 102, 578, 494), fill='#e1bf91')
    d.ellipse((234, 151, 528, 445), fill='#ecca9c')
    d.polygon([(100, 575), (260, 492), (428, 557), (660, 452), (660, 710), (100, 710)], fill='#d8cfb6')
    d.polygon([(100, 643), (331, 564), (493, 608), (660, 542), (660, 710), (100, 710)], fill='#bdbea4')
    c = '#926e51'
    if chapter in (0, 1):
        # Home, with a warm window. No claim about any real residence.
        d.polygon([(212, 390), (380, 238), (548, 390), (548, 644), (212, 644)], fill='#f4e8d2')
        line(d, [(182, 410), (380, 230), (576, 410)], c, 5)
        line(d, [(213, 387), (213, 644), (548, 644), (548, 387)], c, 4)
        d.rounded_rectangle((320, 418, 438, 644), radius=59, fill='#c4a47c', outline=c, width=3)
        d.rectangle((321, 480, 437, 643), fill='#c4a47c')
        d.rectangle((245, 450, 294, 518), fill='#e6c48e', outline=c, width=3)
        line(d, [(268, 450), (268, 518)], c, 2)
        line(d, [(245, 484), (294, 484)], c, 2)
        branch(d, 590, 685, .8, -1)
        line(d, [(167, 660), (596, 660)], c, 2)
    elif chapter == 2:
        # A clock without a date or biographical claim.
        d.ellipse((181, 207, 579, 605), fill='#f1e7d4', outline=c, width=4)
        d.ellipse((200, 226, 560, 586), outline='#c6b494', width=2)
        for n in range(12):
            a = n * math.tau / 12 - math.pi / 2
            line(d, [(380 + 157 * math.cos(a), 406 + 157 * math.sin(a)), (380 + 172 * math.cos(a), 406 + 172 * math.sin(a))], c, 3)
        line(d, [(380, 406), (380, 298)], c, 5)
        line(d, [(380, 406), (473, 452)], c, 4)
        d.ellipse((372, 398, 388, 414), fill=c)
        branch(d, 602, 682, .8, -1)
        arc(d, (153, 178, 607, 632), 30, 128, '#ab835b', 2)
    elif chapter == 3:
        # Open doorway and a path toward light.
        d.rounded_rectangle((246, 203, 511, 630), radius=133, fill='#f6ead2', outline=c, width=4)
        d.rectangle((248, 338, 509, 630), fill='#f6ead2')
        d.polygon([(248, 340), (380, 377), (380, 666), (248, 630)], fill='#c5ae88', outline=c, width=3)
        d.ellipse((350, 494, 360, 504), fill=c)
        d.ellipse((407, 299, 484, 376), fill='#dcac6d')
        for i in range(5):
            yy = 630 + i * 17
            line(d, [(382 - i * 16, yy), (511 + i * 16, yy)], c, 2)
        branch(d, 182, 676, .6, 1)
    elif chapter == 4:
        # Tree and concentric growth rings: inheritance and rhythm.
        d.ellipse((208, 190, 552, 534), fill='#d9c4a0')
        for r in [55, 87, 120, 151, 171]:
            arc(d, (380-r, 362-r, 380+r, 362+r), 0, 335, '#a78b65', 2)
        line(d, [(380, 650), (380, 360), (362, 278)], c, 6)
        for x, y, xx, yy in [(380, 460, 280, 370), (380, 405, 469, 308), (380, 535, 491, 454), (380, 370, 316, 308)]:
            line(d, [(x, y), (xx, yy)], c, 3)
            leaf(d, xx, yy, -.75 if xx>380 else -2.5, 68, '#8e9878')
            leaf(d, xx+(x-xx)*.35, yy+(y-yy)*.35, -.3 if xx>380 else -2.8, 51, '#a4aa89')
        line(d, [(285, 652), (475, 652)], c, 3)
    elif chapter == 5:
        # Three points connected like a constellation; growth stays organic.
        nodes = [(246, 448), (382, 277), (524, 448)]
        line(d, [nodes[0], nodes[1], nodes[2], nodes[0]], '#b99a72', 3)
        for x, y in nodes:
            d.ellipse((x-56, y-56, x+56, y+56), fill='#f0e4cd', outline=c, width=3)
            d.ellipse((x-11, y-11, x+11, y+11), fill='#bb946a')
        branch(d, 380, 668, .65, 1)
        arc(d, (165, 177, 597, 609), 8, 75, c, 2)
        arc(d, (165, 177, 597, 609), 138, 232, c, 2)
    else:
        # A small, tangible object taking shape: a seed, an idea, an MVP.
        d.ellipse((247, 200, 513, 466), fill='#f1ddba')
        points = [(380, 305), (528, 391), (528, 560), (380, 645), (233, 560), (233, 391)]
        d.polygon(points, fill='#e9d5b6', outline=c, width=4)
        d.polygon([(380, 476), (528, 391), (528, 560), (380, 645)], fill='#c3af89')
        line(d, [(233, 391), (380, 476), (528, 391)], c, 3)
        line(d, [(380, 476), (380, 645)], c, 3)
        d.ellipse((354, 369, 406, 421), fill='#ae7852')
        for a in range(0, 360, 45):
            r = math.radians(a)
            line(d, [(380+175*math.cos(r), 367+175*math.sin(r)), (380+190*math.cos(r), 367+190*math.sin(r))], '#b79165', 2)
        branch(d, 591, 688, .65, -1)
    return im


def make_background():
    base = Image.new('RGB', (W, H), PAPER)
    glow = Image.new('RGB', (W//4, H//4), PAPER)
    d = ImageDraw.Draw(glow)
    d.ellipse((205, -80, 600, 265), fill='#ead9ba')
    d.ellipse((-150, 135, 145, 500), fill='#e7decb')
    glow = glow.filter(ImageFilter.GaussianBlur(55)).resize((W,H), Image.Resampling.BICUBIC)
    base = Image.blend(base, glow, .85)
    random.seed(81023)
    noise = Image.new('L', (W, H))
    noise.putdata(random.choices(range(112, 144), k=W*H))
    grain = Image.merge('RGB', (noise, noise, noise))
    return Image.blend(base, grain, .045)


BACKGROUND = make_background()


def timeline(im, active, progress, reveal=1):
    d = ImageDraw.Draw(im)
    left, right, y = 134, 1786, 922
    line(d, [(left,y), (right,y)], '#ccbfaa', 2)
    if active >= 0:
        x = left + (YEARS[active][0] - 2020) / 6 * (right-left)
        line(d, [(left,y),(x,y)], RUST, 3)
    for i,(yr,_) in enumerate(YEARS):
        x = left + (yr-2020)/6*(right-left)
        selected = i == active
        color = RUST if i <= active else '#b5a48b'
        d.ellipse((x-5,y-5,x+5,y+5), fill=color)
        if selected:
            d.ellipse((x-13,y-13,x+13,y+13), outline=RUST, width=2)
            arc(d,(x-18,y-18,x+18,y+18),-90,-90+359*progress,RUST,2)
        put(im,str(yr),x,950,25,color,'sans',center=True)


def header(im, chapter):
    put(im, 'ZHANGMIN.NAME', 116, 65, 25, INK, 'sans')
    put(im, '年 度 手 记', 425, 64, 25, MUTED)
    put(im, '2020 — 2026', 1584, 66, 23, MUTED, 'sans')
    d=ImageDraw.Draw(im)
    line(d,[(120,124),(1800,124)],'#cfc2ae',2)
    put(im,'把日子，写成关键词。',117,1010,21,MUTED)
    put(im,f'{chapter:02d} / 06' if 1<=chapter<=6 else 'A PERSONAL JOURNEY',1580,1012,20,MUTED,'sans')


def particles(im, t, n=13):
    d=ImageDraw.Draw(im)
    for i in range(n):
        x=1180+((i*113.73+math.sin(t*.14+i)*21)%610)
        y=170+((i*79.21-t*(2+i%3))%650)
        rr=1.2+(i%3)*.5
        d.ellipse((x-rr,y-rr,x+rr,y+rr), fill='#c3b18e')


def scene(idx, local, global_t):
    im=BACKGROUND.copy()
    header(im,idx)
    enter=ease(local/.95)
    drift=math.sin(local*.23)*7
    if idx==0:
        art=artwork(0)
        im.paste(art,(1078,170+round(drift)),art)
        put(im,'岁 月 有 迹',128,231,31,RUST,alpha=enter)
        put(im,'把日子，',121,334+30*(1-enter),112,INK,weight=1,alpha=enter)
        a=ease((local-.3)/1.1)
        put(im,'写成关键词。',121,487+30*(1-a),112,INK,weight=1,alpha=a)
        put(im,'六个年份，一路生长。',128,687,38,MUTED,alpha=ease((local-.8)/1.2))
        put(im,'2020 — 2026',131,785,30,RUST,'sans',alpha=ease((local-1.2)/1.1))
        timeline(im,-1,0)
    elif idx<=6:
        yr,words=YEARS[idx-1]
        put(im,f'第 {"一二三四五六"[idx-1]} 页',126,189,29,ACCENTS[idx],alpha=enter)
        put(im,str(yr),115,260+22*(1-enter),236,INK,'latin',alpha=enter)
        d=ImageDraw.Draw(im)
        line(d,[(129,525),(129+round(110*enter),525)],ACCENTS[idx],4)
        x=124
        items=words.split(' ')
        maxsize=62 if yr==2021 else 78
        for j,word in enumerate(items):
            a=ease((local-.45-j*.25)/.95)
            face='sans' if word in ['7','Agent','MVP'] else 'serif'
            sp=label(word,maxsize,INK,face,0)
            put(im,word,x,591+25*(1-a),maxsize,INK,face,alpha=a)
            x+=sp.width+30
            if j<2:
                put(im,'·',x-10,603,45,ACCENTS[idx],face='latin',alpha=a)
                x+=40
        put(im,'年 度 关 键 词',128,738,27,MUTED,alpha=ease((local-1.35)/1))
        art=artwork(idx)
        # Slow scale and drift give the paper illustration room to breathe.
        size=round(734+local*2.8)
        art=art.resize((size,size),Image.Resampling.BICUBIC)
        im.paste(art,(1092-(size-734)//2,161+round(drift)-(size-734)//2),art)
        timeline(im,idx-1,clamp(local/6))
    else:
        put(im,'一 路 走 来',123,199,29,RUST,alpha=enter)
        put(im,'行胜于言',117,291+25*(1-enter),128,INK,weight=1,alpha=enter)
        put(im,'让每一个关键词，慢慢成为生活。',124,487,45,MUTED,alpha=ease((local-.5)/1.1))
        # Final spread includes all six original records, retaining the source order in time.
        for i,(yr,words) in enumerate(YEARS):
            row,col=divmod(i,2)
            x=130+col*855
            y=616+row*78
            a=ease((local-.85-i*.13)/.85)
            put(im,str(yr),x,y,31,RUST,'sans',alpha=a)
            put(im,words,x+113,y-2,32,INK,alpha=a)
        # A quiet sun in the top-right margin.
        d=ImageDraw.Draw(im)
        d.ellipse((1556,210,1696,350),fill='#dcc09a')
        arc(d,(1518,172,1734,388),0,350,'#c6ad87',2)
        branch(d,1784,511,.67,-1)
        timeline(im,5,1)
    particles(im,global_t)
    return im


def frame(t):
    idx=max(i for i,s in enumerate(STARTS) if t>=s)
    current=scene(idx,t-STARTS[idx],t)
    # Warm, restrained dissolve preserves legibility and avoids hard cuts.
    if idx>0 and t-STARTS[idx]<.65:
        prev=scene(idx-1,t-STARTS[idx-1],t)
        current=Image.blend(prev,current,smooth((t-STARTS[idx])/.65))
    if t<.65:
        current=Image.blend(BACKGROUND,current,smooth(t/.65))
    return current


def write_metadata():
    chapters=[{'start':0,'end':5,'title':'把日子，写成关键词。'}]
    chapters += [{'start':STARTS[i+1],'end':ENDS[i+1],'year':yr,'keywords':words,'title':f'{yr} · {words}'} for i,(yr,words) in enumerate(YEARS)]
    chapters += [{'start':41,'end':50,'title':'行胜于言'}]
    data={'title':'把日子，写成关键词。','duration':50,'width':W,'height':H,'fps':FPS,'source':'https://zhangmin.name/','sourceFile':'src/data/portfolio.ts','sourceVerifiedAt':'2026-11-11','sourceNote':'年度关键词已与网站公开 JS 数据核对一致。2023 无记录；2024 真行及 2020 数字 7 均保留原文。','style':'温暖的人生回顾','chapters':chapters,'audio':'Original synthesized instrumental; no external recordings.','artwork':'Original programmatic paper illustrations; symbolic, not documentary.','video':'keywords-2020-2026.mp4'}
    (OUT/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    def stamp(t):return f'00:{t//60:02d}:{t%60:02d}.000'
    captions='WEBVTT\n\n'
    for i,c in enumerate(chapters):
        captions+=f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["title"]}\n\n'
    (OUT/'captions.vtt').write_text(captions.rstrip() + '\n')


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--preview',action='store_true')
    p.add_argument('--silent',action='store_true')
    p.add_argument('--font-dir',type=Path,help='Folder containing Songti.ttc, Baskerville.ttc, Avenir Next.ttc')
    args=p.parse_args()
    global SERIF,LATIN,SANS
    if args.font_dir:
        SERIF=str(args.font_dir/'Songti.ttc');LATIN=str(args.font_dir/'Baskerville.ttc');SANS=str(args.font_dir/'Avenir Next.ttc')
    OUT.mkdir(parents=True,exist_ok=True)
    WORK.mkdir(parents=True,exist_ok=True)
    write_metadata()
    frame(3.5).save(OUT/'poster.jpg',quality=94,subsampling=0)
    for t in [3.5,8,14,20,26,32,38,46]:
        frame(t).resize((960,540),Image.Resampling.LANCZOS).save(WORK/f'preview-{t:g}.jpg',quality=92)
    if args.preview:return
    audio=WORK/'soundtrack.wav'
    if not args.silent and not audio.exists():
        raise SystemExit('Missing soundtrack.wav. Run compose_audio.py first, or pass --silent.')
    target=OUT/'keywords-2020-2026.mp4'
    cmd=['ffmpeg','-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0']
    if not args.silent:cmd+=['-i',str(audio)]
    cmd+=['-c:v','libx264','-preset','fast','-crf','21','-profile:v','high','-level','4.1','-pix_fmt','yuv420p','-g','60','-keyint_min','30','-vf','setsar=1','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709']
    if not args.silent:cmd+=['-c:a','aac','-b:a','160k','-ar','48000']
    cmd+=['-t',str(DURATION),'-movflags','+faststart','-metadata','title=把日子，写成关键词。','-metadata','artist=zhangmin.name',str(target)]
    with (WORK/'render.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        try:
            for n in range(DURATION*FPS):
                proc.stdin.write(frame(n/FPS).tobytes())
                if n%(FPS*5)==0:print(f'Rendered {n//FPS:02d}/{DURATION}s',flush=True)
        finally:
            proc.stdin.close()
        code=proc.wait()
        if code:raise SystemExit(f'FFmpeg failed ({code}); see {WORK}/render.log')
    print(f'Created {target} ({target.stat().st_size/1024/1024:.2f} MiB)',flush=True)


if __name__=='__main__':main()
