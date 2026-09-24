# -*- coding: utf-8 -*-
"""
金陵寻踪 · 素材处理脚本
把「人物素材」里的原始图片处理成游戏内使用的资源（输出到 src/assets/）：
  - title.jpg            标题画面（01 人物近景）
  - portrait_*.jpg       对话立绘（03 多角度与表情里的六张特写）
  - body_front/back.jpg  全身像（03）
  - outfit_front.jpg     霓裳造型（02 服装参考正面）
  - kangye_sheet.png     像素精灵表（04 像素形象：抠图、行走帧、背面、霓裳变体）
运行：python tools/process_assets.py
"""
import os
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '人物素材')
OUT = os.path.join(ROOT, 'src', 'assets')
DEBUG = os.environ.get('JL_DEBUG_DIR')  # 可选：输出放大预览图
os.makedirs(OUT, exist_ok=True)


def save_jpg(img, name, q=85):
    p = os.path.join(OUT, name)
    img.convert('RGB').save(p, 'JPEG', quality=q, optimize=True, progressive=True)
    print(f'  {name:24s} {img.size[0]}x{img.size[1]}  {os.path.getsize(p) // 1024} KB')


# ---------------------------------------------------------------- 照片类素材
def process_photos():
    print('照片素材:')
    im1 = Image.open(os.path.join(SRC, '01_人物近景.png')).convert('RGB')
    save_jpg(im1.resize((1920, 1079), Image.LANCZOS), 'title.jpg', 80)

    im3 = Image.open(os.path.join(SRC, '03_多角度与表情.png')).convert('RGB')
    boxes = {
        'portrait_front': (1076, 40, 1392, 540),
        'portrait_34': (1400, 40, 1724, 540),
        'portrait_side': (1740, 40, 2048, 540),
        'portrait_smile': (1380, 596, 1696, 1040),
        'portrait_serious': (1716, 596, 2016, 1040),
        'portrait_back': (1078, 596, 1370, 1040),
    }
    for name, b in boxes.items():
        c = im3.crop(b)
        h = 440
        w = round(c.size[0] * h / c.size[1])
        save_jpg(c.resize((w, h), Image.LANCZOS), name + '.jpg', 86)

    for name, b in {'body_front': (20, 90, 410, 1045), 'body_back': (690, 90, 1056, 1045)}.items():
        c = im3.crop(b)
        h = 720
        w = round(c.size[0] * h / c.size[1])
        save_jpg(c.resize((w, h), Image.LANCZOS), name + '.jpg', 84)

    im2 = Image.open(os.path.join(SRC, '02_服装参考.png')).convert('RGB')
    c = im2.crop((0, 290, 600, 2000))
    save_jpg(c.resize((420, round(420 * c.size[1] / c.size[0])), Image.LANCZOS), 'outfit_front.jpg', 86)


# ---------------------------------------------------------------- 像素精灵
def lum(p):
    return 0.299 * p[..., 0] + 0.587 * p[..., 1] + 0.114 * p[..., 2]


def cut_background(a, thr=244):
    H, W, _ = a.shape
    bg = np.zeros((H, W), bool)
    q = deque()
    light = a.min(axis=2) >= thr
    for x in range(W):
        for y in (0, H - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and not bg[ny, nx] and light[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    return ~bg


def clean_fringe(a, fg):
    """去掉头发边缘的白色描边（抗锯齿残留），保留白色衣袍的边缘。"""
    H, W, _ = a.shape
    L = lum(a.astype(float))
    for _ in range(3):
        remove = []
        for y in range(H):
            for x in range(W):
                if not fg[y, x]:
                    continue
                edge = False
                dark = lightn = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dy == 0 and dx == 0:
                            continue
                        ny, nx = y + dy, x + dx
                        if not (0 <= ny < H and 0 <= nx < W) or not fg[ny, nx]:
                            if abs(dy) + abs(dx) == 1:
                                edge = True
                            continue
                        if L[ny, nx] < 90:
                            dark += 1
                        elif L[ny, nx] > 185:
                            lightn += 1
                if edge and L[y, x] > 120 and dark >= 2 and lightn <= 1:
                    remove.append((y, x))
        for y, x in remove:
            fg[y, x] = False
        if not remove:
            break
    # 零星的绿色杂点
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    stray = (g > r + 25) & (g > b + 10)
    fg &= ~stray
    return fg


def hsv(a):
    rgb = a.astype(float) / 255.0
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r)
    gm = m & (mx == g) & ~rm
    bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = ((b - r)[gm] / d[gm]) + 2
    h[bm] = ((r - g)[bm] / d[bm]) + 4
    return h * 60.0, s, mx


FW, FH = 64, 132  # 单帧尺寸（顶部留出霓裳头冠的空间）


def to_frame(rgba, ox, oy):
    fr = np.zeros((FH, FW, 4), np.uint8)
    h, w, _ = rgba.shape
    for y in range(h):
        ty = y + oy
        if not (0 <= ty < FH):
            continue
        for x in range(w):
            tx = x + ox
            if 0 <= tx < FW and rgba[y, x, 3]:
                fr[ty, tx] = rgba[y, x]
    return fr


HAIR_DARK = np.array([22, 19, 20])
HAIR_MID = np.array([44, 39, 40])
HAIR_HI = np.array([78, 72, 74])


def make_back(fr):
    """由正面像素画推导背面：脸部换成头发，背后加长发，去掉前襟细节。"""
    b = fr.copy()
    alpha = b[..., 3] > 0
    L = lum(b[..., :3].astype(float))
    h, s, v = hsv(b[..., :3])
    ys, xs = np.where(alpha)
    top = ys.min()
    # 以鞋子（最低几行）估计身体中线
    cx = int(round(xs[ys >= ys.max() - 6].mean()))
    neck = top + 50  # 下巴/脖颈大致位置

    def hair_px(x, y, sheen_row=None):
        strand = (x + (y // 11)) % 4
        col = HAIR_MID if strand == 0 else HAIR_DARK
        if sheen_row is not None and abs(y - sheen_row) <= 2 and (x + y) % 3 != 0:
            col = HAIR_HI
        return col

    # 1) 头部：非深色像素全部改成头发（竖向发丝 + 一道弧形光泽）
    for y in range(top, neck + 1):
        for x in range(FW):
            if not alpha[y, x]:
                continue
            if L[y, x] > 70 or s[y, x] > 0.25:
                b[y, x, :3] = hair_px(x, y, sheen_row=top + 12 + abs(x - cx) // 4)
    # 2) 发髻（半披发的结）
    ky = top + 27
    for dy in range(-3, 4):
        for dx in range(-4, 5):
            if dx * dx / 16 + dy * dy / 9 <= 1.0:
                b[ky + dy, cx + dx, :3] = HAIR_HI if (dy == -2 and abs(dx) < 3) else HAIR_MID
                b[ky + dy, cx + dx, 3] = 255
    for dx in range(-2, 3):  # 白色发带
        b[ky + 4, cx + dx, :3] = (236, 232, 226)
    # 3) 背后长发：从颈部垂到腰臀，末端圆收，两侧 1px 深色描边
    hair_end = top + 84
    for y in range(neck - 2, hair_end + 1):
        t = (y - neck) / max(1, hair_end - neck)
        half = 10.5 - 2.5 * t
        if t > 0.82:
            k = (t - 0.82) / 0.18
            half *= max(0.2, (1 - k * k) ** 0.5)
        x0, x1 = int(round(cx - half)), int(round(cx + half))
        for x in range(x0, x1 + 1):
            if 0 <= x < FW and alpha[y, x]:
                col = hair_px(x, y)
                if x in (x0, x1):
                    col = (HAIR_DARK * 0.7).astype(int)
                elif (x * 7 + y * 3) % 29 == 0:
                    col = HAIR_HI
                b[y, x, :3] = col
    # 4) 下摆前襟的金色竖线改成白色袍面
    gold = (h > 28) & (h < 60) & (s > 0.22) & (v > 0.4)
    for y in range(hair_end + 1, FH):
        for x in range(FW):
            if alpha[y, x] and gold[y, x] and abs(x - cx) < 12:
                b[y, x, :3] = (238, 236, 234) if (x + y) % 5 else (224, 221, 220)
    return b


def make_nishang(fr, back=False):
    """霓裳造型（参考 02）：金饰换银蓝、白袍带冷色、蓝色内裙、银冠与流苏。"""
    n = fr.copy()
    alpha = n[..., 3] > 0
    h, s, v = hsv(n[..., :3])
    rgb = n[..., :3].astype(float)
    L = lum(rgb)
    ys, xs = np.where(alpha)
    top = ys.min()
    cx = int(round(xs[ys >= ys.max() - 6].mean()))
    body = np.zeros_like(alpha)
    body[top + 46:, :] = True  # 只处理衣袍（颈部以下），不碰脸和手以外的部分
    skin = (h > 8) & (h < 38) & (s > 0.07) & (s < 0.42) & (v > 0.78)
    gold = alpha & body & (h > 28) & (h < 60) & (s > 0.22) & (v > 0.4)
    whiteish = alpha & body & ~skin & (s < 0.14) & (v > 0.55)
    # 金 → 银蓝
    t = (L[gold] / 255.0)[:, None]
    rgb[gold] = t * np.array([235, 242, 255]) * 1.02 + (1 - t) * np.array([120, 136, 170])
    # 白袍 → 冷白，阴影偏蓝
    t = (L[whiteish] / 255.0)[:, None]
    rgb[whiteish] = t * np.array([246, 249, 255]) + (1 - t) * np.array([150, 170, 205])
    n[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    # 蓝色内裙（下摆中间）
    if not back:
        for y in range(top + 86, FH):
            for x in range(cx - 6, cx + 7):
                if alpha[y, x] and whiteish[y, x]:
                    c = n[y, x, :3].astype(float)
                    n[y, x, :3] = (c * 0.45 + np.array([168, 196, 236]) * 0.55).astype(np.uint8)
    # 银冠
    crown = [
        "......W......",
        ".....WBW.....",
        "..W..WBW..W..",
        ".WSW.WSW.WSW.",
        "WSSSWSSSWSSSW",
        "SSSSSSSSSSSSS",
        ".ooooooooooo.",
    ]
    pal = {'W': (248, 252, 255), 'S': (196, 208, 232), 'B': (110, 170, 250), 'o': (120, 134, 170)}
    cy0 = top - 4
    for r, row in enumerate(crown):
        for c, ch in enumerate(row):
            if ch == '.':
                continue
            x = cx - 6 + c
            y = cy0 + r
            if 0 <= y < FH and 0 <= x < FW:
                n[y, x, :3] = pal[ch]
                n[y, x, 3] = 255
    # 两侧流苏
    for sx in (cx - 17, cx + 17):
        for y in range(top + 12, top + 34):
            if 0 <= sx < FW:
                if y % 3 != 2:
                    n[y, sx, :3] = (226, 234, 250) if y % 3 == 0 else (160, 176, 210)
                    n[y, sx, 3] = 255
        y = top + 34
        n[y, sx, :3] = (120, 180, 250)
        n[y, sx, 3] = 255
    return n


def walk_variants(fr):
    """生成左右迈步帧：下摆左右摆动 1px，一只鞋前踏、一只抬起。"""
    alpha = fr[..., 3] > 0
    ys, xs = np.where(alpha)
    bottom = ys.max()
    cx = int(round(xs[ys >= bottom - 6].mean()))
    hem_top = bottom - 16
    frames = []
    for side in (-1, 1):
        f = fr.copy()
        # 下摆整体摆动
        seg = fr[hem_top:bottom - 5].copy()
        f[hem_top:bottom - 5] = 0
        shifted = np.zeros_like(seg)
        if side < 0:
            shifted[:, :-1] = seg[:, 1:]
        else:
            shifted[:, 1:] = seg[:, :-1]
        f[hem_top:bottom - 5] = shifted
        # 鞋子：迈出的那只下移 1px，另一只上收 2px（被裙摆遮住）
        feet = fr[bottom - 5:bottom + 1].copy()
        f[bottom - 5:bottom + 1] = 0
        # 先把上移的鞋画在后面
        for y in range(feet.shape[0]):
            for x in range(FW):
                if feet[y, x, 3] == 0:
                    continue
                left_foot = x < cx
                stepping = (left_foot and side < 0) or ((not left_foot) and side > 0)
                ty = bottom - 5 + y + (1 if stepping else -2)
                if 0 <= ty < FH:
                    if stepping or f[ty, x, 3] == 0:
                        f[ty, x] = feet[y, x]
        frames.append(f)
    return frames


def process_sprite():
    print('像素精灵:')
    src = Image.open(os.path.join(SRC, '04_像素形象.png')).convert('RGB')
    a = np.asarray(src).astype(np.uint8)
    fg = cut_background(a)
    fg = clean_fringe(a, fg)
    rgba = np.zeros((a.shape[0], a.shape[1], 4), np.uint8)
    rgba[..., :3] = a
    rgba[..., 3] = np.where(fg, 255, 0)
    ys, xs = np.where(fg)
    bottom = ys.max()
    cx = xs[ys >= bottom - 6].mean()
    ox = int(round(FW / 2 - cx))
    oy = (FH - 2) - bottom
    front = to_frame(rgba, ox, oy)
    back = make_back(front)
    rows = []
    for base, is_back in ((front, False), (back, True)):
        wl, wr = walk_variants(base)
        rows.append([base, wl, wr])
    for base, is_back in ((front, False), (back, True)):
        ns = make_nishang(base, back=is_back)
        wl, wr = walk_variants(ns)
        rows.append([ns, wl, wr])
    sheet = np.zeros((FH * len(rows), FW * 3, 4), np.uint8)
    for r, row in enumerate(rows):
        for c, f in enumerate(row):
            sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = f
    img = Image.fromarray(sheet, 'RGBA')
    p = os.path.join(OUT, 'kangye_sheet.png')
    img.save(p, optimize=True)
    print(f'  kangye_sheet.png         {img.size[0]}x{img.size[1]}  ({FW}x{FH} x 3列 x 4行)  {os.path.getsize(p) // 1024} KB')
    if DEBUG:
        bgc = Image.new('RGBA', img.size, (46, 62, 88, 255))
        bgc.alpha_composite(img)
        bgc.resize((img.size[0] * 4, img.size[1] * 4), Image.NEAREST).save(os.path.join(DEBUG, 'sheet_x4.png'))


if __name__ == '__main__':
    process_photos()
    process_sprite()
    print('完成 →', OUT)
