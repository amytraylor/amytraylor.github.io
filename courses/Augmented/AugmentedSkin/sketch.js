/*
  Classic-script version.
  THREE and THREE.OrbitControls are loaded by index.html before this file.
  Do not use import statements in this file.
*/

if (typeof THREE === "undefined") {
  throw new Error("THREE is not loaded. Check the script tags in index.html.");
}

if (typeof THREE.OrbitControls === "undefined") {
  throw new Error("THREE.OrbitControls is not loaded. Check the OrbitControls script tag in index.html.");
}


// ------------------------------------------------------------
// Config
// ------------------------------------------------------------
const DESIGN_W = 1000;
const DESIGN_H = 1000;

// ------------------------------------------------------------
// UI
// ------------------------------------------------------------
const ui = {
  showMesh: document.getElementById("showMesh"),
  showPoints: document.getElementById("showPoints"),
  showTriGlyphs: document.getElementById("showTriGlyphs"),
  flipY: document.getElementById("flipY"),
  flipDesignY: document.getElementById("flipDesignY"),
  useCylindricalProjectionTexture: document.getElementById("useCylindricalProjectionTexture"),
  useFrontProjectionTexture: document.getElementById("useFrontProjectionTexture"),
  fitTextureToFaceUvBounds: document.getElementById("fitTextureToFaceUvBounds"),
  filterStretchedTriangles: document.getElementById("filterStretchedTriangles"),

  sampleStep: document.getElementById("sampleStep"),
  sampleStepValue: document.getElementById("sampleStepValue"),

  pointBaseOffset: document.getElementById("pointBaseOffset"),
  pointBaseOffsetValue: document.getElementById("pointBaseOffsetValue"),

  pointMinDisp: document.getElementById("pointMinDisp"),
  pointMinDispValue: document.getElementById("pointMinDispValue"),
  pointMaxDisp: document.getElementById("pointMaxDisp"),
  pointMaxDispValue: document.getElementById("pointMaxDispValue"),

  pointSize: document.getElementById("pointSize"),
  pointSizeValue: document.getElementById("pointSizeValue"),
  maxFloatingPoints: document.getElementById("maxFloatingPoints"),
  maxFloatingPointsValue: document.getElementById("maxFloatingPointsValue"),

  // signed displacement replaced by explicit min/max displacement controls

  triBaseOffset: document.getElementById("triBaseOffset"),
  triBaseOffsetValue: document.getElementById("triBaseOffsetValue"),

  triMinDisp: document.getElementById("triMinDisp"),
  triMinDispValue: document.getElementById("triMinDispValue"),
  triMaxDisp: document.getElementById("triMaxDisp"),
  triMaxDispValue: document.getElementById("triMaxDispValue"),

  triScale: document.getElementById("triScale"),
  triScaleValue: document.getElementById("triScaleValue"),

  demoDesignBtn: document.getElementById("demoDesignBtn"),
  clearDesignBtn: document.getElementById("clearDesignBtn"),

  blurRadius: document.getElementById("blurRadius"),
  blurRadiusValue: document.getElementById("blurRadiusValue"),
  useBlurredDesign: document.getElementById("useBlurredDesign"),
  blurPreviewCanvas: document.getElementById("blurPreviewCanvas"),

  xyzExportStep: document.getElementById("xyzExportStep"),
  xyzExportStepValue: document.getElementById("xyzExportStepValue"),

  processingOverlay: document.getElementById("processingOverlay"),
  buildProgressText: document.getElementById("buildProgressText"),
  buildProgressBar: document.getElementById("buildProgressBar"),

  textureFiles: document.getElementById("textureFiles"),
  textureLibrary: document.getElementById("textureLibrary"),
  stampSize: document.getElementById("stampSize"),
  stampSizeValue: document.getElementById("stampSizeValue"),
  stampOpacity: document.getElementById("stampOpacity"),
  stampOpacityValue: document.getElementById("stampOpacityValue"),
  useTextureStamp: document.getElementById("useTextureStamp"),
  rebuildBtn: document.getElementById("rebuildBtn"),

  stats: document.getElementById("stats")
};

function syncUIText() {
  ui.sampleStepValue.textContent = ui.sampleStep.value;
  ui.pointBaseOffsetValue.textContent = ui.pointBaseOffset.value;
  ui.pointMinDispValue.textContent = ui.pointMinDisp.value;
  ui.pointMaxDispValue.textContent = ui.pointMaxDisp.value;
  ui.pointSizeValue.textContent = ui.pointSize.value;

  if (ui.maxFloatingPointsValue && ui.maxFloatingPoints) {
    ui.maxFloatingPointsValue.textContent = ui.maxFloatingPoints.value;
  }
  ui.triBaseOffsetValue.textContent = ui.triBaseOffset.value;
  ui.triMinDispValue.textContent = ui.triMinDisp.value;
  ui.triMaxDispValue.textContent = ui.triMaxDisp.value;
  ui.triScaleValue.textContent = ui.triScale.value;

  if (ui.stampSizeValue && ui.stampSize) {
    ui.stampSizeValue.textContent = ui.stampSize.value;
  }

  if (ui.stampOpacityValue && ui.stampOpacity) {
    ui.stampOpacityValue.textContent = Number(ui.stampOpacity.value).toFixed(2);
  }

  if (ui.blurRadiusValue && ui.blurRadius) {
    ui.blurRadiusValue.textContent = ui.blurRadius.value;
  }

  if (ui.xyzExportStepValue && ui.xyzExportStep) {
    ui.xyzExportStepValue.textContent = ui.xyzExportStep.value;
  }
}

[
  ui.sampleStep,
  ui.pointBaseOffset,
  ui.pointMinDisp,
  ui.pointMaxDisp,
  ui.pointSize,
  ui.maxFloatingPoints,
  ui.triBaseOffset,
  ui.triMinDisp,
  ui.triMaxDisp,
  ui.triScale,
  ui.stampSize,
  ui.stampOpacity,
  ui.blurRadius,
  ui.xyzExportStep
].filter(Boolean).forEach((el) => el.addEventListener("input", syncUIText));

syncUIText();

function uvYToDesignPixelY(v) {
  // The design canvas has y=0 at the top.
  // The mesh UV data and the model orientation may not use the same vertical convention.
  // When flipDesignY is checked, we flip the image/UV sampling before applying it.
  return ui.flipDesignY && ui.flipDesignY.checked
    ? v * (DESIGN_H - 1)
    : (1 - v) * (DESIGN_H - 1);
}

function computeMeshUvBounds(mesh) {
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  for (const uv of mesh.uvs) {
    minU = Math.min(minU, uv.x);
    maxU = Math.max(maxU, uv.x);
    minV = Math.min(minV, uv.y);
    maxV = Math.max(maxV, uv.y);
  }

  return {
    minU,
    maxU,
    minV,
    maxV,
    spanU: Math.max(1e-9, maxU - minU),
    spanV: Math.max(1e-9, maxV - minV)
  };
}

function computeMeshPositionBounds(mesh) {
  const box = new THREE.Box3().setFromPoints(mesh.positions);
  const min = box.min.clone();
  const max = box.max.clone();
  const center = box.getCenter(new THREE.Vector3());

  return {
    minX: min.x,
    maxX: max.x,
    minY: min.y,
    maxY: max.y,
    minZ: min.z,
    maxZ: max.z,
    centerX: center.x,
    centerY: center.y,
    centerZ: center.z,
    spanX: Math.max(1e-9, max.x - min.x),
    spanY: Math.max(1e-9, max.y - min.y),
    spanZ: Math.max(1e-9, max.z - min.z)
  };
}

function uvToDesignPixel(u, v) {
  if (meshData && meshData.uvBounds && ui.fitTextureToFaceUvBounds && ui.fitTextureToFaceUvBounds.checked) {
    const b = meshData.uvBounds;
    const fu = (u - b.minU) / b.spanU;
    const fv = (v - b.minV) / b.spanV;

    return {
      x: fu * (DESIGN_W - 1),
      y: ui.flipDesignY && ui.flipDesignY.checked
        ? fv * (DESIGN_H - 1)
        : (1 - fv) * (DESIGN_H - 1)
    };
  }

  return {
    x: u * (DESIGN_W - 1),
    y: uvYToDesignPixelY(v)
  };
}

function frontProjectionToDesignPixel(x, y) {
  const b = meshData.positionBounds;
  const fx = (x - b.minX) / b.spanX;
  const fy = (y - b.minY) / b.spanY;

  return {
    x: Math.max(0, Math.min(DESIGN_W - 1, fx * (DESIGN_W - 1))),
    y: Math.max(0, Math.min(DESIGN_H - 1, (1 - fy) * (DESIGN_H - 1)))
  };
}

function cylindricalProjectionToDesignPixel(x, y, z) {
  /*
    Cylindrical wrap:
      horizontal image coordinate = angle around vertical axis
      vertical image coordinate   = height
  */
  const b = meshData.positionBounds;

  let theta = Math.atan2(z - b.centerZ, x - b.centerX);
  let u = (theta + Math.PI) / (Math.PI * 2);

  // Put seam roughly toward the rear. Later this can become a slider.
  u = (u + 0.25) % 1;

  const v = (y - b.minY) / b.spanY;

  return {
    x: Math.max(0, Math.min(DESIGN_W - 1, u * (DESIGN_W - 1))),
    y: Math.max(0, Math.min(DESIGN_H - 1, (1 - v) * (DESIGN_H - 1)))
  };
}

function designPixelForBarycentric(tri, a, b, c) {
  const p0 = tri.pos[0];
  const p1 = tri.pos[1];
  const p2 = tri.pos[2];

  const x = a * p0.x + b * p1.x + c * p2.x;
  const y = a * p0.y + b * p1.y + c * p2.y;
  const z = a * p0.z + b * p1.z + c * p2.z;

  if (ui.useCylindricalProjectionTexture && ui.useCylindricalProjectionTexture.checked) {
    return cylindricalProjectionToDesignPixel(x, y, z);
  }

  if (ui.useFrontProjectionTexture && ui.useFrontProjectionTexture.checked) {
    return frontProjectionToDesignPixel(x, y);
  }

  return {
    x: a * tri.uvPx[0].x + b * tri.uvPx[1].x + c * tri.uvPx[2].x,
    y: a * tri.uvPx[0].y + b * tri.uvPx[1].y + c * tri.uvPx[2].y
  };
}

// ------------------------------------------------------------
// Design canvas
// ------------------------------------------------------------
const designCanvas = document.getElementById("designCanvas");
const dctx = designCanvas.getContext("2d", { willReadFrequently: true });

// Offscreen softened design canvas. The visible designCanvas stays raw.
const blurredDesignCanvas = document.createElement("canvas");
blurredDesignCanvas.width = DESIGN_W;
blurredDesignCanvas.height = DESIGN_H;
const blurredDctx = blurredDesignCanvas.getContext("2d", { willReadFrequently: true });

const blurPreviewCanvas = ui.blurPreviewCanvas;
const blurPreviewCtx = blurPreviewCanvas
  ? blurPreviewCanvas.getContext("2d", { willReadFrequently: true })
  : null;

function updateBlurredDesign() {
  const blurRadius = ui.blurRadius ? Number(ui.blurRadius.value) : 0;

  blurredDctx.save();
  blurredDctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
  blurredDctx.filter = blurRadius > 0 ? `blur(${blurRadius}px)` : "none";
  blurredDctx.drawImage(designCanvas, 0, 0);
  blurredDctx.filter = "none";
  blurredDctx.restore();

  if (blurPreviewCtx && blurPreviewCanvas) {
    blurPreviewCtx.clearRect(0, 0, blurPreviewCanvas.width, blurPreviewCanvas.height);
    blurPreviewCtx.drawImage(blurredDesignCanvas, 0, 0, blurPreviewCanvas.width, blurPreviewCanvas.height);
  }
}

function getActiveDesignContext() {
  return ui.useBlurredDesign && ui.useBlurredDesign.checked ? blurredDctx : dctx;
}

// ------------------------------------------------------------
// Texture choices for painting onto the design canvas
// ------------------------------------------------------------
let textureChoices = [];
let activeTextureIndex = -1;
let stampHistory = [];

function makeTextureCanvas(label, drawFn) {
  const c = document.createElement("canvas");
  c.width = 240;
  c.height = 240;
  const ctx = c.getContext("2d");
  drawFn(ctx, c.width, c.height);
  addTextureChoice(c, label);
}

function addBuiltInTextures() {
  makeTextureCanvas("Water", (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#10314e");
    g.addColorStop(1, "#7ff1ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    for (let r = 18; r < 170; r += 22) {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  makeTextureCanvas("Circuit", (ctx, w, h) => {
    ctx.fillStyle = "#21143f";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#caa8ff";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    for (let y = 30; y < h; y += 55) {
      ctx.beginPath();
      ctx.moveTo(15, y);
      ctx.lineTo(80, y);
      ctx.lineTo(80, y + 28);
      ctx.lineTo(150, y + 28);
      ctx.lineTo(150, y - 10);
      ctx.lineTo(225, y - 10);
      ctx.stroke();
    }

    ctx.fillStyle = "#fff7ff";
    for (let i = 0; i < 14; i++) {
      const x = 25 + (i * 47) % 200;
      const y = 25 + (i * 83) % 190;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  makeTextureCanvas("Scales", (ctx, w, h) => {
    ctx.fillStyle = "#142b1b";
    ctx.fillRect(0, 0, w, h);

    for (let y = -20; y < h + 30; y += 34) {
      for (let x = -20; x < w + 30; x += 42) {
        ctx.strokeStyle = "rgba(160,255,140,0.75)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x + ((y / 34) % 2) * 20, y, 24, 0, Math.PI);
        ctx.stroke();
      }
    }
  });

  makeTextureCanvas("Stars", (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, 170);
    g.addColorStop(0, "#203b7a");
    g.addColorStop(1, "#060b18");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 80; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 1 + Math.random() * 3;
      ctx.fillStyle = Math.random() > 0.75 ? "#ffe6a1" : "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  makeTextureCanvas("Topo", (ctx, w, h) => {
    ctx.fillStyle = "#38271d";
    ctx.fillRect(0, 0, w, h);

    const colors = ["#ffd18a", "#ff9e7e", "#fff0ba"];
    for (let i = 0; i < 15; i++) {
      ctx.strokeStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 4;
      ctx.beginPath();
      const yBase = 10 + i * 17;
      for (let x = -10; x <= w + 10; x += 8) {
        const y = yBase + Math.sin(x * 0.04 + i * 0.9) * 12;
        if (x === -10) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

function addTextureChoice(source, label) {
  if (!ui.textureLibrary) return;

  const entry = { source, label };
  textureChoices.push(entry);

  const idx = textureChoices.length - 1;

  const thumb = document.createElement("div");
  thumb.className = "textureThumb";
  thumb.dataset.index = idx;

  const preview = document.createElement("img");
  if (source instanceof HTMLCanvasElement) {
    preview.src = source.toDataURL("image/png");
  } else {
    preview.src = source.src;
  }

  const caption = document.createElement("div");
  caption.className = "caption";
  caption.textContent = label;

  thumb.appendChild(preview);
  thumb.appendChild(caption);

  thumb.addEventListener("click", () => {
    activeTextureIndex = idx;
    updateTextureSelectionUI();
  });

  ui.textureLibrary.appendChild(thumb);

  if (activeTextureIndex < 0) {
    activeTextureIndex = idx;
    updateTextureSelectionUI();
  }
}

function updateTextureSelectionUI() {
  if (!ui.textureLibrary) return;

  const thumbs = ui.textureLibrary.querySelectorAll(".textureThumb");
  thumbs.forEach((el) => {
    const idx = Number(el.dataset.index);
    el.classList.toggle("selected", idx === activeTextureIndex);
  });
}

function loadTextureFiles(files) {
  for (const file of files) {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        addTextureChoice(img, file.name);
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  }
}

function stampActiveTexture(px, py) {
  if (!ui.useTextureStamp || !ui.useTextureStamp.checked) return false;
  if (activeTextureIndex < 0) return false;
  if (!textureChoices[activeTextureIndex]) return false;

  const tex = textureChoices[activeTextureIndex].source;
  const size = Number(ui.stampSize.value);
  const opacity = Number(ui.stampOpacity.value);

  dctx.save();
  dctx.globalAlpha = opacity;
  dctx.drawImage(tex, px - size / 2, py - size / 2, size, size);
  dctx.restore();

  stampHistory.push({
    time: new Date().toISOString(),
    textureIndex: activeTextureIndex,
    textureLabel: textureChoices[activeTextureIndex].label,
    x: px,
    y: py,
    size,
    opacity
  });

  updateBlurredDesign();

  return true;
}

if (ui.textureFiles) {
  ui.textureFiles.addEventListener("change", (e) => {
    loadTextureFiles(e.target.files);
  });
}

addBuiltInTextures();


function clearDesign() {
  dctx.clearRect(0, 0, DESIGN_W, DESIGN_H);

  // Neutral gray keeps blank areas near the midpoint between min and max displacement.
  // That makes the black/white geometric design easy to read against a neutral baseline.
  dctx.fillStyle = "rgb(128, 128, 128)";
  dctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
}

function drawDemoDesign() {
  clearDesign();

  // Start from a white field so the demo reads clearly as a black/white displacement map.
  dctx.fillStyle = "white";
  dctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  dctx.save();
  dctx.strokeStyle = "black";
  dctx.fillStyle = "black";
  dctx.lineWidth = 10;

  // Large anchor circles
  const large = [
    [210, 180, 95], [500, 160, 120], [805, 195, 85],
    [180, 480, 130], [500, 500, 180], [830, 470, 120],
    [240, 800, 100], [520, 820, 140], [795, 780, 110]
  ];

  for (const [x, y, r] of large) {
    dctx.beginPath();
    dctx.arc(x, y, r, 0, Math.PI * 2);
    dctx.stroke();
  }

  // Filled black circles
  const filled = [
    [150, 150, 24], [320, 270, 36], [640, 220, 28], [865, 140, 18],
    [260, 520, 48], [520, 500, 60], [770, 540, 40],
    [170, 760, 30], [415, 735, 22], [610, 885, 34], [840, 785, 26]
  ];

  for (const [x, y, r] of filled) {
    dctx.beginPath();
    dctx.arc(x, y, r, 0, Math.PI * 2);
    dctx.fill();
  }

  // Concentric target rings
  const targets = [
    [360, 160, [18, 40, 68]],
    [685, 430, [24, 56, 92]],
    [345, 675, [20, 46, 78]],
    [690, 790, [16, 38, 64]]
  ];

  for (const [x, y, rings] of targets) {
    for (const r of rings) {
      dctx.beginPath();
      dctx.arc(x, y, r, 0, Math.PI * 2);
      dctx.stroke();
    }
    dctx.beginPath();
    dctx.arc(x, y, 8, 0, Math.PI * 2);
    dctx.fill();
  }

  // Dot grid with varying sizes to make displacement easy to inspect.
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 5; gx++) {
      const x = 120 + gx * 190 + (gy % 2) * 30;
      const y = 335 + gy * 155;
      const r = 8 + ((gx + gy * 2) % 5) * 7;

      dctx.beginPath();
      dctx.arc(x, y, r, 0, Math.PI * 2);
      if ((gx + gy) % 2 === 0) dctx.fill();
      else dctx.stroke();
    }
  }

  dctx.restore();
}
clearDesign();
drawDemoDesign();
updateBlurredDesign();

// Simple paint tool on design canvas
let drawing = false;
let lastPos = null;

function getCanvasPos(e) {
  const rect = designCanvas.getBoundingClientRect();

  return {
    x: (e.clientX - rect.left) * (DESIGN_W / rect.width),
    y: (e.clientY - rect.top) * (DESIGN_H / rect.height)
  };
}

designCanvas.addEventListener("pointerdown", (e) => {
  drawing = true;
  lastPos = getCanvasPos(e);

  if (ui.useTextureStamp && ui.useTextureStamp.checked && activeTextureIndex >= 0) {
    stampActiveTexture(lastPos.x, lastPos.y);
  }
});

designCanvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;

  const p = getCanvasPos(e);

  if (ui.useTextureStamp && ui.useTextureStamp.checked && activeTextureIndex >= 0) {
    stampActiveTexture(p.x, p.y);
  } else {
    dctx.strokeStyle = "black";
    dctx.lineWidth = 16;
    dctx.lineCap = "round";
    dctx.lineJoin = "round";

    dctx.beginPath();
    dctx.moveTo(lastPos.x, lastPos.y);
    dctx.lineTo(p.x, p.y);
    dctx.stroke();
  }

  lastPos = p;
});

window.addEventListener("pointerup", () => {
  if (drawing) {
    updateBlurredDesign();
    rebuildFloatingGeometry();
  }
  drawing = false;
  lastPos = null;
});

// ------------------------------------------------------------
// Three.js scene
// ------------------------------------------------------------
const viewer = document.getElementById("viewer");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  45,
  viewer.clientWidth / viewer.clientHeight,
  0.1,
  5000
);
camera.position.set(0, 0, 420);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));

const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(1, 1, 2);
scene.add(dir);

const contentGroup = new THREE.Group();
scene.add(contentGroup);

function applyModelOrientation() {
  // The exported face mesh uses an image/screen-like vertical axis.
  // Three.js displays Y-up, so the face appears upside down unless we flip Y.
  contentGroup.scale.y = ui.flipY && ui.flipY.checked ? -1 : 1;
}

applyModelOrientation();

let meshData = null;
let baseWire = null;
let floatingPoints = null;
let triGlyphs = null;
let uvLookup = null;
let uvAccel = null;
let samplerInfo = null;

// Used to cancel an in-progress floating-point rebuild if a new slider/image
// change happens before the previous build finishes.
let floatingBuildToken = 0;
let floatingBuildStatus = {
  building: false,
  renderedCount: 0,
  availableCount: 0,
  maxPoints: 0
};

window.addEventListener("resize", onResize);

function onResize() {
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;

  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------
// Mesh loading and preprocessing
// ------------------------------------------------------------
async function loadMesh(url) {
  const raw = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Could not load ${url}`);
    return r.json();
  });

  const positions = raw.positions.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const uvs = raw.uvs.map((uv) => new THREE.Vector2(uv[0], uv[1]));
  const triangles = raw.triangles.map((t) => [t[0], t[1], t[2]]);

  // Center and scale mesh for viewing
  const box = new THREE.Box3().setFromPoints(positions);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 260 / maxDim;

  positions.forEach((p) => p.sub(center).multiplyScalar(scale));

  return {
    positions,
    uvs,
    triangles,
    vertexNormals: [],
    triangleData: [],
    uvCoverage: 0
  };
}

function computeVertexNormals(mesh) {
  const normals = mesh.positions.map(() => new THREE.Vector3(0, 0, 0));

  for (const tri of mesh.triangles) {
    const a = mesh.positions[tri[0]];
    const b = mesh.positions[tri[1]];
    const c = mesh.positions[tri[2]];

    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    const faceNormal = new THREE.Vector3().crossVectors(ab, ac);

    normals[tri[0]].add(faceNormal);
    normals[tri[1]].add(faceNormal);
    normals[tri[2]].add(faceNormal);
  }

  normals.forEach((n) => n.normalize());
  mesh.vertexNormals = normals;
}

function triangleSurfaceArea(tri) {
  const abx = tri.pos[1].x - tri.pos[0].x;
  const aby = tri.pos[1].y - tri.pos[0].y;
  const abz = tri.pos[1].z - tri.pos[0].z;

  const acx = tri.pos[2].x - tri.pos[0].x;
  const acy = tri.pos[2].y - tri.pos[0].y;
  const acz = tri.pos[2].z - tri.pos[0].z;

  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;

  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}


function buildTriangleData(mesh) {
  const tris = [];

  mesh.uvBounds = computeMeshUvBounds(mesh);
  mesh.positionBounds = computeMeshPositionBounds(mesh);

  let totalUvAreaPx = 0;
  const maxEdges = [];

  for (let i = 0; i < mesh.triangles.length; i++) {
    const [ia, ib, ic] = mesh.triangles[i];

    const pa = mesh.positions[ia].clone();
    const pb = mesh.positions[ib].clone();
    const pc = mesh.positions[ic].clone();

    const uva = mesh.uvs[ia].clone();
    const uvb = mesh.uvs[ib].clone();
    const uvc = mesh.uvs[ic].clone();

    const center = new THREE.Vector3()
      .add(pa)
      .add(pb)
      .add(pc)
      .multiplyScalar(1 / 3);

    const uvCenter = new THREE.Vector2()
      .add(uva)
      .add(uvb)
      .add(uvc)
      .multiplyScalar(1 / 3);

    const faceNormal = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(pb, pa),
        new THREE.Vector3().subVectors(pc, pa)
      )
      .normalize();

    const smoothNormal = new THREE.Vector3()
      .add(mesh.vertexNormals[ia])
      .add(mesh.vertexNormals[ib])
      .add(mesh.vertexNormals[ic])
      .multiplyScalar(1 / 3)
      .normalize();

    const da = uvToDesignPixel(uva.x, uva.y);
    const db = uvToDesignPixel(uvb.x, uvb.y);
    const dc = uvToDesignPixel(uvc.x, uvc.y);

    const uvPx = [
      new THREE.Vector2(da.x, da.y),
      new THREE.Vector2(db.x, db.y),
      new THREE.Vector2(dc.x, dc.y)
    ];

    const uvAreaPx = Math.abs(
      (uvPx[1].x - uvPx[0].x) * (uvPx[2].y - uvPx[0].y) -
      (uvPx[2].x - uvPx[0].x) * (uvPx[1].y - uvPx[0].y)
    ) * 0.5;

    totalUvAreaPx += uvAreaPx;

    const e01 = pa.distanceTo(pb);
    const e12 = pb.distanceTo(pc);
    const e20 = pc.distanceTo(pa);
    const maxEdge = Math.max(e01, e12, e20);
    maxEdges.push(maxEdge);

    const tri = {
      index: i,
      ids: [ia, ib, ic],
      pos: [pa, pb, pc],
      uv: [uva, uvb, uvc],
      uvPx,
      uvAreaPx,
      maxEdge,
      surfaceArea: triangleSurfaceArea({
        pos: [pa, pb, pc]
      }),
      center,
      uvCenter,
      faceNormal,
      smoothNormal,
      sampleable: true
    };

    tris.push(tri);
  }

  const sortedEdges = [...maxEdges].sort((a, b) => a - b);

  // Less aggressive than the previous p95 filter.
  // It removes only the most extreme boundary triangles but keeps more side/back support.
  const edge99 = sortedEdges[Math.floor(sortedEdges.length * 0.99)] || Infinity;

  for (const tri of tris) {
    tri.sampleable = tri.maxEdge <= edge99 && tri.uvAreaPx > 1e-6;
  }

  mesh.triangleData = tris;
  mesh.uvCoverage = Math.max(0.01, Math.min(1, totalUvAreaPx / (DESIGN_W * DESIGN_H)));
  mesh.sampleFilter = {
    maxEdge99: edge99,
    sampleableTriangles: tris.filter((t) => t.sampleable).length,
    totalTriangles: tris.length
  };
}

// ------------------------------------------------------------
// Geometry builders
// ------------------------------------------------------------
function buildBaseWire(mesh) {
  if (baseWire) contentGroup.remove(baseWire);

  const geometry = new THREE.BufferGeometry();
  const flatPositions = [];

  mesh.positions.forEach((p) => flatPositions.push(p.x, p.y, p.z));

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(flatPositions, 3));
  geometry.setIndex(mesh.triangles.flat());

  const wire = new THREE.WireframeGeometry(geometry);

  baseWire = new THREE.LineSegments(
    wire,
    new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.75
    })
  );

  baseWire.visible = ui.showMesh.checked;
  contentGroup.add(baseWire);
}

function barycentric2D(px, py, a, b, c) {
  const denom =
    (b.y - c.y) * (a.x - c.x) +
    (c.x - b.x) * (a.y - c.y);

  if (Math.abs(denom) < 1e-9) return null;

  const u =
    ((b.y - c.y) * (px - c.x) +
      (c.x - b.x) * (py - c.y)) / denom;

  const v =
    ((c.y - a.y) * (px - c.x) +
      (a.x - c.x) * (py - c.y)) / denom;

  const w = 1 - u - v;

  return { u, v, w };
}

function buildUvAcceleration(mesh, cellSize = 64) {
  const cols = Math.ceil(DESIGN_W / cellSize);
  const rows = Math.ceil(DESIGN_H / cellSize);
  const cells = Array.from({ length: cols * rows }, () => []);

  function clampCellX(v) {
    return Math.max(0, Math.min(cols - 1, Math.floor(v / cellSize)));
  }

  function clampCellY(v) {
    return Math.max(0, Math.min(rows - 1, Math.floor(v / cellSize)));
  }

  function cellIndex(cx, cy) {
    return cy * cols + cx;
  }

  for (const tri of mesh.triangleData) {
    const xs = tri.uvPx.map((p) => p.x);
    const ys = tri.uvPx.map((p) => p.y);

    const minX = clampCellX(Math.min(...xs));
    const maxX = clampCellX(Math.max(...xs));
    const minY = clampCellY(Math.min(...ys));
    const maxY = clampCellY(Math.max(...ys));

    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        cells[cellIndex(cx, cy)].push(tri.index);
      }
    }
  }

  return { cellSize, cols, rows, cells };
}

function findContainingTriangleAtUvPixel(mesh, accel, x, y) {
  const cx = Math.max(0, Math.min(accel.cols - 1, Math.floor(x / accel.cellSize)));
  const cy = Math.max(0, Math.min(accel.rows - 1, Math.floor(y / accel.cellSize)));
  const eps = 1e-5;
  const candidates = new Set();

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const ncx = cx + ox;
      const ncy = cy + oy;
      if (ncx < 0 || ncx >= accel.cols || ncy < 0 || ncy >= accel.rows) continue;
      const arr = accel.cells[ncy * accel.cols + ncx];
      for (const triIndex of arr) candidates.add(triIndex);
    }
  }

  for (const triIndex of candidates) {
    const tri = mesh.triangleData[triIndex];

    if (ui.filterStretchedTriangles && ui.filterStretchedTriangles.checked && !tri.sampleable) {
      continue;
    }

    const bc = barycentric2D(x, y, tri.uvPx[0], tri.uvPx[1], tri.uvPx[2]);
    if (!bc) continue;
    if (bc.u >= -eps && bc.v >= -eps && bc.w >= -eps) {
      return {
        tri,
        a: bc.u,
        b: bc.v,
        c: bc.w
      };
    }
  }

  return null;
}

function buildSurfaceSamplePlan(mesh, targetCount) {
  const safeTarget = Math.max(0, Math.floor(targetCount || 0));
  const useFilter = ui.filterStretchedTriangles && ui.filterStretchedTriangles.checked;

  const sampleable = [];
  let totalArea = 0;

  for (let i = 0; i < mesh.triangleData.length; i++) {
    const tri = mesh.triangleData[i];

    if (useFilter && !tri.sampleable) continue;

    const area = Math.max(0, tri.surfaceArea || triangleSurfaceArea(tri));
    if (area <= 0) continue;

    sampleable.push({ index: i, area });
    totalArea += area;
  }

  if (sampleable.length === 0) {
    return {
      mode: "surface-area-front-projection",
      targetCount: 0,
      allocations: new Array(mesh.triangleData.length).fill(0),
      totalSurfaceArea: 0,
      minSamplesPerTriangle: 0,
      maxSamplesPerTriangle: 0,
      sampleableTriangles: 0
    };
  }

  const allocations = new Array(mesh.triangleData.length).fill(0);
  const remainders = [];
  let allocated = 0;

  for (const item of sampleable) {
    const exact = safeTarget * item.area / totalArea;
    const base = Math.floor(exact);
    allocations[item.index] = base;
    allocated += base;
    remainders.push({ index: item.index, frac: exact - base });
  }

  let leftover = safeTarget - allocated;
  remainders.sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < leftover; i++) {
    allocations[remainders[i % remainders.length].index]++;
  }

  let minSamples = Infinity;
  let maxSamples = 0;

  for (const item of sampleable) {
    const n = allocations[item.index];
    minSamples = Math.min(minSamples, n);
    maxSamples = Math.max(maxSamples, n);
  }

  if (!Number.isFinite(minSamples)) minSamples = 0;

  return {
    mode: "surface-area-front-projection",
    targetCount: safeTarget,
    allocations,
    totalSurfaceArea: totalArea,
    minSamplesPerTriangle: minSamples,
    maxSamplesPerTriangle: maxSamples,
    sampleableTriangles: sampleable.length
  };
}

function fract(x) {
  return x - Math.floor(x);
}

function sampleTriangleBarycentric(sampleIndex, sampleCount, triIndex) {
  if (sampleCount <= 1) {
    return { a: 1 / 3, b: 1 / 3, c: 1 / 3 };
  }

  // Low-discrepancy deterministic sequence folded into a triangle.
  let u = fract((sampleIndex + 0.5) * 0.7548776662466927 + (triIndex + 1) * 0.137);
  let v = fract((sampleIndex + 0.5) * 0.5698402909980532 + (triIndex + 1) * 0.371);

  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }

  return {
    a: 1 - u - v,
    b: u,
    c: v
  };
}

function buildUvLookup(mesh, sampleStep) {
  /*
    Surface-area exact sampler with front-projection texture mapping.

    The 3D point density is distributed by triangle surface area.
    The image value is sampled by projecting the 3D point into the front X/Y
    bounding box by default. This makes the whole design image show across the
    face instead of only a small UV island crop.
  */

  const requestedStep = Math.max(1, parseInt(sampleStep, 10) || 1);
  const maxPoints = ui.maxFloatingPoints
    ? parseInt(ui.maxFloatingPoints.value, 10)
    : 360000;

  const safeMaxPoints = Number.isFinite(maxPoints) && maxPoints > 0
    ? maxPoints
    : 360000;

  const plan = buildSurfaceSamplePlan(mesh, safeMaxPoints);

  return {
    mode: ui.useCylindricalProjectionTexture && ui.useCylindricalProjectionTexture.checked
      ? "surface-area-cylindrical-wrap"
      : (ui.useFrontProjectionTexture && ui.useFrontProjectionTexture.checked
        ? "surface-area-front-projection"
        : "surface-area-fitted-uv"),
    requestedStep,
    effectiveStep: "surface-area",
    stepMultiplier: 1,
    totalGridSamples: safeMaxPoints,
    effectiveGridSamples: safeMaxPoints,
    estimatedVisibleSamples: safeMaxPoints,
    estimatedVisibleAfterCap: safeMaxPoints,
    targetSamplesPerVisibleCell: 1,
    subsamplesBase: 1,
    subsamplesFraction: 0,
    maxPoints: safeMaxPoints,
    targetCount: plan.targetCount,
    uvCoverage: mesh.uvCoverage || 1,
    triangleCount: mesh.triangleData.length,
    totalSurfaceArea: plan.totalSurfaceArea,
    allocations: plan.allocations,
    sampleableTriangles: plan.sampleableTriangles,
    totalTriangles: mesh.triangleData.length,
    maxEdge99: mesh.sampleFilter ? mesh.sampleFilter.maxEdge99 : null,
    minSamplesPerTriangle: plan.minSamplesPerTriangle,
    maxSamplesPerTriangle: plan.maxSamplesPerTriangle,
    maxSubdivisionsPerTriangle: "n/a"
  };
}

function sampleImageDataRGBA(imageData, x, y) {
  const ix = Math.max(0, Math.min(DESIGN_W - 1, Math.floor(x)));
  const iy = Math.max(0, Math.min(DESIGN_H - 1, Math.floor(y)));
  const off = (iy * DESIGN_W + ix) * 4;

  const r = imageData[off];
  const g = imageData[off + 1];
  const b = imageData[off + 2];
  const a = imageData[off + 3];

  return {
    r,
    g,
    b,
    a,
    brightness: (r + g + b) / 3
  };
}

function sampleCanvasRGBAFrom(ctx, x, y) {
  const data = ctx.getImageData(
    Math.max(0, Math.min(DESIGN_W - 1, Math.floor(x))),
    Math.max(0, Math.min(DESIGN_H - 1, Math.floor(y))),
    1,
    1
  ).data;

  return {
    r: data[0],
    g: data[1],
    b: data[2],
    a: data[3],
    brightness: (data[0] + data[1] + data[2]) / 3
  };
}

function sampleCanvasRGBA(x, y) {
  return sampleCanvasRGBAFrom(getActiveDesignContext(), x, y);
}

function interpolateTrianglePositionAndNormal(tri, a, b, c) {
  const p = new THREE.Vector3()
    .addScaledVector(tri.pos[0], a)
    .addScaledVector(tri.pos[1], b)
    .addScaledVector(tri.pos[2], c);

  const n = new THREE.Vector3()
    .addScaledVector(meshData.vertexNormals[tri.ids[0]], a)
    .addScaledVector(meshData.vertexNormals[tri.ids[1]], b)
    .addScaledVector(meshData.vertexNormals[tri.ids[2]], c)
    .normalize();

  return { p, n };
}

function setBuildProgress(visible, text, percent) {
  if (ui.processingOverlay) {
    ui.processingOverlay.style.display = visible ? "flex" : "none";
  }

  if (ui.buildProgressText && text) {
    ui.buildProgressText.textContent = text;
  }

  if (ui.buildProgressBar && Number.isFinite(percent)) {
    ui.buildProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
}

function buildFloatingPoints(mesh, uvLookupObj) {
  /*
    Build exactly the allocated number of samples, distributed by 3D surface area.
    Texture/color/displacement comes from front projection by default.
  */

  const token = ++floatingBuildToken;

  if (floatingPoints) {
    contentGroup.remove(floatingPoints);
    if (floatingPoints.geometry) floatingPoints.geometry.dispose();
    if (floatingPoints.material) floatingPoints.material.dispose();
    floatingPoints = null;
  }

  const baseOffset = parseFloat(ui.pointBaseOffset.value);
  const minDisp = parseFloat(ui.pointMinDisp.value);
  const maxDisp = parseFloat(ui.pointMaxDisp.value);
  const pointSize = parseFloat(ui.pointSize.value);

  const targetCount = uvLookupObj.targetCount || uvLookupObj.maxPoints || 360000;
  const allocations = uvLookupObj.allocations || buildSurfaceSamplePlan(mesh, targetCount).allocations;

  const positions = new Float32Array(targetCount * 3);
  const colors = new Float32Array(targetCount * 3);

  const activeCtx = getActiveDesignContext();
  const designPixels = activeCtx.getImageData(0, 0, DESIGN_W, DESIGN_H).data;

  let triIndex = 0;
  let localIndex = 0;
  let renderedCount = 0;

  floatingBuildStatus = {
    building: true,
    renderedCount: 0,
    availableCount: targetCount,
    maxPoints: targetCount,
    testedCount: 0,
    requestedStep: uvLookupObj.requestedStep,
    effectiveStep: uvLookupObj.effectiveStep,
    samplerMode: uvLookupObj.mode
  };

  setBuildProgress(true, "Building surface-density point cloud...", 0);
  if (typeof updateStatsText === "function") updateStatsText();

  function processBatch() {
    if (token !== floatingBuildToken) return;

    const BATCH_SIZE = 8000;
    let batchCount = 0;

    while (
      batchCount < BATCH_SIZE &&
      triIndex < mesh.triangleData.length &&
      renderedCount < targetCount
    ) {
      const triSampleCount = allocations[triIndex] || 0;

      if (localIndex >= triSampleCount) {
        triIndex++;
        localIndex = 0;
        continue;
      }

      const tri = mesh.triangleData[triIndex];
      const bary = sampleTriangleBarycentric(localIndex, triSampleCount, triIndex);
      localIndex++;

      const a = bary.a;
      const b = bary.b;
      const c = bary.c;

      const p0 = tri.pos[0];
      const p1 = tri.pos[1];
      const p2 = tri.pos[2];

      const px = a * p0.x + b * p1.x + c * p2.x;
      const py = a * p0.y + b * p1.y + c * p2.y;
      const pz = a * p0.z + b * p1.z + c * p2.z;

      const n0 = mesh.vertexNormals[tri.ids[0]];
      const n1 = mesh.vertexNormals[tri.ids[1]];
      const n2 = mesh.vertexNormals[tri.ids[2]];

      let nx = a * n0.x + b * n1.x + c * n2.x;
      let ny = a * n0.y + b * n1.y + c * n2.y;
      let nz = a * n0.z + b * n1.z + c * n2.z;

      const invLen = 1 / Math.max(1e-12, Math.sqrt(nx * nx + ny * ny + nz * nz));
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const dp = designPixelForBarycentric(tri, a, b, c);
      const sample = sampleImageDataRGBA(designPixels, dp.x, dp.y);
      const brightness = sample.brightness / 255;
      const displacement = minDisp + (maxDisp - minDisp) * brightness;
      const offset = baseOffset + displacement;

      const k = renderedCount * 3;
      positions[k] = px + nx * offset;
      positions[k + 1] = py + ny * offset;
      positions[k + 2] = pz + nz * offset;

      colors[k] = sample.r / 255;
      colors[k + 1] = sample.g / 255;
      colors[k + 2] = sample.b / 255;

      renderedCount++;
      batchCount++;
    }

    floatingBuildStatus.renderedCount = renderedCount;
    floatingBuildStatus.testedCount = renderedCount;

    const percent = 100 * renderedCount / Math.max(1, targetCount);
    setBuildProgress(
      true,
      `Building surface-density point cloud: ${renderedCount.toLocaleString()} / ${targetCount.toLocaleString()} points`,
      percent
    );

    if (typeof updateStatsText === "function") updateStatsText();

    if (renderedCount < targetCount && triIndex < mesh.triangleData.length) {
      requestAnimationFrame(processBatch);
      return;
    }

    if (token !== floatingBuildToken) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions.subarray(0, renderedCount * 3), 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors.subarray(0, renderedCount * 3), 3));

    const material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      sizeAttenuation: true
    });

    floatingPoints = new THREE.Points(geometry, material);
    floatingPoints.visible = ui.showPoints.checked;
    floatingPoints.userData.renderedCount = renderedCount;
    floatingPoints.userData.availableCount = targetCount;
    floatingPoints.userData.testedCount = renderedCount;
    floatingPoints.userData.samplerMode = uvLookupObj.mode;

    floatingBuildStatus = {
      building: false,
      renderedCount,
      availableCount: targetCount,
      maxPoints: targetCount,
      testedCount: renderedCount,
      requestedStep: uvLookupObj.requestedStep,
      effectiveStep: uvLookupObj.effectiveStep,
      samplerMode: uvLookupObj.mode
    };

    contentGroup.add(floatingPoints);
    setBuildProgress(false, "Surface-density point cloud complete.", 100);

    if (typeof updateStatsText === "function") updateStatsText();
  }

  requestAnimationFrame(processBatch);
}

function buildTriangleCenterGlyphs(mesh) {
  if (triGlyphs) contentGroup.remove(triGlyphs);

  const baseOffset = parseFloat(ui.triBaseOffset.value);
  const minDisp = parseFloat(ui.triMinDisp.value);
  const maxDisp = parseFloat(ui.triMaxDisp.value);
  const radius = parseFloat(ui.triScale.value);

  const sphereGeo = new THREE.SphereGeometry(1, 10, 10);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.1
  });

  const inst = new THREE.InstancedMesh(sphereGeo, sphereMat, mesh.triangleData.length);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  let count = 0;

  for (const tri of mesh.triangleData) {
    const ux = tri.uvCenter.x * (DESIGN_W - 1);
    const uy = uvYToDesignPixelY(tri.uvCenter.y);

    const sample = sampleCanvasRGBA(ux, uy);
    const b = sample.brightness / 255;

    const delta = THREE.MathUtils.lerp(minDisp, maxDisp, b);
    const offset = baseOffset + delta;
    const pos = tri.center.clone().addScaledVector(tri.smoothNormal, offset);

    // Let size vary a little with brightness but keep every glyph visible.
    const s = radius * (0.55 + 0.9 * b);

    dummy.position.copy(pos);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();

    inst.setMatrixAt(count, dummy.matrix);

    color.setRGB(sample.r / 255, sample.g / 255, sample.b / 255);
    inst.setColorAt(count, color);

    count++;
  }

  inst.count = count;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

  triGlyphs = inst;
  triGlyphs.visible = ui.showTriGlyphs.checked;
  contentGroup.add(triGlyphs);
}

// ------------------------------------------------------------
// Rebuild
// ------------------------------------------------------------
function updateStatsText() {
  if (!meshData || !uvLookup) return;

  const renderedFloating = floatingPoints
    ? floatingPoints.userData.renderedCount
    : floatingBuildStatus.renderedCount;

  const buildLine = floatingBuildStatus.building
    ? `floating point build: building ${renderedFloating.toLocaleString()} / ${uvLookup.targetCount.toLocaleString()}`
    : `floating point build: complete`;

  ui.stats.textContent =
    `vertices: ${meshData.positions.length}
triangles: ${meshData.triangles.length}
sampleable triangles: ${uvLookup.sampleableTriangles}/${uvLookup.totalTriangles}
target floating points: ${uvLookup.targetCount.toLocaleString()}
rendered floating points: ${renderedFloating.toLocaleString()}
${buildLine}
triangle glyphs: ${meshData.triangleData.length}
sampler mode: ${uvLookup.mode}
texture mapping: ${ui.useCylindricalProjectionTexture && ui.useCylindricalProjectionTexture.checked ? "cylindrical wrap" : (ui.useFrontProjectionTexture && ui.useFrontProjectionTexture.checked ? "front X/Y projection" : "fitted UV")}
stretched boundary filter: ${ui.filterStretchedTriangles && ui.filterStretchedTriangles.checked ? "on" : "off"}
samples per sampleable triangle: ${uvLookup.minSamplesPerTriangle.toLocaleString()}–${uvLookup.maxSamplesPerTriangle.toLocaleString()}

brightness mapping:
displacement = lerp(minDisp, maxDisp, brightness)

point allocation:
samples per triangle ∝ 3D triangle surface area`;
}

function rebuildFloatingGeometry() {
  if (!meshData) return;

  updateBlurredDesign();

  // Rebuild triangle UV pixel coordinates each time so flipDesignY takes effect.
  buildTriangleData(meshData);
  uvAccel = buildUvAcceleration(meshData, 64);

  const sampleStep = parseInt(ui.sampleStep.value, 10);
  uvLookup = buildUvLookup(meshData, sampleStep);
  samplerInfo = uvLookup;

  // Triangle glyphs are only 852 instances, so this is fine to build at once.
  buildTriangleCenterGlyphs(meshData);

  // Floating point cloud is built in small batches and then stops.
  buildFloatingPoints(meshData, uvLookup);

  if (baseWire) baseWire.visible = ui.showMesh.checked;
  if (triGlyphs) triGlyphs.visible = ui.showTriGlyphs.checked;

  updateStatsText();
}
// ------------------------------------------------------------
// Events
// ------------------------------------------------------------
ui.showMesh.addEventListener("change", () => {
  if (baseWire) baseWire.visible = ui.showMesh.checked;
});

ui.showPoints.addEventListener("change", () => {
  if (floatingPoints) floatingPoints.visible = ui.showPoints.checked;
});

ui.showTriGlyphs.addEventListener("change", () => {
  if (triGlyphs) triGlyphs.visible = ui.showTriGlyphs.checked;
});

if (ui.flipY) {
  ui.flipY.addEventListener("change", applyModelOrientation);
}

[
  ui.sampleStep,
  ui.pointBaseOffset,
  ui.pointMinDisp,
  ui.pointMaxDisp,
  ui.pointSize,
  ui.flipDesignY,
  ui.triBaseOffset,
  ui.triMinDisp,
  ui.triMaxDisp,
  ui.triScale
].filter(Boolean).forEach((el) => el.addEventListener("change", rebuildFloatingGeometry));

ui.rebuildBtn.addEventListener("click", rebuildFloatingGeometry);

if (ui.maxFloatingPoints) {
  ui.maxFloatingPoints.addEventListener("change", rebuildFloatingGeometry);
}

if (ui.blurRadius) {
  ui.blurRadius.addEventListener("input", () => {
    updateBlurredDesign();
  });
}

ui.demoDesignBtn.addEventListener("click", () => {
  drawDemoDesign();
  updateBlurredDesign();
  rebuildFloatingGeometry();
});

ui.clearDesignBtn.addEventListener("click", () => {
  clearDesign();
  updateBlurredDesign();
  rebuildFloatingGeometry();
});


// ------------------------------------------------------------

// ------------------------------------------------------------
// Compatibility helper
// ------------------------------------------------------------
function radicalInverseForCompatibility(index, base) {
  let result = 0;
  let f = 1 / base;
  let i = index;

  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }

  return result;
}

function lowDiscrepancyDesignPoint(index) {
  // Kept for compatibility with project/export helpers from earlier builds.
  // The current renderer uses surface-area sampling plus designPixelForBarycentric.
  return {
    x: radicalInverseForCompatibility(index, 2) * (DESIGN_W - 1),
    y: radicalInverseForCompatibility(index, 3) * (DESIGN_H - 1)
  };
}

// Public app context for export_tools.js
// ------------------------------------------------------------
window.FloatingSkinApp = {
  getContext() {
    return {
      DESIGN_W,
      DESIGN_H,
      ui,
      renderer,
      scene,
      camera,
      controls,
      contentGroup,
      meshData,
      baseWire,
      floatingPoints,
      triGlyphs,
      uvLookup,
      uvAccel,
      samplerInfo,
      designCanvas,
      dctx,
      blurredDesignCanvas,
      blurredDctx,
      textureChoices,
      activeTextureIndex,
      stampHistory,
      floatingBuildStatus,
      rebuildFloatingGeometry,
      updateBlurredDesign,
      buildTriangleData,
      buildUvAcceleration,
      findContainingTriangleAtUvPixel,
      interpolateTrianglePositionAndNormal,
      sampleCanvasRGBAFrom,
      getActiveDesignContext,
      sampleImageDataRGBA,
      designPixelForBarycentric,
      cylindricalProjectionToDesignPixel,
      frontProjectionToDesignPixel,
      buildSurfaceSamplePlan,
      sampleTriangleBarycentric,
      lowDiscrepancyDesignPoint,
      uvYToDesignPixelY
    };
  }
};

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function init() {
  meshData = await loadMesh("./preset_face_mesh.json");

  computeVertexNormals(meshData);
  buildTriangleData(meshData);
  uvAccel = buildUvAcceleration(meshData, 64);
  buildBaseWire(meshData);
  updateBlurredDesign();
  rebuildFloatingGeometry();

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

init().catch((err) => {
  console.error(err);
  ui.stats.textContent =
    "Error loading sketch.\n\n" +
    err.message +
    "\n\nMake sure index.html, sketch.js, and preset_face_mesh.json are in the same folder, and run from a local server, not file://.";
});
