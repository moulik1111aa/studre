# Blends of 1 (Plus Pop) and 2 (Mission Chime). Moulik picked 8, "Chime Pop", on 27 Oct: it is MN's sound logo
# (assets/audio/mn-logo.mp3 from 8-chime-pop-long, native/android/res/raw/mn_chime.ogg from 8-chime-pop-notify).
import os, sys
sys.argv = ['x']
exec(open('make.py').read().split("os.chdir(")[0])
os.chdir(os.path.dirname(os.path.abspath(__file__)))
blends = {
 # A: Plus Pop's marimba jump, answered by Mission Chime's bells reaching the top note.
 '7-pop-chime': (
   lambda: place([(0, marimba(72, .45)), (0.1, marimba(79, .5)), (0.24, bell(76, 1.0, .55)), (0.33, bell(79, 1.0, .6)), (0.42, bell(84, 1.2, .75)), (0.45, sparkle(.3, 96, 4, .1))], 1.3),
   lambda: place([(0, marimba(72, .45)), (0.1, marimba(79, .5)), (0.3, marimba(76, .45, .8)), (0.4, marimba(79, .5, .9)), (0.58, bell(72, 1.6, .6)), (0.68, bell(76, 1.6, .6)), (0.78, bell(79, 1.6, .65)), (0.9, bell(84, 2.2, .85)), (0.9, warm(48, 2.0, .3)), (0.9, warm(55, 2.0, .2)), (1.1, sparkle(.5, 96, 6, .12))], 2.9),
 ),
 # B: Mission Chime's bells, with Plus Pop's sparkle and a marimba echo on the last note.
 '8-chime-pop': (
   lambda: place([(0, bell(72, 1.0, .75)), (0.09, bell(76, 1.0, .75)), (0.18, bell(79, 1.2, .85)), (0.18, marimba(79, .5, .5)), (0.26, sparkle(.35, 91, 5, .16))], 1.2),
   lambda: place([(0, bell(72, 1.4, .75)), (0.12, bell(76, 1.4, .75)), (0.24, bell(79, 1.4, .8)), (0.36, bell(84, 2.2, .95)), (0.36, marimba(84, .7, .5)), (0.62, marimba(79, .5, .6)), (0.74, marimba(84, .9, .7)), (0.0, warm(48, 2.2, .3)), (0.8, sparkle(.6, 91, 7, .15))], 2.8),
 ),
}
for name, (short, long) in blends.items():
    finish(short(), f'{name}-notify', 1.3)
    finish(long(), f'{name}-long', 3.0)
    os.system(f'ffmpeg -loglevel error -y -i {name}-notify.wav -f lavfi -t 0.8 -i anullsrc=r=44100:cl=stereo -i {name}-long.wav -filter_complex "[0:a]atrim=0:1.5[a];[a][1:a][2:a]concat=n=3:v=0:a=1" -b:a 160k "out/MN sound {name}.mp3"')
print('ok')
