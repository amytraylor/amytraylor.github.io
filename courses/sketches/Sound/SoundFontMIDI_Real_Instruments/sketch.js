/**
 * SOUNDFONT-PLAYER
 * -----------------
 * Loads pre-rendered General MIDI instrument samples from a public CDN.
 * ~128 instruments available (acoustic_grand_piano, electric_guitar_clean,
 * violin, flute, trumpet, etc.)
 *
 * Pros: Real instrument sounds, tiny library, dead simple API
 * Cons: Initial load time for samples (~1-3s), no real-time synthesis control
 *
 * Repo: https://github.com/danigb/soundfont-player
 */

// -- Key mapping: two chromatic octaves --
const KEY_MAP = {};
"zsxdcvgbhnjm".split("").forEach((k, i) => (KEY_MAP[k] = 60 + i));
"q2w3er5t6y7u".split("").forEach((k, i) => (KEY_MAP[k] = 72 + i));

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
function noteName(n) {
  return NOTE_NAMES[n % 12] + Math.floor(n / 12 - 1);
}

let instrument = null;

let activeNotes = {};
let statusMsg = "Loading acoustic_grand_piano samples...";
let playingNodes = {}; // note -> audio node (for stopping)

// Available instruments (partial list):
// acoustic_grand_piano, bright_acoustic_piano, electric_piano_1,
// harpsichord, marimba, church_organ, accordion, acoustic_guitar_nylon,
// electric_guitar_clean, electric_guitar_jazz, violin, cello, flute,
// trumpet, trombone, alto_sax, clarinet, oboe
let instrumentName = [
  "acoustic_grand_piano",
  "bright_acoustic_piano",
  "electric_piano_1",
  "harpsichord",
  "marimba",
  "church_organ",
  "accordion",
  "acoustic_guitar_nylon",
  "electric_guitar_clean",
  "electric_guitar_jazz",
  "violin",
  "cello",
  "flute",
  "trumpet",
  "trombone",
  "alto_sax",
  "clarinet",
  "oboe",
];
let current = 0;

//const INSTRUMENT_NAME = 'acoustic_grand_piano';
//let instrumentName = INSTRUMENT_NAME;

async function initAudio() {
  try {
    const ac = new AudioContext();
    instrument = await Soundfont.instrument(ac, instrumentName[current]);
    statusMsg = `${instrumentName[current]} loaded — press keys to play`;
  } catch (err) {
    statusMsg = `Error: ${err.message}`;
  }
}

function setup() {
  let canvas = createCanvas(600, 400);
  canvas.parent('canvas-container');
  //createCanvas(windowWidth, windowHeight);
  textFont("monospace");
  // AudioContext requires user gesture, so we init on first click

  document.addEventListener(
    "click",
    () => {
      if (!instrument) initAudio();
    },
    { once: false }
  );
  initAudio();
}

function draw() {
  background(13, 17, 23, 50);

  // Status
  push();
  fill(instrument ? "#58a6ff" : "#f0883e");
  textAlign(CENTER);
  textSize(14);
  text(statusMsg, width / 2, 30);
  pop();

  // Active notes visualization
  let keys = Object.keys(activeNotes);
  keys.forEach((note, i) => {
    let info = activeNotes[note];
    let age = frameCount - info.startFrame;
    let hue = (note * 25) % 360;
    let x =
      width / 2 +
      cos((i / keys.length) * TWO_PI - HALF_PI) * min(keys.length * 35, 200);
    let y =
      height / 2 +
      sin((i / keys.length) * TWO_PI - HALF_PI) * min(keys.length * 35, 200);
    if (keys.length === 1) {
      x = width / 2;
      y = height / 2;
    }

    push();
    colorMode(HSB, 360, 100, 100, 255);
    noFill();
    stroke(hue, 70, 90, max(0, 200 - age));
    strokeWeight(2);
    ellipse(x, y, 80 + age * 0.4);
    fill(hue, 70, 95);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(18);
    text(noteName(parseInt(note)), x, y);
    pop();
  });

  // Legend
  push();
  fill(100);
  textAlign(CENTER);
  textSize(12);
  text(
    "Lower row: Z S X D C V G B H N J M  →  C4 chromatic",
    width / 2,
    height - 50
  );
  text(
    "Upper row: Q 2 W 3 E R 5 T 6 Y 7 U  →  C5 chromatic",
    width / 2,
    height - 34
  );
  text(
    "Library: soundfont-player — real sampled instruments via CDN",
    width / 2,
    height - 14
  );
  pop();
}

function keyPressed() {
  let len = instrumentName.length;

  if (keyCode == LEFT_ARROW) {
    if (current > 0) {
      current--;
    } else {
      current = len-1;
      //current--;
    }
    print(current);
    initAudio();
  } else if (keyCode == RIGHT_ARROW) {
    if(current<len-1){
    current++;
    } else {
      current=0;
    }
    print(current);
    initAudio();
  }
  let k = key.toLowerCase();
  if (KEY_MAP[k] !== undefined && !activeNotes[KEY_MAP[k]]) {
    let note = KEY_MAP[k];
    activeNotes[note] = { startFrame: frameCount };

    if (instrument) {
      // play() returns an audio node we can stop later
      playingNodes[note] = instrument.play(note, 0, { gain: 2.0 });
    }
  }
  return false;
}

function keyReleased() {
  let k = key.toLowerCase();
  if (KEY_MAP[k] !== undefined) {
    let note = KEY_MAP[k];
    delete activeNotes[note];

    if (playingNodes[note]) {
      playingNodes[note].stop();
      delete playingNodes[note];
    }
  }
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
