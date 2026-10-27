# Six candidate sound logos for MN: a short notification version and a longer in-app version of each.
import numpy as np, wave, os
from scipy.signal import fftconvolve, butter, lfilter
SR = 44100
rng = np.random.default_rng(7)
def t_(d): return np.arange(int(SR * d)) / SR
def note(f): return 440 * 2 ** ((f - 69) / 12)   # midi -> Hz
def env(n, a=0.004, d=0.4, curve=6):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) * np.exp(-curve * t / max(d, 1e-3))
    return e
def marimba(m, dur=0.6, vel=1.0):
    f = note(m); t = t_(dur)
    s = np.sin(2*np.pi*f*t) + 0.35*np.sin(2*np.pi*f*4*t)*np.exp(-t*30) + 0.15*np.sin(2*np.pi*f*10*t)*np.exp(-t*60)
    return vel * s * env(len(t), 0.002, dur, 7)
def bell(m, dur=1.4, vel=1.0):
    f = note(m); t = t_(dur)
    parts = [(1, 1, 3), (2.0, .5, 4), (2.76, .35, 6), (5.4, .2, 10), (8.9, .08, 16)]
    s = sum(a*np.sin(2*np.pi*f*r*t)*np.exp(-k*t/dur*1.6) for r, a, k in parts)
    return vel * s * np.minimum(1, t/0.002) * 0.6
def xylo(m, dur=0.35, vel=1.0):
    f = note(m); t = t_(dur)
    s = np.sin(2*np.pi*f*t) + 0.5*np.sin(2*np.pi*f*3*t)*np.exp(-t*40)
    return vel * s * env(len(t), 0.001, dur, 9)
def pluck(m, dur=0.5, vel=1.0):
    f = note(m); t = t_(dur)
    s = sum((0.6**k) * np.sin(2*np.pi*f*(k+1)*t) * np.exp(-t*(6+k*6)) for k in range(6))
    return vel * s * np.minimum(1, t/0.003)
def warm(m, dur=0.5, vel=1.0):
    f = note(m); t = t_(dur)
    vib = 1 + 0.004*np.sin(2*np.pi*5.5*t)
    s = sum((0.5**k)*np.sin(2*np.pi*f*(k+1)*vib*t) for k in range(5))
    a = np.minimum(1, t/0.03) * np.minimum(1, (dur - t)/0.12).clip(0, 1)
    return vel * s * a * 0.55
def sparkle(dur=0.5, start=88, n=7, vel=0.25, step=2):
    out = np.zeros(int(SR*dur) + SR)
    for k in range(n):
        s = xylo(start + (k*step) % 12, 0.25, vel*(1 - k/n*0.5))
        i = int(SR * dur * k / n)
        out[i:i+len(s)] += s
    return out
def whoosh(dur=0.5, f0=300, f1=3000, vel=0.25):
    n = int(SR*dur); noise = rng.standard_normal(n)
    out = np.zeros(n); chunk = 512
    for i in range(0, n, chunk):
        fc = f0 * (f1/f0) ** (i/n)
        b, a = butter(2, [max(50, fc*0.7)/(SR/2), min(0.99, fc*1.3/(SR/2))], btype='band')
        out[i:i+chunk] = lfilter(b, a, noise[i:i+chunk])
    e = np.sin(np.pi*np.arange(n)/n) ** 1.5
    return vel * out * e / (np.abs(out).max() + 1e-9)
def boing(dur=0.35, m=67, vel=0.5):
    t = t_(dur); f = note(m) * (1 + 0.6*np.exp(-t*18) * np.cos(2*np.pi*12*t))
    ph = 2*np.pi*np.cumsum(f)/SR
    return vel * np.sin(ph) * env(len(t), 0.002, dur, 6)
def place(events, total):
    out = np.zeros(int(SR*total) + SR*2)
    for at, s in events:
        i = int(SR*at); out[i:i+len(s)] += s
    return out
def room(x, wet=0.22, length=1.2):
    n = int(SR*length); ir = rng.standard_normal(n) * np.exp(-np.arange(n)/SR*5)
    b, a = butter(1, 3500/(SR/2)); ir = lfilter(b, a, ir); ir /= np.abs(ir).sum() ** 0.5 * 8
    L = fftconvolve(x, ir)[:len(x)]; R = fftconvolve(x, np.roll(ir, 211))[:len(x)]
    return np.stack([x + wet*L, x + wet*R], 1)
def finish(x, name, total):
    x = x[:int(SR*(total + 0.6))]
    st = room(x)
    fade = np.minimum(1, (len(st) - np.arange(len(st))) / (SR*0.25))
    st *= fade[:, None]
    st /= np.abs(st).max() / 0.89
    pcm = (st * 32767).astype('<i2')
    path = f'{name}.wav'
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    os.system(f'ffmpeg -loglevel error -y -i {path} -c:a libvorbis -q:a 5 {name}.ogg && ffmpeg -loglevel error -y -i {path} -b:a 160k {name}.mp3')

C4=60
designs = {}
# 1. Plus Pop: two bright marimba hits up a fifth, a pop and a sparkle on top.
designs['1-plus-pop'] = (
    lambda: place([(0, marimba(72, .5)), (0.11, marimba(79, .7)), (0.11, boing(.18, 91, .12)), (0.2, sparkle(.35, 91, 5, .18))], 1.0),
    lambda: place([(0, marimba(72, .5)), (0.11, marimba(79, .6)), (0.3, marimba(76, .5, .8)), (0.42, marimba(79, .5, .9)), (0.56, marimba(84, 1.2)), (0.56, marimba(76, 1.2, .5)), (0.56, marimba(72, 1.2, .5)), (0.62, sparkle(.6, 91, 7, .18))], 2.4),
)
# 2. Mission Chime: a bell arpeggio C-E-G-C, like "mission complete".
designs['2-mission-chime'] = (
    lambda: place([(0, bell(72, 1.0, .8)), (0.09, bell(76, 1.0, .8)), (0.18, bell(79, 1.2, .9))], 1.2),
    lambda: place([(0, bell(72, 1.4, .8)), (0.12, bell(76, 1.4, .8)), (0.24, bell(79, 1.4, .85)), (0.36, bell(84, 2.2, 1)), (0.36, bell(72, 2.2, .45)), (0.9, sparkle(.5, 96, 5, .12)), (0.0, warm(48, 2.2, .35)), (0.0, warm(55, 2.2, .25))], 2.8),
)
# 3. Number Hop: a counting "1-2-3" on xylophone that hops up and lands with a boing.
designs['3-number-hop'] = (
    lambda: place([(0, xylo(76, .3)), (0.1, xylo(79, .3)), (0.2, xylo(83, .3)), (0.32, boing(.4, 84, .55))], 0.9),
    lambda: place([(0, xylo(76)), (0.12, xylo(79)), (0.24, xylo(83)), (0.36, boing(.4, 84, .5)), (0.75, xylo(81)), (0.87, xylo(83)), (0.99, xylo(86)), (1.11, marimba(88, 1.0)), (1.11, marimba(84, 1.0, .5)), (1.2, sparkle(.5, 96, 6, .14))], 2.3),
)
# 4. Treasure Twinkle: falling coin sparkles that settle on a soft major chord.
designs['4-treasure-twinkle'] = (
    lambda: place([(0.0, sparkle(.4, 96, 6, .3, -2 % 12)), (0.32, bell(79, 1.0, .7)), (0.32, bell(84, 1.0, .5))], 1.2),
    lambda: place([(0.0, sparkle(.6, 98, 9, .3, 10)), (0.5, bell(76, 1.4, .6)), (0.62, bell(79, 1.4, .6)), (0.74, bell(84, 2.0, .8)), (0.74, warm(60, 1.8, .35)), (0.74, warm(64, 1.8, .25)), (1.4, sparkle(.4, 100, 4, .1))], 2.8),
)
# 5. Rocket Rise: a little whoosh up into a bright major chord ("Mission Next!").
designs['5-rocket-rise'] = (
    lambda: place([(0, whoosh(.35, 400, 4000, .22)), (0.28, pluck(72, .8)), (0.28, pluck(76, .8, .7)), (0.28, pluck(79, .8, .7)), (0.3, sparkle(.3, 96, 4, .12))], 1.1),
    lambda: place([(0, whoosh(.6, 250, 5000, .25)), (0.5, pluck(72, 1.0)), (0.5, pluck(76, 1.0, .7)), (0.5, pluck(79, 1.0, .7)), (0.82, pluck(74, .6, .8)), (0.94, pluck(79, .6, .8)), (1.06, pluck(84, 1.6)), (1.06, pluck(76, 1.6, .6)), (1.1, sparkle(.6, 96, 7, .14))], 2.7),
)
# 6. Plus Hello: a friendly "hel-lo!" on a warm synth (up a sixth), with a pluck on top.
designs['6-plus-hello'] = (
    lambda: place([(0, warm(67, .22, .9)), (0, pluck(79, .3, .25)), (0.2, warm(76, .5, 1)), (0.2, pluck(88, .5, .25))], 0.9),
    lambda: place([(0, warm(67, .22, .9)), (0.2, warm(76, .45, 1)), (0.2, pluck(88, .4, .2)), (0.7, warm(72, .2, .8)), (0.88, warm(74, .2, .8)), (1.06, warm(79, .8, 1)), (1.06, pluck(91, .8, .25)), (1.06, warm(64, .8, .5)), (1.15, sparkle(.4, 96, 5, .1))], 2.3),
)
os.chdir(os.path.dirname(os.path.abspath(__file__)))
for name, (short, long) in designs.items():
    finish(short(), f'{name}-notify', 1.25)
    finish(long(), f'{name}-long', 3.0)
print('ok')
