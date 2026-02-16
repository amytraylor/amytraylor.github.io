// Live speech-to-text in p5.js (Web Speech API)
// Best: Chrome/Edge on desktop + Android Chrome
// Needs HTTPS (GitHub Pages is fine) or localhost for mic permissions.

let recognition = null;
let listening = false;

let final_text = "";
let interim_text = "";
let status_msg = "";

function setup() {
  let canvas = createCanvas(600, 400);
  canvas.parent('canvas-container');
  textFont("sans-serif");
  textSize(18);
  textWrap(WORD);

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    status_msg = "SpeechRecognition not supported in this browser.";
    return;
  }

  recognition = new SR();
  recognition.lang = "en-US";        // change to "es-ES", etc.
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    listening = true;
    status_msg = "Listening… tap to stop";
  };

  recognition.onend = () => {
    listening = false;
    status_msg = "Stopped. Tap to start";
    interim_text = "";
    // Mobile browsers sometimes stop unexpectedly; auto-restart if user intended to keep going
    if (listening_intent) {
      safe_start();
    }
  };

  recognition.onerror = (e) => {
    listening = false;
    status_msg = `Error: ${e.error}. Tap to try again.`;
    interim_text = "";
  };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const txt = res[0].transcript;
      if (res.isFinal) final_text += txt + " ";
      else interim += txt;
    }
    interim_text = interim;
  };

  status_msg = "Tap to start listening";
}

let listening_intent = false;

function safe_start() {
  if (!recognition) return;
  try {
    recognition.start();
  } catch (err) {
    // start() throws if called twice quickly; ignore and let user tap again
  }
}

function safe_stop() {
  if (!recognition) return;
  try {
    recognition.stop();
  } catch (err) {}
}

function mousePressed() {
  // required “user gesture” to start mic on most browsers
  if (!recognition) return;

  if (!listening) {
    listening_intent = true;
    safe_start();
  } else {
    listening_intent = false;
    safe_stop();
  }
}

function keyPressed() {
  // Convenience keys for desktop
  if (key === 'c' || key === 'C') {
    final_text = "";
    interim_text = "";
  }
}

function draw() {
  background(250);
  fill(20);
  text(status_msg, 20, 30);

  fill(80);
  text("Interim (live):", 20, 70);
  fill(0);
  text(interim_text || "…", 20, 95, width - 40);

  fill(80);
  text("Final:", 20, 170);
  fill(0);
  text(final_text || "(none yet)", 20, 195, width - 40);

  fill(120);
  text("Tap to start/stop. Press C to clear.", 20, height - 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
