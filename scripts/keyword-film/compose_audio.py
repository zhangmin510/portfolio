#!/usr/bin/env python3
"""An original 50-second warm, reflective score. Standard-library Python only.

No samples, external recordings, pretrained model, or licensed music are used.
Run this file to recreate ../../.film-work/soundtrack.wav.
"""

from array import array
from math import cos, exp, log10, pi, sin, sqrt
from pathlib import Path
import json
import sys
import wave

RATE = 48_000
DURATION = 50
COUNT = RATE * DURATION
TAU = 2 * pi
ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / '.film-work' / 'soundtrack.wav'
left = array('f', [0]) * COUNT
right = array('f', [0]) * COUNT


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def mix_note(start, midi, duration=4.0, level=.11, pan=0., kind='felt'):
    """Soft struck tine / felt-piano voice, or slow warm organ-like pad."""
    first = int(start * RATE)
    length = min(int(duration * RATE), COUNT - first)
    frequency = hz(midi)
    lp = sqrt((1 - pan) / 2)
    rp = sqrt((1 + pan) / 2)
    for n in range(length):
        t = n / RATE
        phase = TAU * frequency * t
        if kind == 'pad':
            envelope = min(t / 1.65, 1.) * min((duration - t) / 2.3, 1.)
            vibrato = .018 * sin(TAU * .19 * t)
            value = envelope * (
                .70 * sin(phase + vibrato)
                + .19 * sin(phase * 1.0022 + .11)
                + .085 * sin(phase * 2.0001 + .06)
                + .025 * sin(phase * 3.0008)
            )
        else:
            # Slow attack suppresses metallic clicks; partials decay faster
            # than the fundamental to resemble softly struck felt keys.
            attack = 1 - exp(-t * 75)
            release = min((duration - t) / .4, 1.)
            value = attack * release * (
                .80 * exp(-t / 1.65) * sin(phase)
                + .145 * exp(-t / .70) * sin(phase * 2.001)
                + .04 * exp(-t / .38) * sin(phase * 3.996)
                + .015 * exp(-t / .18) * sin(phase * 6.01)
            )
        value *= level
        left[first + n] += value * lp
        right[first + n] += value * rp


# Eight chord colours follow the film's six-year narrative and opening/ending.
# Dmaj9 -> Bm7 -> Gmaj9 -> Aadd9 -> D/F# -> Em9 -> A6 -> Dmaj9.
chords = [
    (0., [50, 57, 61, 64, 66], 7.5),
    (5., [47, 54, 57, 62, 66], 8.0),
    (11., [43, 50, 54, 57, 62], 8.0),
    (17., [45, 52, 57, 59, 64], 8.0),
    (23., [42, 50, 57, 62, 66], 8.0),
    (29., [40, 47, 54, 55, 62], 8.0),
    (35., [45, 52, 57, 61, 66], 8.0),
    (41., [38, 50, 57, 61, 66], 9.0),
]
for start, notes, duration in chords:
    for index, note in enumerate(notes):
        mix_note(start + index * .095, note, duration - index * .095,
                 .022 if index == 0 else .013, (index - 2) * .13, 'pad')
    # Quiet rolled dyad articulates the turn of each chapter.
    for index, note in enumerate(notes[1:4]):
        mix_note(start + .32 + index * .18, note, 4.3,
                 .062 - index * .008, -.28 + index * .19)
    print(f'Chord {start:.0f}s rendered', flush=True)

# An original unhurried melody; deliberately leaves room between phrases.
phrases = [
    (0., [(1.2, 66), (2.4, 69), (3.8, 64)]),
    (5., [(1.0, 66), (2.5, 62), (4.0, 61)]),
    (11., [(0.9, 62), (2.4, 66), (3.9, 69), (5.0, 67)]),
    (17., [(1.1, 64), (2.7, 66), (4.4, 69)]),
    (23., [(0.9, 69), (2.2, 73), (3.8, 71), (5.0, 69)]),
    (29., [(1.1, 67), (2.6, 66), (4.1, 64)]),
    (35., [(0.9, 66), (2.4, 69), (4.0, 64), (5.0, 61)]),
    (41., [(1.2, 66), (3.0, 64), (4.8, 62)]),
]
for phrase_index, (start, notes) in enumerate(phrases):
    for index, (offset, note) in enumerate(notes):
        level = .105 if index == 0 else .085
        mix_note(start + offset, note, min(4.8, 50 - start - offset),
                 level, -.12 if (index + phrase_index) % 2 else .16)

# Soft cross-channel room reflections. Feed-forward taps prevent runaway tails.
dry_left, dry_right = array('f', left), array('f', right)
for delay, gain, swap in [(.107, .12, True), (.173, .095, False),
                           (.293, .075, True), (.431, .055, False),
                           (.677, .032, True), (.911, .02, False)]:
    shift = int(delay * RATE)
    source_l, source_r = (dry_right, dry_left) if swap else (dry_left, dry_right)
    for index in range(shift, COUNT):
        left[index] += source_l[index - shift] * gain
        right[index] += source_r[index - shift] * gain

peak = max(max(abs(x) for x in left), max(abs(x) for x in right))
gain = 10 ** (-3 / 20) / peak
pcm = array('h')
energy = 0.
final_peak = 0.
for index in range(COUNT):
    time = index / RATE
    fade = min(time / 2.0, 1.) * min((DURATION - time) / 4.8, 1.)
    # Cosine fade creates a smooth edge with zero slope.
    fade = .5 - .5 * cos(pi * max(0., fade))
    for channel in (left, right):
        value = channel[index] * gain * fade
        final_peak = max(final_peak, abs(value))
        energy += value * value
        pcm.append(round(max(-1., min(1., value)) * 32767))
if sys.byteorder != 'little':
    pcm.byteswap()
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUTPUT), 'wb') as stream:
    stream.setnchannels(2)
    stream.setsampwidth(2)
    stream.setframerate(RATE)
    stream.writeframes(pcm.tobytes())

report = {
    'output': str(OUTPUT),
    'duration_seconds': DURATION,
    'sample_rate': RATE,
    'channels': 2,
    'samples_per_channel': COUNT,
    'sample_peak_dbfs': round(20 * log10(final_peak), 2),
    'rms_dbfs': round(10 * log10(energy / (COUNT * 2)), 2),
    'clipped_samples': sum(abs(x) >= 32767 for x in pcm),
    'provenance': 'Original procedural composition; no external recordings.',
}
print(json.dumps(report, ensure_ascii=False, indent=2))
