//https://claude.ai/share/c739c07b-5340-43c5-baac-dc551f8ba847
// ============================================================
//  POLYNOMIAL + SOUNDFONT COLLAGE
//
//  Press SPACE to strum the current curve.
//  Each rect plays its own instrument (cycled across the list)
//  at a pitch mapped from the y value of the equation.
//
//  UP / DOWN arrows     → shift pitch range ±octave
//  W / S                → minX ±1
//  A / D                → maxX ±1
//  E                    → save screenshot
// ============================================================

// ---------- Font ----------
let customFont;
function preload() {
  customFont = loadFont("Nobile-Regular.ttf");
}

// ---------- Equation state ----------
let a, b, c = 5;
let minX    = -15;
let maxX    =  15;
let stretch =   5;
let rectSize;

// ---------- UI ----------
let tS, spacing, leftAlign, rightAlign;

// ---------- Pitch mapping ----------
const PITCH_MIN  = 36;   // C2
const PITCH_MAX  = 96;   // C7
let   pitchShift =   0;

let strumYMin = -300;
let strumYMax =  300;

function yToPitch(y) {
  let p = map(y, strumYMin, strumYMax, PITCH_MAX, PITCH_MIN);
  return constrain(round(p) + pitchShift, 21, 108);
}

// ---------- Strum ----------
const STRUM_STEP_MS = 60;
const NOTE_DUR_S    = 0.6;
const NOTE_GAIN     = 1.8;

let strumSchedule = [];
let strumming     = false;

let glowAge    = [];
let glowActive = [];
// Store per-rect instrument index so drawGraph can colour by instrument
let glowInstr  = [];

// ---------- Swipe interaction ----------
// While mouse is held, any rect whose screen position falls within
// SWIPE_RADIUS of the cursor fires once per swipe (tracked in swipeFired).
const SWIPE_RADIUS = 40;   // px — tune to taste
let   swipeActive  = false;
let   swipeFired   = new Set(); // rect indices already triggered this swipe

// Fire a single rect immediately (shared by strum and swipe)
function fireRect(idx, pitch, instrIdx) {
  let instr = instruments[instrIdx];
  if (instr) {
    instr.play(pitch, 0, { gain: NOTE_GAIN, duration: NOTE_DUR_S });
  }
  while (glowAge.length    <= idx) glowAge.push(999);
  while (glowActive.length <= idx) glowActive.push(false);
  while (glowInstr.length  <= idx) glowInstr.push(0);
  glowAge[idx]    = 0;
  glowActive[idx] = true;
  glowInstr[idx]  = instrIdx;
}

function processSwipe() {
  if (!swipeActive || loadedCount < INSTRUMENT_LIST.length) return;

  // Graph origin is at (width*0.3, height*0.5)
  let gx = mouseX - width  * 0.3;
  let gy = mouseY - height * 0.5;

  let idx = 0;
  for (let i = minX; i < maxX; i++) {
    let x  = i;
    let y  = a * pow(x, 2) + b * x + c;
    let sx = x * stretch;

    if (dist(gx, gy, sx, y) < SWIPE_RADIUS && !swipeFired.has(idx)) {
      let pitch    = yToPitch(y);
      let instrIdx = idx % INSTRUMENT_LIST.length;
      fireRect(idx, pitch, instrIdx);
      swipeFired.add(idx);
    }
    idx++;
  }
}

// ---------- Audio ----------
// All instruments loaded once into this array.
// Each rect cycles through them: rectIndex % instruments.length
const INSTRUMENT_LIST = [
  "acoustic_grand_piano", "bright_acoustic_piano", "electric_piano_1",
  "harpsichord", "marimba", "church_organ", "accordion",
  "acoustic_guitar_nylon", "electric_guitar_clean", "electric_guitar_jazz",
  "violin", "cello", "flute", "trumpet", "trombone",
  "alto_sax", "clarinet", "oboe"
];

let instruments  = [];   // loaded Soundfont instrument objects (parallel to INSTRUMENT_LIST)
let audioCtx     = null;
let loadedCount  = 0;
let statusMsg    = "Click or press SPACE to begin loading";

async function initAudio() {
  if (audioCtx) return;  // already loading / loaded
  statusMsg = "Loading all instruments (0 / " + INSTRUMENT_LIST.length + ")…";
  try {
    audioCtx = new AudioContext();
    // Load all instruments in parallel
    const promises = INSTRUMENT_LIST.map((name, i) =>
      Soundfont.instrument(audioCtx, name).then(instr => {
        loadedCount++;
        statusMsg = "Loading… " + loadedCount + " / " + INSTRUMENT_LIST.length;
        instruments[i] = instr;
        return instr;
      })
    );
    await Promise.all(promises);
    statusMsg = "All instruments ready  |  SPACE to strum";
  } catch (err) {
    statusMsg = "Error: " + err.message;
  }
}

// ---------- Build strum snapshot ----------
function buildStrum() {
  if (instruments.length === 0) { initAudio(); return; }
  if (loadedCount < INSTRUMENT_LIST.length) return; // still loading

  // Pass 1: y range
  let yVals = [];
  for (let i = minX; i < maxX; i++) {
    yVals.push(a * pow(i, 2) + b * i + c);
  }
  strumYMin = min(yVals);
  strumYMax = max(yVals);
  if (strumYMax === strumYMin) strumYMax = strumYMin + 1;

  strumSchedule = [];
  let now   = millis();
  let count = 0;
  let n     = maxX - minX;

  for (let i = minX; i < maxX; i++) {
    let x         = i;
    let y         = a * pow(x, 2) + b * x + c;
    let sx        = x * stretch;
    let pitch     = yToPitch(y);
    let instrIdx  = (i - minX) % INSTRUMENT_LIST.length;

    strumSchedule.push({
      pitch, xi: sx, yi: y,
      idx:     i - minX,
      instrIdx,
      fireAt:  now + count * STRUM_STEP_MS
    });
    count++;
  }

  glowAge    = new Array(n).fill(999);
  glowActive = new Array(n).fill(false);
  glowInstr  = new Array(n).fill(0);

  strumming = true;
}

// ---------- Process strum ----------
function processStrum() {
  if (!strumming || strumSchedule.length === 0) return;

  let now       = millis();
  let remaining = [];

  for (let s of strumSchedule) {
    if (now >= s.fireAt) {
      fireRect(s.idx, s.pitch, s.instrIdx);
    } else {
      remaining.push(s);
    }
  }

  strumSchedule = remaining;
  if (strumSchedule.length === 0) strumming = false;
}

// ---------- p5 setup ----------
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont(customFont);
  recalc();
  document.addEventListener("click", () => { if (!audioCtx) initAudio(); });
  initAudio();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  recalc();
}

function recalc() {
  rectSize = height * 0.025;
  tS       = height * 0.035;
}

// ---------- Main draw ----------
function draw() {
  background(0);

  a       = map(sin(millis() /  5000), -1, 1,  -2,   2);
  b       = map(cos(millis() /  5000), -1, 1, -10,  10);
  stretch = map(sin(millis() / 10000), -1, 1, -25,  25);

  processStrum();
  processSwipe();

  push();
  translate(width * 0.3, height * 0.5);
  drawGraph();
  pop();

  drawUI();
}

// ---------- Draw graph ----------
// Hue is derived from instrIdx so each instrument has a consistent colour.
function instrHue(instrIdx) {
  return (instrIdx / INSTRUMENT_LIST.length) * 360;
}

function drawGraph() {
  let idx = 0;
  for (let i = minX; i < maxX; i++) {
    let x  = i;
    let y  = a * pow(x, 2) + b * x + c;
    let sx = x * stretch;

    // Resting colour: dim tint based on which instrument this rect would use
    let iIdx = idx % INSTRUMENT_LIST.length;
    let hue  = instrHue(iIdx);

    if (idx < glowAge.length) {
      glowAge[idx]++;
      let glowing = glowActive[idx] && glowAge[idx] < 30;

      if (glowing) {
        colorMode(HSB, 360, 100, 100, 255);
        let gh = instrHue(glowInstr[idx]);
        fill(gh, 85, 100, map(glowAge[idx], 0, 30, 240, 0));
        noStroke();
        ellipse(sx, y, rectSize * 6);
        colorMode(RGB, 255);
        if (glowAge[idx] >= 30) glowActive[idx] = false;
      }

      colorMode(HSB, 360, 100, 100);
      stroke(hue, 60, 90);
      strokeWeight(glowing ? 2 : 1);
      fill(glowing ? color(hue, 80, 100) : color(hue, 40, 15));
      colorMode(RGB, 255);
    } else {
      colorMode(HSB, 360, 100, 100);
      stroke(hue, 60, 90);
      strokeWeight(1);
      fill(hue, 40, 15);
      colorMode(RGB, 255);
    }

    rect(sx, y, rectSize, rectSize);
    idx++;
  }
}

// ---------- UI overlay ----------
function drawUI() {
  noStroke();
  spacing    = tS * 1.3;
  leftAlign  = width * 0.65;
  rightAlign = width * 0.95;

  fill(255);
  textSize(tS * 1.05);
  textAlign(LEFT, CENTER);
  text("EQUATION", leftAlign, height * 0.05);
  text("CONTROLS", leftAlign, height * 0.25);

  push();
  translate(0, height * 0.05 + tS * 1.3);
  textSize(tS * 0.95);
  textAlign(RIGHT, CENTER);
  text("y = ax\u00B2 + bx + c", rightAlign, 0);
  textSize(tS * 0.85);
  text("minX: " + minX, rightAlign, spacing);
  text("maxX: " + maxX, rightAlign, spacing * 2);
  pop();

  textSize(tS * 0.6);
  spacing = tS * 0.66;
  push();
  translate(0, height * 0.25 + tS * 1.15);
  let lx = width * 0.66;
  let rx = width * 0.91;
  textAlign(LEFT, CENTER);
  fill(255, 230, 80);
  text("SPACE",                  lx, 0);
  fill(255);
  text("strum curve",            lx, spacing);
  fill(255, 230, 80);
  text("DRAG MOUSE",             lx, spacing * 2);
  fill(255);
  text("swipe across curve",     lx, spacing * 3);
  text("UP / DOWN",              lx, spacing * 4.5);
  text("pitch range +/- octave", lx, spacing * 5.5);
  text("W / S",                  lx, spacing * 7);
  text("minX +/- 1",             lx, spacing * 8);
  text("A / D",                  lx, spacing * 9.5);
  text("maxX +/- 1",             lx, spacing * 10.5);
  textAlign(RIGHT, CENTER);
  fill(180);
  text("pitch shift: " + (pitchShift >= 0 ? "+" : "") + pitchShift, rx, spacing * 5.5);
  text(loadedCount + " / " + INSTRUMENT_LIST.length + " loaded", rx, spacing * 0);
  pop();

  // Instrument colour legend (small swatches)
  push();
  translate(width * 0.65, height * 0.62);
  textSize(tS * 0.48);
  let swatchW = tS * 0.45;
  let swatchH = tS * 0.45;
  let cols    = 3;
  let rowH    = tS * 0.72;
  colorMode(HSB, 360, 100, 100);
  for (let i = 0; i < INSTRUMENT_LIST.length; i++) {
    let col = i % cols;
    let row = floor(i / cols);
    let x   = col * (width * 0.105);
    let y   = row * rowH;
    fill(instrHue(i), 70, 85);
    noStroke();
    rect(x, y, swatchW, swatchH, 2);
    fill(instrHue(i), 20, 95);
    textAlign(LEFT, CENTER);
    // Shorten name for display
    let label = INSTRUMENT_LIST[i].replace(/_/g, " ").replace("acoustic ", "ac. ").replace("electric ", "el. ");
    text(label, x + swatchW + tS * 0.15, y + swatchH * 0.5);
  }
  colorMode(RGB, 255);
  pop();

  // Status
  push();
  fill(loadedCount === INSTRUMENT_LIST.length ? "#58a6ff" : "#f0883e");
  textSize(tS * 0.75);
  textAlign(CENTER, CENTER);
  text(statusMsg, width * 0.3, height * 0.93);
  pop();

  // Live equation
  fill(255);
  push();
  translate(0, height * 0.88);
  textSize(tS * 1.1);
  textAlign(RIGHT, CENTER);
  text(
    "y = " + nf(a,1,2) + "x\u00B2 + " + nf(b,1,2) + "x + " + nf(c,1,1),
    width * 0.95, 0
  );
  pop();
}

// ---------- Mouse ----------
function mousePressed() {
  if (!audioCtx) initAudio();
  swipeActive = true;
  swipeFired.clear();
  // Recompute y range from current curve for pitch mapping
  let yVals = [];
  for (let i = minX; i < maxX; i++) yVals.push(a * pow(i, 2) + b * i + c);
  strumYMin = min(yVals);
  strumYMax = max(yVals);
  if (strumYMax === strumYMin) strumYMax = strumYMin + 1;
}

function mouseReleased() {
  swipeActive = false;
  swipeFired.clear();
}

// ---------- Input ----------
function keyPressed() {
  if (key === " ") {
    buildStrum();
    return false;
  }
  if (key === "e" || key === "E") {
    save("polynomial_midi_" + millis() + ".png");
  }
  if (keyCode === UP_ARROW)   pitchShift = constrain(pitchShift + 12, -36, 36);
  if (keyCode === DOWN_ARROW) pitchShift = constrain(pitchShift - 12, -36, 36);
  if (key === "w" || key === "W") minX--;
  if (key === "s" || key === "S") minX++;
  if (key === "a" || key === "A") maxX--;
  if (key === "d" || key === "D") maxX++;
  return false;
}