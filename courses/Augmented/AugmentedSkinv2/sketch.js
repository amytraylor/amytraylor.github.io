// ============================================================================
// FUTURE FACE PIPELINE
//   Stage 1 (mesh)   : start from the default canonical face OR capture one
//                      from the webcam.
//   Stage 2 (weight) : author region design weights on the SVG map. The map is
//                      UV space, so it weights any face identically.
//
// The chosen mesh (verts + optional captured texture) is held in `chosenMesh`
// and exported alongside the weights, ready for the later render/displace step.
//
// Loads with: p5, ml5 (camera only), facedata.js, this file. The inlined SVG in
// index.html supplies the region groups (ids match facedata.js GROUPS).
// ============================================================================

const W = 640,
  H = 480;
let stage = "weight"; // weighting | render  (capture stage removed)
let chosenMesh = null; // { verts, uvs, texture(p5.Image|null), source }

// ---- p5 lifecycle ----
let previewGeom = null,
  previewDirty = true;

const APP_VERSION = "futureface 2025-06-14d";
let defaultSkin = null;
let viewZoom = 1; // shared by stage-1 inspect and stage-3 render

// a warm procedural skin so the default head reads as a face, not grey

// wheel zoom that never scrolls the page (and leaves the weighting page scrollable)
function mouseWheel(e) {
  if (stage === "weight") {
    return true;
  } // let the DOM panels scroll normally
  viewZoom = constrain(viewZoom * (1 - e.delta * 0.001), 0.25, 6);
  return false; // prevent page scroll while orbiting
}

// middle-button drag = zoom (vertical drag); works alongside left-drag orbit
function applyMiddleDragZoom() {
  if (mouseIsPressed && mouseButton === CENTER) {
    viewZoom = constrain(viewZoom * (1 + (pmouseY - mouseY) * 0.005), 0.25, 6);
  }
}

function zoomBy(f) {
  viewZoom = constrain(viewZoom * f, 0.25, 6);
}

function windowResized() {
  resizeCanvas(windowWidth, max(420, floor(windowHeight * 0.72)));
}

// ============================================================================
// STAGE 1 -- MESH
// ============================================================================

// full project reset: default mesh, cleared weights, back to stage 1

// render-stage reset: back to mesh-only, flat morph, default zoom (stays in stage 3)

// ---- stage transition ----

// ---- stage 3 entry/exit ----
function goToRender() {
  stage = "render";
  const sw = byId("stageWeight");
  if (sw) {
    sw.style.display = "none";
  }
  const ch = byId("canvasHolder");
  if (ch) {
    ch.style.display = "";
  }
  const mc = byId("meshControls");
  if (mc) {
    mc.style.display = "none";
  }
  if (renderUI.panel) {
    renderUI.panel.style.display = "flex";
  }
  const sWeight = byId("stepWeight");
  if (sWeight) {
    sWeight.classList.remove("active");
  }
  const sRender = byId("stepRender");
  if (sRender) {
    sRender.classList.add("active");
  }
  enterStage3();
}

let renderUI = {};

// Build the entire render control bar in JS, appended to the page, so it does
// not depend on index.html having the right elements. This bar carries: back,
// start over, the four layer checkboxes, full-face cloud, the implode/extrude
// slider with readout, zoom buttons, and save.

// ============================================================================
// STAGE 2 -- WEIGHTING SVG  (ported from the verified region mixer)
// ============================================================================
const REGIONS = [
  { id: "forehead", label: "Forehead" },
  { id: "nose", label: "Nose" },
  { id: "leftCheek", label: "Left cheek" },
  { id: "rightCheek", label: "Right cheek" },
  { id: "chin", label: "Chin" },
  { id: "lips", label: "Lips" },
  { id: "leftEye", label: "Left eye" },
  { id: "rightEye", label: "Right eye" },
  { id: "leftEyebrow", label: "Left eyebrow" },
  { id: "rightEyebrow", label: "Right eyebrow" },
  { id: "leftEyeInterior", label: "Left eye interior" },
  { id: "rightEyeInterior", label: "Right eye interior" },
  { id: "mouthInterior", label: "Mouth interior" },
  { id: "skin", label: "Skin (rest of face)" },
];
const TEXTURES = [
  {
    id: "water",
    name: "Water ripple",
    note: "Flow / atmosphere / liquid adaptation",
    pattern: "tex-water",
  },
  {
    id: "circuit",
    name: "Circuit traces",
    note: "Sensor logic / cyborg signal",
    pattern: "tex-circuit",
  },
  {
    id: "bio",
    name: "Biomorphic scales",
    note: "Protection / evolution / skin armor",
    pattern: "tex-bio",
  },
  {
    id: "star",
    name: "Starfield",
    note: "Cosmic identity / dark-sky signal",
    pattern: "tex-star",
  },
  {
    id: "strata",
    name: "Topographic strata",
    note: "Depth map / terrain / geological skin",
    pattern: "tex-strata",
  },
];
const NS = "http://www.w3.org/2000/svg";
const mstate = { selected: new Set(["leftCheek", "rightCheek"]), weights: {} };

let svg, selectedList, textureListLeft, textureListRight, weightSummary;

function buildMixer() {
  svg = byId("meshSvg");
  selectedList = byId("selectedList");
  textureListLeft = byId("textureListLeft");
  textureListRight = byId("textureListRight");
  weightSummary = byId("weightSummary");

  REGIONS.forEach(
    (r) => (mstate.weights[r.id] = { water: 0, circuit: 0, bio: 0, star: 0, strata: 0 }),
  );
  mstate.weights.leftCheek = {
    water: 0.45,
    circuit: 0.15,
    bio: 0.25,
    star: 0.05,
    strata: 0.1,
  };
  mstate.weights.rightCheek = {
    water: 0.45,
    circuit: 0.15,
    bio: 0.25,
    star: 0.05,
    strata: 0.1,
  };

  injectPatterns();
  buildTextureCards();
  buildOverlayGroups();
  addAugmentedFacesPatterns(); // keep both codebases' code patterns
  buildHitRegions();
  attachMixerControls();
  buildHistoryUI();
  snapshot();
  refresh();
}

// ---- weight history: back / forward / start over ----
let wHistory = [],
  wIdx = -1;

function cloneWeights() {
  return JSON.parse(JSON.stringify(mstate.weights));
}

function snapshot() {
  wHistory = wHistory.slice(0, wIdx + 1); // drop any redo branch
  wHistory.push(cloneWeights());
  wIdx = wHistory.length - 1;
  updateHistButtons();
}
function undoWeights() {
  if (wIdx <= 0) {
    return;
  }
  wIdx--;
  mstate.weights = JSON.parse(JSON.stringify(wHistory[wIdx]));
  refresh();
  updateHistButtons();
}
function redoWeights() {
  if (wIdx >= wHistory.length - 1) {
    return;
  }
  wIdx++;
  mstate.weights = JSON.parse(JSON.stringify(wHistory[wIdx]));
  refresh();
  updateHistButtons();
}
function startOver() {
  REGIONS.forEach(
    (r) => (mstate.weights[r.id] = { water: 0, circuit: 0, bio: 0, star: 0, strata: 0 }),
  );
  mstate.selected.clear();
  snapshot();
  refresh();
}
function updateHistButtons() {
  const u = byId("undoBtn"),
    r = byId("redoBtn");
  if (u) {
    u.disabled = wIdx <= 0;
  }
  if (r) {
    r.disabled = wIdx >= wHistory.length - 1;
  }
}

// create the history buttons in JS (no HTML edit needed) and slot them into the toolbar
// wire the STATIC history + select-all buttons (they live in index.html)
function buildHistoryUI() {
  const u = byId("undoBtn");
  if (u) {
    u.addEventListener("click", undoWeights);
  }
  const r = byId("redoBtn");
  if (r) {
    r.addEventListener("click", redoWeights);
  }
  const o = byId("startOverBtn");
  if (o) {
    o.addEventListener("click", startOver);
  }
  const a = byId("selectAllBtn");
  if (a) {
    a.addEventListener("click", selectAllRegions);
  }
}

// substrate: select every region, so the next slider applies a texture face-wide
function selectAllRegions() {
  mstate.selected = new Set(REGIONS.map((r) => r.id));
  refresh();
}

function injectPatterns() {
  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML = `
   <pattern id="tex-water" patternUnits="userSpaceOnUse" width="120" height="120">
     <rect width="120" height="120" fill="#15324a"/>
     <circle cx="60" cy="60" r="16" fill="none" stroke="#5be0ff" stroke-width="5" opacity=".82"/>
     <circle cx="60" cy="60" r="34" fill="none" stroke="#a5f1ff" stroke-width="3" opacity=".58"/>
     <circle cx="60" cy="60" r="52" fill="none" stroke="#fff" stroke-width="2" opacity=".26"/></pattern>
   <pattern id="tex-circuit" patternUnits="userSpaceOnUse" width="120" height="120">
     <rect width="120" height="120" fill="#231a41"/>
     <path d="M16 24 H62 V58 H104 M36 92 H78 V38" fill="none" stroke="#c9a8ff" stroke-width="7" stroke-linecap="round"/>
     <circle cx="16" cy="24" r="7" fill="#fff7ff"/><circle cx="62" cy="58" r="7" fill="#fff7ff"/>
     <circle cx="104" cy="58" r="7" fill="#fff7ff"/><circle cx="36" cy="92" r="7" fill="#fff7ff"/>
     <circle cx="78" cy="38" r="7" fill="#fff7ff"/></pattern>
   <pattern id="tex-bio" patternUnits="userSpaceOnUse" width="112" height="96">
     <rect width="112" height="96" fill="#1e2d20"/>
     <path d="M0 47 Q14 8 28 47 T56 47 T84 47 T112 47" fill="none" stroke="#8eea7b" stroke-width="6" opacity=".72"/>
     <path d="M14 82 Q28 43 42 82 T70 82 T98 82 T126 82" fill="none" stroke="#d8ffae" stroke-width="6" opacity=".72"/></pattern>
   <pattern id="tex-star" patternUnits="userSpaceOnUse" width="140" height="140">
     <rect width="140" height="140" fill="#081126"/>
     <circle cx="24" cy="32" r="4" fill="#fff"/><circle cx="72" cy="18" r="2.5" fill="#b4c8ff"/>
     <circle cx="118" cy="42" r="4.5" fill="#fff"/><circle cx="46" cy="88" r="2.5" fill="#9af2ff"/>
     <circle cx="102" cy="74" r="3.5" fill="#ffe092"/><circle cx="26" cy="118" r="4.5" fill="#fff"/>
     <path d="M68 56 l4 11 l11 4 l-11 4 l-4 11 l-4-11 l-11-4 l11-4z" fill="#d8eeff" opacity=".72"/></pattern>
   <pattern id="tex-strata" patternUnits="userSpaceOnUse" width="140" height="90">
     <rect width="140" height="90" fill="#3a2720"/>
     <path d="M-10 18 C30 5 58 32 96 18 C125 8 142 16 156 11" fill="none" stroke="#ffd18a" stroke-width="5" opacity=".78"/>
     <path d="M-12 46 C24 60 60 35 96 50 C122 62 146 42 158 51" fill="none" stroke="#ff9e7e" stroke-width="5" opacity=".72"/>
     <path d="M-6 74 C32 58 64 82 102 69 C125 62 146 74 158 70" fill="none" stroke="#fff0ba" stroke-width="4" opacity=".62"/></pattern>`;
  svg.insertBefore(defs, svg.firstChild);
}

function thumb(kind) {
  const tx = TEXTURES.find((x) => x.id === kind);
  if (tx && tx.isImage) return `url("${tx.src}")`;
  const c = {
    water: ["#15324a", "#5be0ff"],
    circuit: ["#231a41", "#c9a8ff"],
    bio: ["#1e2d20", "#8eea7b"],
    star: ["#081126", "#ffe092"],
    strata: ["#3a2720", "#ffd18a"],
  }[kind];
  const mini = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
    <rect width='100' height='100' fill='${c[0]}'/>
    <circle cx='50' cy='50' r='24' fill='none' stroke='${c[1]}' stroke-width='8' opacity='.85'/>
    <path d='M7 75 C28 55 48 91 74 66 C88 52 93 64 104 54' fill='none' stroke='white' stroke-width='5' opacity='.35'/>
    <circle cx='22' cy='23' r='5' fill='white' opacity='.8'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(mini)}")`;
}

function buildTextureCards() {
  TEXTURES.forEach((t) => {
    if (!t.side) t.side = "left"; // the 5 built-in patterns go in panel A
    addTextureCard(t);
  });
}

// one card per texture: weight slider (drives the region blend) + blur slider
// (softens that source before it is mixed/mapped onto the face).
function addTextureCard(t) {
  if (t.blur == null) t.blur = 0;
  const card = document.createElement("div");
  card.className = "texture-card";
  card.id = "card-" + t.id;
  card.innerHTML = `<div class="texture-head">
      <div class="thumb" style="background-image:${thumb(t.id)}"></div>
      <div><div class="texture-name">${t.name}</div><div class="texture-note">${t.note}</div></div></div>
    <div class="slider-label">weight / opacity</div>
    <div class="slider-row"><input type="range" min="0" max="100" value="0" step="1" data-texture="${t.id}">
      <span class="pill" id="val-${t.id}">0%</span></div>
    <div class="slider-label">blur</div>
    <div class="slider-row"><input type="range" min="0" max="24" value="${t.blur}" step="1" data-blur="${t.id}">
      <span class="pill" id="blur-${t.id}">${t.blur}</span></div>`;
  (t.side === "right" ? textureListRight : textureListLeft).appendChild(card);

  const wsl = card.querySelector("input[data-texture]");
  wsl.addEventListener("input", () => {
    const v = Number(wsl.value) / 100;
    mstate.selected.forEach((id) => (mstate.weights[id][t.id] = v));
    refresh();
  });
  wsl.addEventListener("change", () => snapshot());

  const bsl = card.querySelector("input[data-blur]");
  bsl.addEventListener("input", () => setTexBlur(t.id, Number(bsl.value)));
}

// per-texture blur: SVG feGaussianBlur drives the live stage-2 overlay preview;
// stage 3 re-bakes the raster pattern with the same blur on next entry.
function setTexBlur(id, px) {
  const t = TEXTURES.find((x) => x.id === id);
  if (t) t.blur = px;
  ensureBlurFilter(id, px);
  document.querySelectorAll(`.texture-overlay [data-texture="${id}"]`).forEach((g) => {
    if (px > 0) g.setAttribute("filter", `url(#fblur-${id})`);
    else g.removeAttribute("filter");
  });
  const pill = byId("blur-" + id);
  if (pill) pill.textContent = px;
  S3.built = false; // stage 3 re-bakes patterns with the new blur
}
function ensureBlurFilter(id, px) {
  const defs = svg.querySelector("defs");
  let f = byId("fblur-" + id);
  if (!f) {
    f = document.createElementNS(NS, "filter");
    f.setAttribute("id", "fblur-" + id);
    f.setAttribute("x", "-30%");
    f.setAttribute("y", "-30%");
    f.setAttribute("width", "160%");
    f.setAttribute("height", "160%");
    const gb = document.createElementNS(NS, "feGaussianBlur");
    gb.setAttribute("in", "SourceGraphic");
    f.appendChild(gb);
    defs.appendChild(f);
  }
  f.querySelector("feGaussianBlur").setAttribute("stdDeviation", String(px * 0.45));
}

// ---- image upload: each file becomes a new texture in the palette ----
let uploadCount = 0;
function handleUpload(files) {
  Array.from(files).forEach((file) => {
    if (!file.type || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) =>
      addImageTexture(file.name.replace(/\.[^.]+$/, ""), e.target.result);
    reader.readAsDataURL(file);
  });
}
// shared core: register a raster texture (uploaded image OR a rasterized code pattern)
function addTextureSource(id, name, note, dataURL, side) {
  const t = { id, name, note, pattern: "tex-" + id, isImage: true, src: dataURL, blur: 0, side: side || "left" };
  TEXTURES.push(t);
  REGIONS.forEach((r) => (mstate.weights[r.id][id] = 0));
  addImagePattern(t);
  addOverlayForTexture(t);
  addTextureCard(t);
  if (typeof loadImage === "function") {
    loadImage(dataURL, (img) => {
      t.p5img = img;
      S3.built = false;
    });
  }
  S3.built = false;
  return t;
}
function addImageTexture(name, dataURL) {
  addTextureSource("img" + ++uploadCount, name || "Image " + uploadCount, "uploaded image", dataURL);
  refresh();
}

// ---- augmentedfaces_v23 code patterns, rasterized into the same palette ----
function afPatternURL(drawFn, size) {
  size = size || 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  drawFn(c.getContext("2d"), size, size);
  return c.toDataURL("image/png");
}
function addAugmentedFacesPatterns() {
  const P = [
    ["af_water", "Water (AF)", (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#10314e"); g.addColorStop(1, "#7ff1ff");
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = "rgba(255,255,255,0.65)";
      const maxR = Math.hypot(w, h) * 0.55, step = Math.max(w, h) / 18;
      for (let r = step * 0.7; r < maxR; r += step) {
        x.lineWidth = Math.max(3, Math.min(w, h) * 0.008);
        x.beginPath(); x.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2); x.stroke();
      }
    }],
    ["af_circuit", "Circuit (AF)", (x, w, h) => {
      x.fillStyle = "#21143f"; x.fillRect(0, 0, w, h);
      x.strokeStyle = "#caa8ff"; x.lineWidth = Math.max(6, Math.min(w, h) * 0.012); x.lineCap = "round";
      const cols = 4, rows = 7, cw = w / cols, ch = h / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        x.beginPath();
        x.moveTo(c * cw + cw * 0.12, r * ch + ch * 0.32);
        x.lineTo(c * cw + cw * 0.48, r * ch + ch * 0.32);
        x.lineTo(c * cw + cw * 0.48, r * ch + ch * 0.68);
        x.lineTo(c * cw + cw * 0.86, r * ch + ch * 0.68); x.stroke();
      }
      x.fillStyle = "#fff7ff"; const dr = Math.max(5, Math.min(w, h) * 0.012);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        for (const [px, py] of [[c * cw + cw * 0.12, r * ch + ch * 0.32], [c * cw + cw * 0.48, r * ch + ch * 0.32], [c * cw + cw * 0.86, r * ch + ch * 0.68]]) {
          x.beginPath(); x.arc(px, py, dr, 0, Math.PI * 2); x.fill();
        }
    }],
    ["af_scales", "Scales (AF)", (x, w, h) => {
      x.fillStyle = "#142b1b"; x.fillRect(0, 0, w, h);
      for (let y = -20; y < h + 30; y += 34) for (let xx = -20; xx < w + 30; xx += 42) {
        x.strokeStyle = "rgba(160,255,140,0.75)"; x.lineWidth = 5;
        x.beginPath(); x.arc(xx + ((y / 34) % 2) * 20, y, 24, 0, Math.PI); x.stroke();
      }
    }],
    ["af_stars", "Stars (AF)", (x, w, h) => {
      const g = x.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
      g.addColorStop(0, "#203b7a"); g.addColorStop(1, "#060b18");
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const n = Math.round((w * h) / 12500);
      for (let i = 0; i < n; i++) {
        const px = Math.random() * w, py = Math.random() * h, r = Math.max(1, Math.min(w, h) * (0.001 + Math.random() * 0.003));
        x.fillStyle = Math.random() > 0.75 ? "#ffe6a1" : "#ffffff";
        x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
      }
    }],
    ["af_topo", "Topo (AF)", (x, w, h) => {
      x.fillStyle = "#38271d"; x.fillRect(0, 0, w, h);
      const cols = ["#ffd18a", "#ff9e7e", "#fff0ba"];
      for (let i = 0; i < 15; i++) {
        x.strokeStyle = cols[i % 3]; x.globalAlpha = 0.75; x.lineWidth = 4; x.beginPath();
        const yb = 10 + i * 17;
        for (let xx = -10; xx <= w + 10; xx += 8) {
          const y = yb + Math.sin(xx * 0.04 + i * 0.9) * 12;
          xx === -10 ? x.moveTo(xx, y) : x.lineTo(xx, y);
        }
        x.stroke();
      }
      x.globalAlpha = 1;
    }],
  ];
  P.forEach(([id, name, fn]) => addTextureSource(id, name, "pattern (augmentedfaces)", afPatternURL(fn), "right"));
}
function addImagePattern(t) {
  const defs = svg.querySelector("defs");
  const pat = document.createElementNS(NS, "pattern");
  pat.setAttribute("id", t.pattern);

  // Uploaded/raster textures should behave like one fitted image over the
  // whole face map, not like a 120 x 120 wallpaper tile.  The built-in SVG
  // patterns above can still tile; this function is only for raster sources
  // created by uploads or canvas-generated patterns.
  pat.setAttribute("patternUnits", "userSpaceOnUse");
  pat.setAttribute("x", "0");
  pat.setAttribute("y", "0");
  pat.setAttribute("width", "2048");
  pat.setAttribute("height", "2048");

  const im = document.createElementNS(NS, "image");
  im.setAttributeNS("http://www.w3.org/1999/xlink", "href", t.src);
  im.setAttribute("href", t.src);
  im.setAttribute("x", "0");
  im.setAttribute("y", "0");
  im.setAttribute("width", "2048");
  im.setAttribute("height", "2048");
  im.setAttribute("preserveAspectRatio", "xMidYMid slice");
  pat.appendChild(im);
  defs.appendChild(pat);
}
function addOverlayForTexture(t) {
  REGIONS.forEach((r) => {
    const regionOverlay = document.querySelector(
      `.texture-overlay [data-region="${r.id}"]`,
    );
    if (!regionOverlay) return;
    const grp = document.getElementById(r.id);
    const polys = grp ? Array.from(grp.querySelectorAll(".mesh polygon")) : [];
    const tg = document.createElementNS(NS, "g");
    tg.setAttribute("data-texture", t.id);
    tg.setAttribute("opacity", "0");
    polys.forEach((p) => {
      const cl = p.cloneNode(false);
      cl.removeAttribute("class");
      cl.setAttribute("fill", `url(#${t.pattern})`);
      cl.setAttribute("stroke", "none");
      tg.appendChild(cl);
    });
    regionOverlay.appendChild(tg);
  });
}

function buildOverlayGroups() {
  const root = document.createElementNS(NS, "g");
  root.setAttribute("class", "texture-overlay");
  svg.appendChild(root);
  REGIONS.forEach((r) => {
    const grp = document.getElementById(r.id);
    const polys = grp ? Array.from(grp.querySelectorAll(".mesh polygon")) : [];
    const regionOverlay = document.createElementNS(NS, "g");
    regionOverlay.setAttribute("data-region", r.id);
    root.appendChild(regionOverlay);
    TEXTURES.forEach((t) => {
      const tg = document.createElementNS(NS, "g");
      tg.setAttribute("data-texture", t.id);
      tg.setAttribute("opacity", "0");
      polys.forEach((p) => {
        const cl = p.cloneNode(false);
        cl.removeAttribute("class");
        cl.setAttribute("fill", `url(#${t.pattern})`);
        cl.setAttribute("stroke", "none");
        tg.appendChild(cl);
      });
      regionOverlay.appendChild(tg);
    });
  });
}

// z-order matters: append big/background regions FIRST (bottom) and small
// feature regions LAST (top), so a click on a feature isn't swallowed by skin.
const HIT_ORDER = [
  "skin",
  "forehead",
  "leftCheek",
  "rightCheek",
  "chin",
  "nose",
  "lips",
  "leftEyebrow",
  "rightEyebrow",
  "leftEye",
  "rightEye",
  "leftEyeInterior",
  "rightEyeInterior",
  "mouthInterior",
];

function buildHitRegions() {
  const root = document.createElementNS(NS, "g");
  root.setAttribute("id", "hitRegions");
  svg.appendChild(root);
  for (const id of HIT_ORDER) {
    const grp = document.getElementById(id);
    if (!grp) {
      continue;
    }
    let d = "";
    grp.querySelectorAll(".mesh polygon").forEach((p) => {
      d += "M" + p.getAttribute("points").trim().replace(/\s+/g, " L") + "Z ";
    });
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "region-hit");
    path.setAttribute("fill-rule", "nonzero");
    path.dataset.region = id;
    path.addEventListener("click", (e) => {
      e.stopPropagation();
      selectRegion(id, e.shiftKey);
    });
    root.appendChild(path);
  }
}

function attachMixerControls() {
  byId("clearBtn").onclick = () => {
    mstate.selected.clear();
    refresh();
  };
  byId("coreBtn").onclick = () => {
    mstate.selected = new Set([
      "leftEye",
      "rightEye",
      "lips",
      "nose",
      "leftCheek",
      "rightCheek",
    ]);
    refresh();
  };
  byId("resetBtn").onclick = () => {
    const tg = mstate.selected.size ? [...mstate.selected] : REGIONS.map((r) => r.id);
    tg.forEach((id) => TEXTURES.forEach((t) => (mstate.weights[id][t.id] = 0)));
    refresh();
  };
  byId("exportBtn").onclick = exportWeights;
  byId("toRenderBtn").onclick = goToRender;
  const up = byId("imgUpload");
  if (up)
    up.addEventListener("change", (e) => {
      handleUpload(e.target.files);
      e.target.value = "";
    });
  byId("labelsToggle").onchange = (e) =>
    svg.classList.toggle("hideLabels", !e.target.checked);
  byId("pointsToggle").onchange = (e) =>
    svg.classList.toggle("hidePoints", !e.target.checked);
  byId("dimToggle").onchange = (e) => svg.classList.toggle("dimBase", e.target.checked);
  svg.classList.add("hideLabels", "dimBase");
}

function selectRegion(id, multi) {
  if (!multi) {
    mstate.selected.clear();
  }
  if (multi && mstate.selected.has(id)) {
    mstate.selected.delete(id);
  } else {
    mstate.selected.add(id);
  }
  refresh();
}

function refresh() {
  renderSelected();
  renderSliders();
  renderWeights();
  renderHit();
  renderSummary();
}

function renderSelected() {
  selectedList.innerHTML = "";
  if (!mstate.selected.size) {
    selectedList.innerHTML = "<span class='small'>No regions selected</span>";
    return;
  }
  mstate.selected.forEach((id) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = rlabel(id);
    selectedList.appendChild(chip);
  });
}
function renderSliders() {
  const sel = [...mstate.selected];
  TEXTURES.forEach((t) => {
    const avg = sel.length
      ? sel.reduce((s, r) => s + mstate.weights[r][t.id], 0) / sel.length
      : 0;
    const pct = Math.round(avg * 100);
    const sl = document.querySelector(`input[data-texture="${t.id}"]`);
    if (sl) sl.value = pct;
    const vp = byId(`val-${t.id}`);
    if (vp) vp.textContent = pct + "%";
  });
}
function renderWeights() {
  REGIONS.forEach((r) => {
    const w = mstate.weights[r.id];
    const total = TEXTURES.reduce((s, t) => s + w[t.id], 0);
    TEXTURES.forEach((t) => {
      const op = total > 0 ? (0.92 * w[t.id]) / total : 0;
      const layer = document.querySelector(
        `.texture-overlay [data-region="${r.id}"] [data-texture="${t.id}"]`,
      );
      if (layer) {
        layer.setAttribute("opacity", op.toFixed(3));
      }
    });
  });
}
function renderHit() {
  document
    .querySelectorAll(".region-hit")
    .forEach((p) =>
      p.classList.toggle("selected", mstate.selected.has(p.dataset.region)),
    );
}
function renderSummary() {
  weightSummary.innerHTML = "";
  const sel = [...mstate.selected];
  if (!sel.length) {
    weightSummary.innerHTML = "<div>Select a region.</div>";
    return;
  }
  const avg = {};
  TEXTURES.forEach(
    (t) =>
      (avg[t.id] = sel.reduce((s, r) => s + mstate.weights[r][t.id], 0) / sel.length),
  );
  const total = Object.values(avg).reduce((a, b) => a + b, 0);
  TEXTURES.forEach((t) => {
    const raw = avg[t.id],
      norm = total > 0 ? raw / total : 0;
    const a = document.createElement("div");
    a.textContent = t.name;
    const b = document.createElement("div");
    b.textContent = Math.round(raw * 100) + "% raw";
    const c = document.createElement("div");
    c.textContent = Math.round(norm * 100) + "% norm";
    weightSummary.append(a, b, c);
  });
}
function rlabel(id) {
  const r = REGIONS.find((x) => x.id === id);
  return r ? r.label : id;
}

// export carries BOTH the design weights and the chosen mesh, ready for stage 3
function exportWeights() {
  const payload = {
    source: "facemesh_map.svg (14 real region groups)",
    mesh: {
      source: chosenMesh.source,
      verts: chosenMesh.verts,
      uvs: chosenMesh.uvs,
      hasTexture: !!chosenMesh.texture,
    },
    regions: REGIONS.map((r) => r.id),
    selectedRegions: [...mstate.selected],
    textures: TEXTURES,
    regionWeights: mstate.weights,
    note: "regionWeights feed the displacement/point-cloud/stud renderers. mesh.verts is the actual geometry to apply them to (canonical or captured).",
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "face_design_" + chosenMesh.source + ".json";
  a.click();
  URL.revokeObjectURL(a.href);

  // captured skin travels as its own PNG (the JSON holds geometry + weights only)
  if (chosenMesh.texture) {
    chosenMesh.texture.save("face_skin", "png");
  }
}

// ---- tiny helper ----
function byId(id) {
  return document.getElementById(id);
}

// ============================================================================
// REDUCED BUILD: face capture removed. App uses the canonical face mesh, the
// weighting SVG (stage 2), and a single textured-mesh render (stage 3). No
// displacement / extrusion / point cloud / studs.
// ============================================================================

function setup() {
  console.log(
    "Future Face sketch.js loaded:",
    APP_VERSION,
    "| FD present:",
    typeof FD !== "undefined",
  );
  const c = createCanvas(windowWidth, max(420, floor(windowHeight * 0.72)), WEBGL);
  c.parent("canvasHolder");
  c.style("position", "relative");
  c.style("z-index", "1");
  textureMode(NORMAL);
  wireRenderStageUI();
  try {
    if (typeof FD === "undefined") {
      throw new Error("facedata.js did not load (FD is undefined)");
    }
    setDefaultMesh();
  } catch (e) {
    console.error("face data failed", e);
  }
  try {
    buildMixer();
  } catch (e) {
    console.error("mixer build failed", e);
  }
  backToWeighting();
  console.log("Future Face setup complete (weighting + mesh render only)");
}

function draw() {
  if (stage === "render") {
    drawStage3();
    return;
  }
  // weighting stage is DOM-driven; canvas idle
}

function setDefaultMesh() {
  chosenMesh = {
    verts: FD.VERTS.map((v) => v.slice()),
    uvs: FD.UVS.map((v) => v.slice()),
    texture: null,
    source: "default",
  };
}

function startOverAll() {
  setDefaultMesh();
  if (typeof startOver === "function") {
    startOver();
  }
  viewZoom = 1;
  backToWeighting();
}

function renderStartOver() {
  viewZoom = 1;
  enterStage3();
}

function backToWeighting() {
  stage = "weight";
  const ch = byId("canvasHolder");
  if (ch) {
    ch.style.display = "none";
  }
  const mc = byId("meshControls");
  if (mc) {
    mc.style.display = "none";
  }
  if (renderUI.panel) {
    renderUI.panel.style.display = "none";
  }
  const sw = byId("stageWeight");
  if (sw) {
    sw.style.display = "grid";
  }
  const sMesh = byId("stepMesh");
  if (sMesh) {
    sMesh.classList.remove("active");
  }
  const sRender = byId("stepRender");
  if (sRender) {
    sRender.classList.remove("active");
  }
  const sWeight = byId("stepWeight");
  if (sWeight) {
    sWeight.classList.add("active");
  }
}

function wireRenderStageUI() {
  const old = document.getElementById("renderControls");
  if (old) {
    old.remove();
  }
  const panel = document.createElement("div");
  panel.id = "renderControls";
  Object.assign(panel.style, {
    position: "fixed",
    left: "0",
    right: "0",
    bottom: "0",
    display: "none",
    flexWrap: "wrap",
    gap: "10px",
    justifyContent: "center",
    alignItems: "center",
    padding: "10px 12px",
    background: "rgba(18,24,34,0.96)",
    borderTop: "1px solid #30394b",
    zIndex: "1000",
    fontFamily: "system-ui, sans-serif",
    color: "#eef3fb",
  });
  document.body.appendChild(panel);
  renderUI.panel = panel;
  const addBtn = (label, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    Object.assign(b.style, {
      border: "1px solid #30394b",
      background: "#202837",
      color: "#eef3fb",
      borderRadius: "10px",
      padding: "9px 13px",
      cursor: "pointer",
      fontSize: "0.9rem",
    });
    b.addEventListener("click", fn);
    panel.appendChild(b);
    return b;
  };
  addBtn("\u2190 back to weighting", backToWeighting);
  addBtn("Start over", renderStartOver);
  addBtn("zoom +", () => {
    zoomBy(1.2);
  });
  addBtn("zoom \u2212", () => {
    zoomBy(1 / 1.2);
  });
  addBtn("Save image + OBJ", () => {
    if (typeof exportStage3 === "function") {
      exportStage3();
    }
  });
}
