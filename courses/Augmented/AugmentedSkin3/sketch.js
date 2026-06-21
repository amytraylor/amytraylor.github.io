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

const MODEL_SOURCES = {
  face: "./preset_face_mesh.json",
  student_bald3: "./student_bald3_mesh.json",
  student_bald13: "./student_bald13_mesh.json",
  student_bald38: "./student_bald38_mesh.json",
  student_brunette: "./student_brunette_mesh.json",
  student_mpfb: "./student_mpfb_mesh.json",
  hands: "./preset_hands_mesh.json",
  faceHands: "./preset_face_hands_mesh.json",
  rightHand: "./preset_right_hand_mesh.json",
  leftHand: "./preset_left_hand_mesh.json"
};

const MODEL_LABELS = {
  face: "Base classroom head",
  student_bald3: "Bald head 3",
  student_bald13: "Bald head 13",
  student_bald38: "Bald head 38",
  student_brunette: "Brunette head",
  student_mpfb: "MPFB head",
  hands: "Hands only",
  faceHands: "Face + hands",
  rightHand: "Right hand only",
  leftHand: "Left hand only"
};

const MODEL_FLAGS = {
  face: { isHead: true, allowManualMorphs: true, applyDepthScale: true, defaultFlipY: true },
  student_bald3: { isHead: true, allowManualMorphs: false, applyDepthScale: false, defaultFlipY: false },
  student_bald13: { isHead: true, allowManualMorphs: false, applyDepthScale: false, defaultFlipY: false },
  student_bald38: { isHead: true, allowManualMorphs: false, applyDepthScale: false, defaultFlipY: false },
  student_brunette: { isHead: true, allowManualMorphs: false, applyDepthScale: false, defaultFlipY: false },
  student_mpfb: { isHead: true, allowManualMorphs: false, applyDepthScale: false, defaultFlipY: false },
  hands: { isHead: false, allowManualMorphs: false, applyDepthScale: false, defaultFlipY: false },
  faceHands: { isHead: true, allowManualMorphs: false, applyDepthScale: false, defaultFlipY: true },
  rightHand: { isHead: false, allowManualMorphs: false, applyDepthScale: false, defaultFlipY: false },
  leftHand: { isHead: false, allowManualMorphs: false, applyDepthScale: false, defaultFlipY: false }
};

function modelFlag(mode, key, fallback = false) {
  return MODEL_FLAGS[mode] && key in MODEL_FLAGS[mode] ? MODEL_FLAGS[mode][key] : fallback;
}

function currentModelFlag(key, fallback = false) {
  return modelFlag(currentModelMode, key, fallback);
}
let currentModelMode = "face";
let currentWorkflowStage = "shape";
let morphUpdateTimer = null;

const FACE_MORPH_IDS = [
  "morphFaceRoundness",
  "morphJawWidth",
  "morphChinLength",
  "morphCheekbones",
  "morphNoseWidth",
  "morphNoseProjection",
  "morphEyeSpacing",
  "morphEyeSize",
  "morphForeheadHeight",
  "morphAge",
  "morphPresentation"
];

// Face-region data is loaded from face_region_data.js. It contains the
// MediaPipe triangle-to-region table without the huge vertex arrays.
const FACE_REGION_DATA = window.FACE_REGION_DATA || null;
const FACE_GROUPS = FACE_REGION_DATA ? FACE_REGION_DATA.groups : [];
const FACE_TRI_GROUP = FACE_REGION_DATA ? FACE_REGION_DATA.triGroup : [];
const FACE_REF_UVS = FACE_REGION_DATA ? FACE_REGION_DATA.uvs || [] : [];
const FACE_REF_TRIS = FACE_REGION_DATA ? FACE_REGION_DATA.tris || [] : [];
const FACE_TRIANGLE_COUNT = FACE_REGION_DATA ? FACE_REGION_DATA.faceTriangleCount || 852 : 852;
const FACE_REGION_LABELS = {
  lips: "Lips",
  leftEye: "Left eye",
  rightEye: "Right eye",
  leftEyebrow: "Left eyebrow",
  rightEyebrow: "Right eyebrow",
  nose: "Nose",
  forehead: "Forehead",
  leftCheek: "Left cheek",
  rightCheek: "Right cheek",
  chin: "Chin",
  skin: "Skin",
  mouthInterior: "Mouth interior",
  leftEyeInterior: "Left eye interior",
  rightEyeInterior: "Right eye interior"
};
const FACE_REGION_CORE = ["forehead", "nose", "leftCheek", "rightCheek", "chin", "lips", "leftEye", "rightEye"];
const FACE_POINTSETS = FACE_REGION_DATA && FACE_REGION_DATA.pointsets ? FACE_REGION_DATA.pointsets : {};
const FACE_POINTSET_SETS = Object.fromEntries(
  Object.entries(FACE_POINTSETS).map(([name, arr]) => [name, new Set(arr)])
);
const selectedFaceRegions = new Set();

const FACE_REF_BOUNDS = (() => {
  if (!FACE_REF_UVS.length) return null;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const uv of FACE_REF_UVS) {
    minU = Math.min(minU, uv[0]);
    maxU = Math.max(maxU, uv[0]);
    minV = Math.min(minV, uv[1]);
    maxV = Math.max(maxV, uv[1]);
  }
  return { minU, maxU, minV, maxV, spanU: Math.max(1e-9, maxU - minU), spanV: Math.max(1e-9, maxV - minV) };
})();

function normalizeReferenceUv(uv) {
  if (!FACE_REF_BOUNDS) return { x: uv[0], y: uv[1] };
  return {
    x: (uv[0] - FACE_REF_BOUNDS.minU) / FACE_REF_BOUNDS.spanU,
    y: (uv[1] - FACE_REF_BOUNDS.minV) / FACE_REF_BOUNDS.spanV
  };
}

const FACE_REGION_REFERENCE_TRIANGLES = (() => {
  if (!FACE_REGION_DATA || !FACE_REF_UVS.length || !FACE_REF_TRIS.length) return [];
  return FACE_REF_TRIS.map((tri, index) => {
    const u0 = normalizeReferenceUv(FACE_REF_UVS[tri[0]]);
    const u1 = normalizeReferenceUv(FACE_REF_UVS[tri[1]]);
    const u2 = normalizeReferenceUv(FACE_REF_UVS[tri[2]]);
    const region = FACE_GROUPS[FACE_TRI_GROUP[index]] || null;
    const cx = (u0.x + u1.x + u2.x) / 3;
    const cy = (u0.y + u1.y + u2.y) / 3;
    return {
      index,
      region,
      a: u0,
      b: u1,
      c: u2,
      cx,
      cy
    };
  }).filter((t) => !!t.region);
})();

function barycentricUvPoint(px, py, a, b, c) {
  const denom =
    (b.y - c.y) * (a.x - c.x) +
    (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denom) < 1e-12) return null;
  const u = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / denom;
  const v = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / denom;
  const w = 1 - u - v;
  return { u, v, w };
}

function classifyFaceRegionFromUv(mesh, u, v) {
  if (!FACE_REGION_REFERENCE_TRIANGLES.length) return null;
  if (mesh && mesh.uvBounds) {
    const b = mesh.uvBounds;
    u = (u - b.minU) / b.spanU;
    v = (v - b.minV) / b.spanV;
  }
  const eps = 1e-5;
  for (const tri of FACE_REGION_REFERENCE_TRIANGLES) {
    const bc = barycentricUvPoint(u, v, tri.a, tri.b, tri.c);
    if (!bc) continue;
    if (bc.u >= -eps && bc.v >= -eps && bc.w >= -eps) return tri.region;
  }
  // Boundary / seam fallback: nearest reference triangle centroid in UV space.
  let best = null;
  let bestD2 = Infinity;
  for (const tri of FACE_REGION_REFERENCE_TRIANGLES) {
    const dx = u - tri.cx;
    const dy = v - tri.cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = tri.region;
    }
  }
  return best;
}

// ------------------------------------------------------------
// UI
// ------------------------------------------------------------
const ui = {
  shapeStageBtn: document.getElementById("shapeStageBtn"),
  textureStageBtn: document.getElementById("textureStageBtn"),
  continueToTextureBtn: document.getElementById("continueToTextureBtn"),
  continueToTextureBtn2: document.getElementById("continueToTextureBtn2"),
  backToShapeBtn: document.getElementById("backToShapeBtn"),
  workflowStatus: document.getElementById("workflowStatus"),
  deviceLayoutGroup: document.getElementById("deviceLayoutGroup"),
  baseHeadGroup: document.getElementById("baseHeadGroup"),
  visibilityGroup: document.getElementById("visibilityGroup"),
  uvFloatingGroup: document.getElementById("uvFloatingGroup"),
  triGlyphGroup: document.getElementById("triGlyphGroup"),
  designCanvasGroup: document.getElementById("designCanvasGroup"),
  textureChoicesGroup: document.getElementById("textureChoicesGroup"),
  exportGroup: document.getElementById("exportGroup"),
  statsGroup: document.getElementById("statsGroup"),
  modelMode: document.getElementById("modelMode"),
  modelDepthScale: document.getElementById("modelDepthScale"),
  modelDepthScaleValue: document.getElementById("modelDepthScaleValue"),
  uiLayoutMode: document.getElementById("uiLayoutMode"),
  deviceStatus: document.getElementById("deviceStatus"),
  profileReferenceStatus: document.getElementById("profileReferenceStatus"),
  faceMorphGroup: document.getElementById("faceMorphGroup"),
  resetMorphsBtn: document.getElementById("resetMorphsBtn"),
  morphFaceRoundness: document.getElementById("morphFaceRoundness"),
  morphFaceRoundnessValue: document.getElementById("morphFaceRoundnessValue"),
  morphJawWidth: document.getElementById("morphJawWidth"),
  morphJawWidthValue: document.getElementById("morphJawWidthValue"),
  morphChinLength: document.getElementById("morphChinLength"),
  morphChinLengthValue: document.getElementById("morphChinLengthValue"),
  morphCheekbones: document.getElementById("morphCheekbones"),
  morphCheekbonesValue: document.getElementById("morphCheekbonesValue"),
  morphNoseWidth: document.getElementById("morphNoseWidth"),
  morphNoseWidthValue: document.getElementById("morphNoseWidthValue"),
  morphNoseProjection: document.getElementById("morphNoseProjection"),
  morphNoseProjectionValue: document.getElementById("morphNoseProjectionValue"),
  morphEyeSpacing: document.getElementById("morphEyeSpacing"),
  morphEyeSpacingValue: document.getElementById("morphEyeSpacingValue"),
  morphEyeSize: document.getElementById("morphEyeSize"),
  morphEyeSizeValue: document.getElementById("morphEyeSizeValue"),
  morphForeheadHeight: document.getElementById("morphForeheadHeight"),
  morphForeheadHeightValue: document.getElementById("morphForeheadHeightValue"),
  morphAge: document.getElementById("morphAge"),
  morphAgeValue: document.getElementById("morphAgeValue"),
  morphPresentation: document.getElementById("morphPresentation"),
  morphPresentationValue: document.getElementById("morphPresentationValue"),
  faceRegionSvg: document.getElementById("faceRegionSvg"),
  faceRegionChips: document.getElementById("faceRegionChips"),
  limitToSelectedFaceRegions: document.getElementById("limitToSelectedFaceRegions"),
  selectAllFaceRegionsBtn: document.getElementById("selectAllFaceRegionsBtn"),
  clearFaceRegionsBtn: document.getElementById("clearFaceRegionsBtn"),
  selectCoreFaceRegionsBtn: document.getElementById("selectCoreFaceRegionsBtn"),
  applySelectedTextureToRegionsBtn: document.getElementById("applySelectedTextureToRegionsBtn"),
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

  limitNonplanarOffset: document.getElementById("limitNonplanarOffset"),
  maxNonplanarOffset: document.getElementById("maxNonplanarOffset"),
  maxNonplanarOffsetValue: document.getElementById("maxNonplanarOffsetValue"),

  protectFeatureRegions: document.getElementById("protectFeatureRegions"),
  featureProtectRadius: document.getElementById("featureProtectRadius"),
  featureProtectRadiusValue: document.getElementById("featureProtectRadiusValue"),
  featureProtectFalloff: document.getElementById("featureProtectFalloff"),
  featureProtectFalloffValue: document.getElementById("featureProtectFalloffValue"),

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
  applyFullFaceTextureBtn: document.getElementById("applyFullFaceTextureBtn"),
  stampSize: document.getElementById("stampSize"),
  stampSizeValue: document.getElementById("stampSizeValue"),
  stampOpacity: document.getElementById("stampOpacity"),
  stampOpacityValue: document.getElementById("stampOpacityValue"),
  textureBrushShape: document.getElementById("textureBrushShape"),
  useTextureStamp: document.getElementById("useTextureStamp"),
  rebuildBtn: document.getElementById("rebuildBtn"),

  stats: document.getElementById("stats")
};


function getMorphValues() {
  const out = {};
  for (const id of FACE_MORPH_IDS) {
    const el = ui[id];
    out[id] = el ? Number(el.value || 0) : 0;
  }
  return out;
}

function syncMorphUIText() {
  for (const id of FACE_MORPH_IDS) {
    const el = ui[id];
    const valueEl = ui[id + "Value"];
    if (el && valueEl) valueEl.textContent = Number(el.value || 0).toFixed(2);
  }
}

function resetFaceMorphs() {
  for (const id of FACE_MORPH_IDS) {
    if (ui[id]) ui[id].value = "0";
  }
  syncUIText();
  switchModel(currentModelMode).catch((err) => {
    console.error(err);
    if (ui.stats) ui.stats.textContent = "Could not reset face shape: " + err.message;
  });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothWeight01(x, edge0, edge1) {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussianWeight(value, center, width) {
  const w = Math.max(1e-6, width);
  const d = (value - center) / w;
  return Math.exp(-0.5 * d * d);
}

function computeUvBoundsForRange(uvs, count) {
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  const limit = Math.min(count, uvs.length);
  for (let i = 0; i < limit; i++) {
    const uv = uvs[i];
    if (!uv) continue;
    minU = Math.min(minU, uv.x);
    minV = Math.min(minV, uv.y);
    maxU = Math.max(maxU, uv.x);
    maxV = Math.max(maxV, uv.y);
  }
  if (!Number.isFinite(minU)) return { minU: 0, minV: 0, maxU: 1, maxV: 1, spanU: 1, spanV: 1 };
  return { minU, minV, maxU, maxV, spanU: Math.max(1e-6, maxU - minU), spanV: Math.max(1e-6, maxV - minV) };
}

function normalizePositionBounds(positions, count) {
  const limit = Math.min(count, positions.length);
  const box = new THREE.Box3().setFromPoints(positions.slice(0, limit));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    center,
    halfX: Math.max(1e-6, size.x * 0.5),
    halfY: Math.max(1e-6, size.y * 0.5),
    halfZ: Math.max(1e-6, size.z * 0.5)
  };
}

function pointSetContains(name, index) {
  const set = FACE_POINTSET_SETS[name];
  return !!set && set.has(index);
}

function pointSetContainsAny(names, index) {
  return names.some((name) => pointSetContains(name, index));
}

function signedSide(xn) {
  return xn < 0 ? -1 : 1;
}

function applyManualFaceMorphs(positions, uvs) {
  // Safe classroom shape controls for the stable procedural head.
  // This deliberately avoids the earlier MediaPipe-landmark pointset morphs,
  // which were too sparse and could collapse the face into spikes. These
  // controls use smooth coordinate-space falloffs over the whole head.
  if (!currentModelFlag("allowManualMorphs", false)) return;
  if (!positions || !positions.length) return;

  const m = getMorphValues();
  const roundness = clamp(m.morphFaceRoundness || 0, -1, 1);
  const jawWidth = clamp(m.morphJawWidth || 0, -1, 1);
  const chinLength = clamp(m.morphChinLength || 0, -1, 1);
  const cheekbones = clamp(m.morphCheekbones || 0, -1, 1);
  const noseWidth = clamp(m.morphNoseWidth || 0, -1, 1);
  const noseProjection = clamp(m.morphNoseProjection || 0, -1, 1);
  const eyeSpacing = clamp(m.morphEyeSpacing || 0, -1, 1);
  const eyeSize = clamp(m.morphEyeSize || 0, -1, 1);
  const foreheadHeight = clamp(m.morphForeheadHeight || 0, -1, 1);
  const age = clamp(m.morphAge || 0, -1, 1);
  const presentation = clamp(m.morphPresentation || 0, -1, 1);

  const bounds = normalizePositionBounds(positions, positions.length);

  for (const p of positions) {
    const xn = (p.x - bounds.center.x) / bounds.halfX;
    const yn = (p.y - bounds.center.y) / bounds.halfY;
    const zn = (p.z - bounds.center.z) / bounds.halfZ;
    const ax = Math.abs(xn);
    const side = xn < 0 ? -1 : 1;

    // Masks are intentionally broad and bounded. They should read as design
    // controls, not as anatomically exact reconstruction.
    const front = smoothWeight01(zn, -0.30, 0.90);
    const lower = smoothWeight01(-yn, 0.12, 0.90);
    const upper = smoothWeight01(yn, 0.18, 0.90);
    const sideBand = smoothWeight01(ax, 0.18, 0.92);
    const centerBand = gaussianWeight(xn, 0, 0.32);
    const jawMask = gaussianWeight(yn, -0.48, 0.26) * sideBand;
    const chinMask = gaussianWeight(yn, -0.82, 0.18) * gaussianWeight(xn, 0, 0.55);
    const cheekMask = gaussianWeight(yn, 0.02, 0.22) * smoothWeight01(ax, 0.20, 0.72) * front;
    const foreheadMask = upper * gaussianWeight(xn, 0, 0.86);
    const noseMask = centerBand * gaussianWeight(yn, -0.03, 0.30) * front;
    const leftEyeMask = gaussianWeight(xn, -0.32, 0.18) * gaussianWeight(yn, 0.28, 0.13) * front;
    const rightEyeMask = gaussianWeight(xn, 0.32, 0.18) * gaussianWeight(yn, 0.28, 0.13) * front;
    const eyeMask = leftEyeMask + rightEyeMask;

    // Keep gains intentionally small. These are safe mesh-design sliders.
    p.x *= (1 + 0.10 * roundness);
    p.y *= (1 - 0.035 * roundness);
    p.x += side * jawMask * (8.0 * jawWidth + 2.5 * presentation);
    p.y += chinMask * (-9.0 * chinLength - 2.0 * presentation);
    p.z += chinMask * (2.5 * chinLength);

    p.x += side * cheekMask * (5.5 * cheekbones + 1.5 * presentation);
    p.z += cheekMask * (4.5 * cheekbones - 1.5 * age);
    p.y += cheekMask * (2.0 * cheekbones - 1.5 * age);

    // Nose width spreads only the already-front central nose region. Projection
    // is small enough that it cannot turn the head into a spike.
    p.x += side * noseMask * (4.8 * noseWidth * Math.max(0.15, ax + 0.08));
    p.z += noseMask * (8.0 * noseProjection + 1.0 * presentation);

    // Eye controls modify the socket impression, not open holes.
    p.x += leftEyeMask * (-4.5 * eyeSpacing) + rightEyeMask * (4.5 * eyeSpacing);
    p.z += eyeMask * (-4.0 * eyeSize);
    p.y += (leftEyeMask + rightEyeMask) * (1.5 * eyeSize);

    p.y += foreheadMask * (8.0 * foreheadHeight - 1.0 * age);
    p.z += foreheadMask * (1.5 * foreheadHeight + 0.8 * presentation);

    // Very subtle design-language sliders. They are deliberately not identity
    // labels and should not dominate the mesh.
    p.x += side * lower * ax * (-2.5 * age);
    p.z += front * lower * (-1.5 * age);
  }
}

function updateMorphPanelVisibility() {
  if (!ui.faceMorphGroup) return;
  const show = currentModelFlag("allowManualMorphs", false);
  ui.faceMorphGroup.style.display = show ? "block" : "none";
}

function syncUIText() {
  if (ui.modelDepthScaleValue && ui.modelDepthScale) {
    ui.modelDepthScaleValue.textContent = Number(ui.modelDepthScale.value || 1.00).toFixed(2);
  }
  syncMorphUIText();
  ui.sampleStepValue.textContent = ui.sampleStep.value;
  ui.pointBaseOffsetValue.textContent = ui.pointBaseOffset.value;
  ui.pointMinDispValue.textContent = ui.pointMinDisp.value;
  ui.pointMaxDispValue.textContent = ui.pointMaxDisp.value;

  if (ui.maxNonplanarOffsetValue && ui.maxNonplanarOffset) {
    ui.maxNonplanarOffsetValue.textContent = ui.maxNonplanarOffset.value;
  }

  if (ui.featureProtectRadiusValue && ui.featureProtectRadius) {
    ui.featureProtectRadiusValue.textContent = ui.featureProtectRadius.value;
  }

  if (ui.featureProtectFalloffValue && ui.featureProtectFalloff) {
    ui.featureProtectFalloffValue.textContent = ui.featureProtectFalloff.value;
  }

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
  ui.modelDepthScale,
  ...FACE_MORPH_IDS.map((id) => ui[id]),
  ui.sampleStep,
  ui.pointBaseOffset,
  ui.pointMinDisp,
  ui.pointMaxDisp,
  ui.maxNonplanarOffset,
  ui.featureProtectRadius,
  ui.featureProtectFalloff,
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

function forceNeutralShapeStageValues() {
  // Chrome/p5 Web Editor can preserve range-input values across reloads even
  // when the HTML says value="0". For the student shape stage, always start
  // from an actual neutral head unless a future saved-project loader says
  // otherwise.
  for (const id of FACE_MORPH_IDS) {
    if (ui[id]) ui[id].value = "0";
  }
  if (ui.modelDepthScale) ui.modelDepthScale.value = ui.modelDepthScale.value || "0.22";
  syncUIText();
}

forceNeutralShapeStageValues();

// ------------------------------------------------------------
// Device-aware layout
// ------------------------------------------------------------
let currentDeviceProfile = "desktop";
let deviceDefaultsApplied = false;

function detectDeviceProfile() {
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth <= 760;
  const mid = window.innerWidth <= 1050;
  const highDpi = (window.devicePixelRatio || 1) > 1.5;

  if (narrow || (coarse && window.innerWidth < 900)) return "phone";
  if (mid || coarse || highDpi && window.innerWidth < 1180) return "tablet";
  return "desktop";
}

function layoutModeChoice() {
  return ui.uiLayoutMode ? ui.uiLayoutMode.value : "auto";
}

function applyDeviceLayout(options = {}) {
  const requested = layoutModeChoice();
  const profile = requested === "auto" ? detectDeviceProfile() : requested;
  currentDeviceProfile = profile;

  document.body.classList.remove("device-phone", "device-tablet", "device-desktop");
  document.body.classList.add("device-" + profile);
  document.body.dataset.deviceProfile = profile;

  const pixelCap = profile === "phone" ? 1.35 : (profile === "tablet" ? 1.6 : 2);
  if (typeof renderer !== "undefined" && renderer && renderer.setPixelRatio) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap));
  }

  // On phones/tablets, avoid making the first automatic build painfully dense.
  // Do not overwrite a user-edited value after the first layout pass.
  if (!deviceDefaultsApplied || options.forceDefaults) {
    if (profile === "phone") {
      if (ui.maxFloatingPoints) ui.maxFloatingPoints.value = Math.min(Number(ui.maxFloatingPoints.value || 90000), 90000);
      if (ui.sampleStep) ui.sampleStep.value = Math.max(Number(ui.sampleStep.value || 2), 2);
      if (ui.pointSize) ui.pointSize.value = Number(ui.pointSize.value || 1.5);
    } else if (profile === "tablet") {
      if (ui.maxFloatingPoints) ui.maxFloatingPoints.value = Math.min(Number(ui.maxFloatingPoints.value || 180000), 180000);
      if (ui.sampleStep) ui.sampleStep.value = Math.max(Number(ui.sampleStep.value || 1), 1);
    }
    deviceDefaultsApplied = true;
    syncUIText();
  }

  if (ui.deviceStatus) {
    const coarseText = window.matchMedia && window.matchMedia("(pointer: coarse)").matches ? "touch" : "mouse/trackpad";
    ui.deviceStatus.textContent = `${requested === "auto" ? "Auto" : "Manual"}: ${profile} layout · ${window.innerWidth}×${window.innerHeight} · ${coarseText}`;
  }

  if (typeof onResize === "function") onResize();
}

if (ui.uiLayoutMode) {
  ui.uiLayoutMode.addEventListener("change", () => {
    applyDeviceLayout({ forceDefaults: false });
    if (meshData) rebuildFloatingGeometry();
  });
}

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
// SVG face section selection
// ------------------------------------------------------------
const REGION_COLORS = {
  skin: "#b6b6b6",
  forehead: "#5bbcff",
  nose: "#ffd166",
  leftCheek: "#7ee081",
  rightCheek: "#7ee081",
  chin: "#b8a0ff",
  lips: "#ff7f9a",
  leftEye: "#ffffff",
  rightEye: "#ffffff",
  leftEyebrow: "#6b4c35",
  rightEyebrow: "#6b4c35",
  mouthInterior: "#7a1f2e",
  leftEyeInterior: "#e8f7ff",
  rightEyeInterior: "#e8f7ff"
};

function faceRegionLabel(id) {
  return FACE_REGION_LABELS[id] || id;
}

function modelHasFaceRegions() {
  return !!FACE_REGION_DATA && currentModelFlag("isHead", false);
}

function triangleRegionName(mesh, triIndex) {
  if (!FACE_REGION_DATA) return null;
  if (!currentModelFlag("isHead", false)) return null;
  if (mesh.triangleRegionNames && mesh.triangleRegionNames[triIndex]) return mesh.triangleRegionNames[triIndex];
  if (currentModelMode === "faceHands" && triIndex >= FACE_TRIANGLE_COUNT) return "hand";
  const tri = mesh.triangles[triIndex];
  if (!tri) return null;
  const uv0 = mesh.uvs[tri[0]];
  const uv1 = mesh.uvs[tri[1]];
  const uv2 = mesh.uvs[tri[2]];
  const u = (uv0.x + uv1.x + uv2.x) / 3;
  const v = (uv0.y + uv1.y + uv2.y) / 3;
  return classifyFaceRegionFromUv(mesh, u, v);
}

function faceRegionLimitActive() {
  return !!(
    ui.limitToSelectedFaceRegions &&
    ui.limitToSelectedFaceRegions.checked &&
    selectedFaceRegions.size > 0 &&
    modelHasFaceRegions()
  );
}

function shouldUseTriangleForSelectedRegions(tri) {
  if (!faceRegionLimitActive()) return true;
  if (!tri || !tri.regionName) return currentModelMode === "faceHands"; // keep hands visible in combined mode
  if (tri.regionName === "hand") return true;
  return selectedFaceRegions.has(tri.regionName);
}

function updateFaceRegionChips() {
  if (!ui.faceRegionChips) return;
  ui.faceRegionChips.innerHTML = "";
  if (!modelHasFaceRegions()) {
    ui.faceRegionChips.innerHTML = '<span class="small">Face section selection is available in Face only or Face + hands mode.</span>';
    return;
  }
  if (selectedFaceRegions.size === 0) {
    if (faceRegionAssignments.size === 0) {
      ui.faceRegionChips.innerHTML = '<span class="small">No active target. Click SVG sections, then choose a source and apply it.</span>';
      return;
    }
    const label = document.createElement("span");
    label.className = "small";
    label.textContent = "Assigned regions: ";
    ui.faceRegionChips.appendChild(label);
    [...faceRegionAssignments.entries()].sort().forEach(([id, textureIndex]) => {
      const chip = document.createElement("span");
      chip.className = "regionChip assignedChip";
      const tex = textureChoices[textureIndex];
      chip.textContent = `${faceRegionLabel(id)} ← ${tex ? tex.label : "source"}`;
      ui.faceRegionChips.appendChild(chip);
    });
    return;
  }
  [...selectedFaceRegions].sort().forEach((id) => {
    const chip = document.createElement("span");
    chip.className = "regionChip";
    const tex = faceRegionAssignments.has(id) ? textureChoices[faceRegionAssignments.get(id)] : null;
    chip.textContent = tex ? `${faceRegionLabel(id)} ← ${tex.label}` : faceRegionLabel(id);
    ui.faceRegionChips.appendChild(chip);
  });
}

function updateFaceRegionSelectionUI() {
  if (ui.faceRegionSvg) {
    ui.faceRegionSvg.querySelectorAll(".region-poly").forEach((el) => {
      const region = el.dataset.region;
      el.classList.toggle("selected", selectedFaceRegions.has(region));
      el.classList.toggle("assigned", faceRegionAssignments.has(region));
    });
  }
  updateFaceRegionChips();
}

function toggleFaceRegion(id) {
  if (!id) return;
  if (selectedFaceRegions.has(id)) selectedFaceRegions.delete(id);
  else selectedFaceRegions.add(id);
  updateFaceRegionSelectionUI();
  if (faceRegionLimitActive() && meshData) rebuildFloatingGeometry();
}

function selectAllFaceRegions() {
  selectedFaceRegions.clear();
  for (const id of FACE_GROUPS) selectedFaceRegions.add(id);
  updateFaceRegionSelectionUI();
  if (faceRegionLimitActive() && meshData) rebuildFloatingGeometry();
}

function clearFaceRegions() {
  selectedFaceRegions.clear();
  updateFaceRegionSelectionUI();
  if (meshData) rebuildFloatingGeometry();
}

function selectCoreFaceRegions() {
  selectedFaceRegions.clear();
  FACE_REGION_CORE.forEach((id) => selectedFaceRegions.add(id));
  updateFaceRegionSelectionUI();
  if (faceRegionLimitActive() && meshData) rebuildFloatingGeometry();
}

function buildSelectedRegionMaskInfo(regions) {
  const mask = document.createElement("canvas");
  mask.width = DESIGN_W;
  mask.height = DESIGN_H;
  const ctx = mask.getContext("2d");
  ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);

  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };
  let triangleCount = 0;

  function includePoint(p) {
    bounds.minX = Math.min(bounds.minX, p.x);
    bounds.minY = Math.min(bounds.minY, p.y);
    bounds.maxX = Math.max(bounds.maxX, p.x);
    bounds.maxY = Math.max(bounds.maxY, p.y);
  }

  if (!meshData || !FACE_REGION_DATA || !regions || regions.size === 0) {
    return { mask, bounds: null, triangleCount };
  }

  ctx.fillStyle = "white";
  const tris = meshData.triangleData && meshData.triangleData.length ? meshData.triangleData : [];
  for (const tdata of tris) {
    const region = tdata.regionName;
    if (!region || region === "hand" || !regions.has(region)) continue;
    const p0 = uvToDesignPixel(tdata.uv[0].x, tdata.uv[0].y);
    const p1 = uvToDesignPixel(tdata.uv[1].x, tdata.uv[1].y);
    const p2 = uvToDesignPixel(tdata.uv[2].x, tdata.uv[2].y);
    includePoint(p0);
    includePoint(p1);
    includePoint(p2);
    triangleCount++;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fill();
  }

  if (triangleCount === 0 || !Number.isFinite(bounds.minX)) {
    return { mask, bounds: null, triangleCount };
  }

  const pad = Math.max(6, Math.min(28, Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.04));
  const x = Math.max(0, bounds.minX - pad);
  const y = Math.max(0, bounds.minY - pad);
  const maxX = Math.min(DESIGN_W - 1, bounds.maxX + pad);
  const maxY = Math.min(DESIGN_H - 1, bounds.maxY + pad);

  return {
    mask,
    bounds: {
      x,
      y,
      w: Math.max(1, maxX - x),
      h: Math.max(1, maxY - y)
    },
    triangleCount
  };
}

function buildSelectedRegionMask(regions) {
  return buildSelectedRegionMaskInfo(regions).mask;
}

function drawTextureChoiceIntoMask(textureIndex, regions) {
  const entry = textureChoices[textureIndex];
  if (!entry || !regions || regions.size === 0) return false;

  // Region sources should behave like a fitted image on each selected face
  // section, not like one global wallpaper clipped by several unrelated UV
  // islands.  Drawing independently per region keeps paired regions such as
  // leftCheek/rightCheek visually balanced: each side receives the same source
  // image scaled to its own mask bounds.
  let drewAny = false;
  const regionList = [...regions].filter((region) => region && region !== "hand");

  for (const region of regionList) {
    const info = buildSelectedRegionMaskInfo(new Set([region]));
    if (!info.bounds) continue;

    const tmp = document.createElement("canvas");
    tmp.width = DESIGN_W;
    tmp.height = DESIGN_H;
    const tctx = tmp.getContext("2d");

    drawImageCover(tctx, entry.source, info.bounds.x, info.bounds.y, info.bounds.w, info.bounds.h);

    tctx.globalCompositeOperation = "destination-in";
    tctx.drawImage(info.mask, 0, 0);
    tctx.globalCompositeOperation = "source-over";

    dctx.drawImage(tmp, 0, 0);
    drewAny = true;
  }

  return drewAny;
}

function fillNeutralDesignCanvas() {
  dctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
  // Neutral gray keeps unassigned areas near the midpoint between min and max displacement.
  dctx.fillStyle = "rgb(128, 128, 128)";
  dctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
}

function redrawDesignFromLayerState(options = {}) {
  fillNeutralDesignCanvas();

  if (fullFaceTextureIndex >= 0 && textureChoices[fullFaceTextureIndex]) {
    drawImageCover(dctx, textureChoices[fullFaceTextureIndex].source, 0, 0, DESIGN_W, DESIGN_H);
  }

  // Paint region overrides after the full-face background. Each region remembers
  // its own selected source, so applying Water to the nose and Scales to cheeks
  // does not erase the earlier assignment.
  for (const [region, textureIndex] of faceRegionAssignments.entries()) {
    drawTextureChoiceIntoMask(textureIndex, new Set([region]));
  }

  updateBlurredDesign();

  if (options.rebuild !== false && typeof rebuildFloatingGeometry === "function" && meshData) {
    rebuildFloatingGeometry();
  }
}

function applyActiveTextureToSelectedRegions() {
  if (activeTextureIndex < 0 || !textureChoices[activeTextureIndex]) return false;
  if (!modelHasFaceRegions()) {
    if (ui.stats) ui.stats.textContent = "Switch to Face only or Face + hands before applying SVG face sections.";
    return false;
  }
  if (selectedFaceRegions.size === 0) {
    if (ui.stats) ui.stats.textContent = "Choose one or more SVG face sections first, then click ‘Apply source to selected’. Use the full-face button for a whole-face background.";
    return false;
  }

  // Region painting is UV-space, so switch to fitted UV mapping to keep the SVG
  // sections aligned with the rendered face.
  if (ui.useCylindricalProjectionTexture) ui.useCylindricalProjectionTexture.checked = false;
  if (ui.useFrontProjectionTexture) ui.useFrontProjectionTexture.checked = false;
  if (ui.fitTextureToFaceUvBounds) ui.fitTextureToFaceUvBounds.checked = true;

  const entry = textureChoices[activeTextureIndex];
  const regions = [...selectedFaceRegions];

  for (const region of regions) {
    faceRegionAssignments.set(region, activeTextureIndex);
  }

  stampHistory.push({
    time: new Date().toISOString(),
    action: "regionSourceAssignment",
    textureIndex: activeTextureIndex,
    textureLabel: entry.label,
    regions
  });

  // Clear the active target after applying so the student can immediately click
  // a different face section and assign a different pattern without repainting
  // the previous section.
  selectedFaceRegions.clear();
  updateFaceRegionSelectionUI();
  redrawDesignFromLayerState({ rebuild: true });
  updateFaceRegionSelectionUI();
  return true;
}

function buildFaceRegionSvg() {
  if (!ui.faceRegionSvg) return;
  const svg = ui.faceRegionSvg;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", "0 0 2048 2048");

  if (!modelHasFaceRegions() || !meshData) {
    svg.setAttribute("viewBox", `0 0 ${DESIGN_W} ${DESIGN_H}`);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "40");
    text.setAttribute("y", "80");
    text.setAttribute("fill", "#333");
    text.setAttribute("font-size", "34");
    text.textContent = "Face SVG section map appears in Face modes.";
    svg.appendChild(text);
    updateFaceRegionSelectionUI();
    return;
  }

  // Use the fuller p5/Future Face SVG map as the visible selector. It has the
  // labeled MediaPipe regions students already tested: skin, forehead, cheeks,
  // chin, nose, lips, eyes, eyebrows, eye interiors, and mouth interior.
  if (typeof FACE_REGION_SVG_INNER_HTML === "string") {
    svg.innerHTML = FACE_REGION_SVG_INNER_HTML;
  } else {
    // Fallback to the older generated map if the static SVG file is missing.
    buildGeneratedFaceRegionSvgFallback(svg);
    return;
  }

  const hitOrder = [
    "skin", "forehead", "leftCheek", "rightCheek", "chin", "nose", "lips",
    "leftEyebrow", "rightEyebrow", "leftEye", "rightEye",
    "mouthInterior", "leftEyeInterior", "rightEyeInterior"
  ];

  const oldHit = svg.querySelector("#hitRegions");
  if (oldHit) oldHit.remove();
  const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
  root.setAttribute("id", "hitRegions");
  svg.appendChild(root);

  for (const region of hitOrder) {
    const grp = svg.querySelector(`#${region}`);
    if (!grp) continue;
    let d = "";
    grp.querySelectorAll(".mesh polygon").forEach((p) => {
      const pts = (p.getAttribute("points") || "").trim();
      if (pts) d += "M" + pts.replace(/\s+/g, " L") + "Z ";
    });
    if (!d) continue;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "region-poly region-hit");
    path.setAttribute("fill", "rgba(255,255,255,0.01)");
    path.setAttribute("fill-rule", "nonzero");
    path.dataset.region = region;
    path.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFaceRegion(region);
    });
    root.appendChild(path);
  }

  updateFaceRegionSelectionUI();
}

function buildGeneratedFaceRegionSvgFallback(svg) {
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${DESIGN_W} ${DESIGN_H}`);
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", DESIGN_W);
  bg.setAttribute("height", DESIGN_H);
  bg.setAttribute("fill", "#d8d8d8");
  svg.appendChild(bg);

  const ordered = ["skin", "forehead", "leftCheek", "rightCheek", "chin", "nose", "lips", "leftEyebrow", "rightEyebrow", "leftEye", "rightEye", "mouthInterior", "leftEyeInterior", "rightEyeInterior"];
  const groups = new Map();
  ordered.forEach((region) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.dataset.region = region;
    groups.set(region, g);
    svg.appendChild(g);
  });

  const tris = meshData.triangleData && meshData.triangleData.length ? meshData.triangleData : [];
  for (const tdata of tris) {
    const region = tdata.regionName;
    if (!region || region === "hand") continue;
    const parent = groups.get(region);
    if (!parent) continue;
    const pts = tdata.uv.map((uv) => {
      const p = uvToDesignPixel(uv.x, uv.y);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", pts);
    poly.setAttribute("fill", REGION_COLORS[region] || "#aaa");
    poly.setAttribute("fill-opacity", region === "skin" ? "0.22" : "0.58");
    poly.setAttribute("class", "region-poly");
    poly.dataset.region = region;
    poly.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFaceRegion(region);
    });
    parent.appendChild(poly);
  }
  updateFaceRegionSelectionUI();
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

// Layered region painting state. The visible design canvas is redrawn from
// this state so a pattern assigned to one SVG face section remains in place
// when the student selects a new pattern and a different face section.
let fullFaceTextureIndex = -1;
const faceRegionAssignments = new Map();

function makeTextureCanvas(label, drawFn, options = {}) {
  const c = document.createElement("canvas");
  // Built-in sources are full design-resolution images, not small stamp tiles.
  // Thumbnails are created by CSS scaling the preview image down.
  c.width = options.width || DESIGN_W;
  c.height = options.height || DESIGN_H;
  const ctx = c.getContext("2d");
  drawFn(ctx, c.width, c.height);
  return addTextureChoice(c, label, options);
}

function drawImageCover(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.videoWidth || img.width;
  const ih = img.naturalHeight || img.videoHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function makeFullCanvasImageSource(img, fillMode = "cover") {
  // Uploaded images are normalized into one 1000 x 1000 canvas immediately.
  // That prevents small uploads from ever behaving like a tiled canvas pattern
  // later in the SVG-region painter or full-face painter.
  const c = document.createElement("canvas");
  c.width = DESIGN_W;
  c.height = DESIGN_H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);

  if (fillMode === "contain") {
    const iw = img.naturalWidth || img.videoWidth || img.width;
    const ih = img.naturalHeight || img.videoHeight || img.height;
    if (iw && ih) {
      const scale = Math.min(c.width / iw, c.height / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
      ctx.restore();
    }
  } else {
    drawImageCover(ctx, img, 0, 0, c.width, c.height);
  }

  return c;
}

function drawGeometricCirclesPattern(ctx, w, h) {
  const sx = w / DESIGN_W;
  const sy = h / DESIGN_H;
  const s = Math.min(sx, sy);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.scale(sx, sy);
  ctx.strokeStyle = "black";
  ctx.fillStyle = "black";
  // Because the geometry is authored in 1000x1000 design coordinates and scaled
  // into the actual canvas, line width should scale with the drawing. Using
  // 10/s made the thumbnail look right but made the full-face result too thick.
  ctx.lineWidth = 10;

  const large = [
    [210, 180, 95], [500, 160, 120], [805, 195, 85],
    [180, 480, 130], [500, 500, 180], [830, 470, 120],
    [240, 800, 100], [520, 820, 140], [795, 780, 110]
  ];

  for (const [x, y, r] of large) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const filled = [
    [150, 150, 24], [320, 270, 36], [640, 220, 28], [865, 140, 18],
    [260, 520, 48], [520, 500, 60], [770, 540, 40],
    [170, 760, 30], [415, 735, 22], [610, 885, 34], [840, 785, 26]
  ];

  for (const [x, y, r] of filled) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const targets = [
    [360, 160, [18, 40, 68]],
    [685, 430, [24, 56, 92]],
    [345, 675, [20, 46, 78]],
    [690, 790, [16, 38, 64]]
  ];

  for (const [x, y, rings] of targets) {
    for (const r of rings) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 5; gx++) {
      const x = 120 + gx * 190 + (gy % 2) * 30;
      const y = 335 + gy * 155;
      const r = 8 + ((gx + gy * 2) % 5) * 7;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if ((gx + gy) % 2 === 0) ctx.fill();
      else ctx.stroke();
    }
  }

  ctx.restore();
}

function addBuiltInTextures() {
  makeTextureCanvas("Circles", drawGeometricCirclesPattern, { fillMode: "cover" });

  makeTextureCanvas("Water", (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#10314e");
    g.addColorStop(1, "#7ff1ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    const maxR = Math.hypot(w, h) * 0.55;
    const step = Math.max(w, h) / 18;
    for (let r = step * 0.7; r < maxR; r += step) {
      ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.008);
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, { fillMode: "cover" });

  makeTextureCanvas("Circuit", (ctx, w, h) => {
    ctx.fillStyle = "#21143f";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#caa8ff";
    ctx.lineWidth = Math.max(6, Math.min(w, h) * 0.012);
    ctx.lineCap = "round";
    const cols = 4;
    const rows = 7;
    const cellW = w / cols;
    const cellH = h / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x0 = col * cellW + cellW * 0.12;
        const y0 = row * cellH + cellH * 0.32;
        const x1 = col * cellW + cellW * 0.48;
        const y1 = row * cellH + cellH * 0.32;
        const x2 = col * cellW + cellW * 0.48;
        const y2 = row * cellH + cellH * 0.68;
        const x3 = col * cellW + cellW * 0.86;
        const y3 = row * cellH + cellH * 0.68;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#fff7ff";
    const dotR = Math.max(5, Math.min(w, h) * 0.012);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const pts = [
          [col * cellW + cellW * 0.12, row * cellH + cellH * 0.32],
          [col * cellW + cellW * 0.48, row * cellH + cellH * 0.32],
          [col * cellW + cellW * 0.86, row * cellH + cellH * 0.68]
        ];
        for (const [x, y] of pts) {
          ctx.beginPath();
          ctx.arc(x, y, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, { fillMode: "cover" });

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
  }, { fillMode: "cover" });

  makeTextureCanvas("Stars", (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    g.addColorStop(0, "#203b7a");
    g.addColorStop(1, "#060b18");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const count = Math.round((w * h) / 12500);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.max(1, Math.min(w, h) * (0.001 + Math.random() * 0.003));
      ctx.fillStyle = Math.random() > 0.75 ? "#ffe6a1" : "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { fillMode: "cover" });

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
  }, { fillMode: "cover" });
}

function addTextureChoice(source, label, options = {}) {
  if (!ui.textureLibrary) return -1;

  const entry = {
    source,
    label,
    // Full-face sources should fill the whole 1000 x 1000 design canvas by default.
    // Earlier canvas-generated patterns defaulted to repeat/tile, which made the
    // water/scales/stars/topo sources behave like wallpaper instead of one mapped
    // image. Use "tile" only when a source explicitly asks for it.
    fillMode: options.fillMode || "cover"
  };
  textureChoices.push(entry);

  const idx = textureChoices.length - 1;

  const thumb = document.createElement("div");
  thumb.className = "textureThumb";
  thumb.dataset.index = idx;
  thumb.title = "Use this as the full-face design source";

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
    if (ui.stats) {
      ui.stats.textContent = `Selected source: ${label}. Click SVG face sections and “Apply source to selected”, or click “Apply selected source to full face”.`;
    }
  });

  thumb.addEventListener("dblclick", () => {
    activeTextureIndex = idx;
    updateTextureSelectionUI();
    applyActiveTextureToFullFace();
  });

  ui.textureLibrary.appendChild(thumb);

  if (activeTextureIndex < 0) {
    activeTextureIndex = idx;
    updateTextureSelectionUI();
  }

  if (options.autoApply) {
    activeTextureIndex = idx;
    updateTextureSelectionUI();
    applyActiveTextureToFullFace();
  }

  return idx;
}

function applyTextureChoiceToFullFace(idx, options = {}) {
  const entry = textureChoices[idx];
  if (!entry) return false;

  fullFaceTextureIndex = idx;
  stampHistory.push({
    time: new Date().toISOString(),
    action: "fullFaceSource",
    textureIndex: idx,
    textureLabel: entry.label,
    fillMode: entry.fillMode
  });

  redrawDesignFromLayerState(options);
  updateFaceRegionSelectionUI();
  return true;
}

function applyActiveTextureToFullFace(options = {}) {
  return applyTextureChoiceToFullFace(activeTextureIndex, options);
}

function makeUploadedCompositeCanvas(items) {
  const c = document.createElement("canvas");
  c.width = DESIGN_W;
  c.height = DESIGN_H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);

  const alpha = Math.max(0.18, 1 / Math.max(1, items.length));
  for (const item of items) {
    ctx.save();
    ctx.globalAlpha = alpha;
    // Each uploaded item was already converted to a full-canvas source, so
    // compositing cannot tile even if the original upload was small.
    drawImageCover(ctx, item.source || item.canvas || item.img, 0, 0, c.width, c.height);
    ctx.restore();
  }

  return c;
}

function addCapturedFaceTextureIfAvailable() {
  let dataURL = null;
  try { dataURL = localStorage.getItem("floatingSkinCapturedFaceTexturePNG"); } catch (e) {}
  if (!dataURL) return;

  const img = new Image();
  img.onload = () => {
    const savedAt = (() => {
      try { return localStorage.getItem("floatingSkinCapturedFaceSavedAt") || ""; } catch (e) { return ""; }
    })();
    const label = savedAt ? "Captured face photo" : "Captured face photo";
    const fullCanvasSource = makeFullCanvasImageSource(img, "cover");
    const idx = addTextureChoice(fullCanvasSource, label, { fillMode: "cover" });
    if (ui.stats) {
      ui.stats.textContent = "Captured face photo is available as a texture source. Select it, then apply it to the full face or selected SVG regions.";
    }
  };
  img.onerror = () => {
    if (ui.stats) ui.stats.textContent = "Captured face texture was saved but could not be loaded. Recapture the face.";
  };
  img.src = dataURL;
}

function profileReferenceSummary() {
  const views = ["front", "left", "right"];
  return views.map((name) => {
    let has = false;
    let savedAt = "";
    try {
      has = !!localStorage.getItem(`floatingSkinProfile_${name}_PNG`);
      savedAt = localStorage.getItem(`floatingSkinProfile_${name}_savedAt`) || "";
    } catch (e) {}
    return { name, has, savedAt };
  });
}

function updateProfileReferenceStatus() {
  if (!ui.profileReferenceStatus) return;
  const parts = profileReferenceSummary().map((r) => `${r.name}: ${r.has ? "saved" : "missing"}`);
  ui.profileReferenceStatus.textContent = parts.join(" | ") + ". These are reference photos for the upcoming side-profile reconstruction step.";
}

function savedCapturedFaceSummary() {
  try {
    const saved = localStorage.getItem("floatingSkinCapturedFaceMesh");
    if (!saved) return null;
    const raw = JSON.parse(saved);
    return {
      source: raw.source || raw.captureSource || "captured-face",
      savedAt: raw.savedAt || raw.createdAt || "unknown time",
      vertexCount: raw.positions ? raw.positions.length : 0,
      triangleCount: raw.triangles ? raw.triangles.length : 0,
      hasTexture: !!localStorage.getItem("floatingSkinCapturedFaceTexturePNG")
    };
  } catch (e) { return null; }
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
  const fileList = Array.from(files || []);
  if (!fileList.length) return;

  const loaded = [];
  let pending = fileList.length;
  let lastAddedIndex = -1;

  const finishOne = () => {
    pending--;
    if (pending > 0) return;

    if (loaded.length > 1) {
      const composite = makeUploadedCompositeCanvas(loaded);
      const compositeIndex = addTextureChoice(composite, `Uploaded composite (${loaded.length})`, {
        fillMode: "cover"
      });
      activeTextureIndex = compositeIndex;
      updateTextureSelectionUI();
      if (ui.stats) ui.stats.textContent = "Uploaded composite selected. Click SVG sections and apply to selected regions, or apply to full face.";
    } else if (lastAddedIndex >= 0) {
      activeTextureIndex = lastAddedIndex;
      updateTextureSelectionUI();
      if (ui.stats) ui.stats.textContent = "Uploaded texture selected. Click SVG sections and apply to selected regions, or apply to full face.";
    }
  };

  for (const file of fileList) {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const fullCanvasSource = makeFullCanvasImageSource(img, "cover");
        loaded.push({ img, source: fullCanvasSource, label: file.name });
        lastAddedIndex = addTextureChoice(fullCanvasSource, file.name, { fillMode: "cover" });
        finishOne();
      };

      img.onerror = finishOne;
      img.src = e.target.result;
    };

    reader.onerror = finishOne;
    reader.readAsDataURL(file);
  }
}

function getTextureBrushShape() {
  return ui.textureBrushShape ? ui.textureBrushShape.value : "round";
}

function drawTextureBrushDab(tex, px, py, size, opacity, shape) {
  dctx.save();
  dctx.globalAlpha = opacity;

  if (shape === "round") {
    dctx.beginPath();
    dctx.arc(px, py, size / 2, 0, Math.PI * 2);
    dctx.clip();
  }

  // Square brush leaves the image patch unclipped. Round brush clips the same
  // fitted texture patch to a circle, so strokes can read as continuous marks.
  dctx.drawImage(tex, px - size / 2, py - size / 2, size, size);
  dctx.restore();
}

function stampActiveTexture(px, py, options = {}) {
  if (!ui.useTextureStamp || !ui.useTextureStamp.checked) return false;
  if (activeTextureIndex < 0) return false;
  if (!textureChoices[activeTextureIndex]) return false;

  const tex = textureChoices[activeTextureIndex].source;
  const size = Number(ui.stampSize.value);
  const opacity = Number(ui.stampOpacity.value);
  const shape = getTextureBrushShape();

  drawTextureBrushDab(tex, px, py, size, opacity, shape);

  stampHistory.push({
    time: new Date().toISOString(),
    textureIndex: activeTextureIndex,
    textureLabel: textureChoices[activeTextureIndex].label,
    x: px,
    y: py,
    size,
    opacity,
    shape
  });

  if (!options.deferUpdate) {
    updateBlurredDesign();
  }

  return true;
}

function drawTextureBrushStroke(a, b) {
  if (!a || !b) return false;
  if (!ui.useTextureStamp || !ui.useTextureStamp.checked) return false;
  if (activeTextureIndex < 0 || !textureChoices[activeTextureIndex]) return false;

  const size = Number(ui.stampSize.value || 120);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const spacing = Math.max(2, Math.min(24, size * 0.18));
  const steps = Math.max(1, Math.ceil(dist / spacing));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    stampActiveTexture(a.x + dx * t, a.y + dy * t, { deferUpdate: true });
  }

  return true;
}

if (ui.textureFiles) {
  ui.textureFiles.addEventListener("change", (e) => {
    loadTextureFiles(e.target.files);
  });
}

if (ui.applyFullFaceTextureBtn) {
  ui.applyFullFaceTextureBtn.addEventListener("click", () => {
    applyActiveTextureToFullFace();
  });
}

addBuiltInTextures();
// Capture has been removed from the student-facing workflow.
// Previously saved webcam face textures are intentionally ignored here.


function clearDesign() {
  fullFaceTextureIndex = -1;
  faceRegionAssignments.clear();
  fillNeutralDesignCanvas();
  updateFaceRegionSelectionUI();
}

function drawDemoDesign() {
  fullFaceTextureIndex = -1;
  faceRegionAssignments.clear();
  drawGeometricCirclesPattern(dctx, DESIGN_W, DESIGN_H);
  updateFaceRegionSelectionUI();
}
clearDesign();
applyActiveTextureToFullFace({ rebuild: false });
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
  designCanvas.setPointerCapture?.(e.pointerId);

  if (ui.useTextureStamp && ui.useTextureStamp.checked && activeTextureIndex >= 0) {
    stampActiveTexture(lastPos.x, lastPos.y, { deferUpdate: true });
  }
});

designCanvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;

  const p = getCanvasPos(e);

  if (ui.useTextureStamp && ui.useTextureStamp.checked && activeTextureIndex >= 0) {
    drawTextureBrushStroke(lastPos, p);
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

function finishCanvasDrawing() {
  if (drawing) {
    updateBlurredDesign();
    rebuildFloatingGeometry();
  }
  drawing = false;
  lastPos = null;
}

window.addEventListener("pointerup", finishCanvasDrawing);
window.addEventListener("pointercancel", finishCanvasDrawing);

// ------------------------------------------------------------
// Three.js scene
// ------------------------------------------------------------
const viewer = document.getElementById("viewer");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true
});
// Clamp high-DPI phone screens so the WebGL canvas does not become too large.
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
let baseSurface = null;
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

let resizeLayoutTimer = null;
window.addEventListener("resize", () => {
  onResize();
  if (layoutModeChoice() === "auto") {
    clearTimeout(resizeLayoutTimer);
    resizeLayoutTimer = setTimeout(() => applyDeviceLayout({ forceDefaults: false }), 180);
  }
});

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
  let raw;
  if (String(url).startsWith("localStorage:")) {
    const key = String(url).slice("localStorage:".length);
    const saved = localStorage.getItem(key);
    if (!saved) {
      throw new Error("No captured face is saved yet. Open Live capture, freeze a face, then choose ‘Use this capture in Designer.’");
    }
    raw = JSON.parse(saved);
  } else {
    raw = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${url}`);
      return r.json();
    });
  }
  return meshFromRaw(raw, url);
}

function meshFromRaw(raw, sourceLabel = "raw mesh") {
  const positions = raw.positions.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const uvs = raw.uvs.map((uv) => new THREE.Vector2(uv[0], uv[1]));
  const triangles = raw.triangles.map((t) => [t[0], t[1], t[2]]);

  applyManualFaceMorphs(positions, uvs);

  // Only the classroom base head uses the depth-compression slider. Imported
  // student head choices keep their authored profile depth unless a prep file
  // explicitly asks otherwise.
  const allowDepthScale = raw.applyDepthScale != null ? !!raw.applyDepthScale : currentModelFlag("applyDepthScale", false);
  const depthScale = allowDepthScale && ui.modelDepthScale ? parseFloat(ui.modelDepthScale.value || "1.00") : 1.00;
  const faceVertexCount = (currentModelMode === "faceHands") ? 468 : positions.length;
  if (allowDepthScale) {
    const limit = Math.min(faceVertexCount, positions.length);
    for (let i = 0; i < limit; i++) {
      positions[i].z *= depthScale;
    }
  }

  // Center and scale mesh for viewing
  const box = new THREE.Box3().setFromPoints(positions);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 260 / maxDim;

  positions.forEach((p) => p.sub(center).multiplyScalar(scale));

  return {
    source: raw.source || sourceLabel,
    positions,
    uvs,
    triangles,
    triangleRegionNames: raw.triangleRegionNames || null,
    displayName: raw.displayName || raw.source || sourceLabel,
    studentChoice: !!raw.studentChoice,
    textureMapping: raw.textureMapping || null,
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
      regionName: triangleRegionName(mesh, i),
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

  baseWire.visible = currentWorkflowStage === "shape" ? true : ui.showMesh.checked;
  contentGroup.add(baseWire);
}

function buildBaseSurface(mesh) {
  if (baseSurface) contentGroup.remove(baseSurface);

  const geometry = new THREE.BufferGeometry();
  const flatPositions = [];
  mesh.positions.forEach((pnt) => flatPositions.push(pnt.x, pnt.y, pnt.z));
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(flatPositions, 3));
  geometry.setIndex(mesh.triangles.flat());
  geometry.computeVertexNormals();

  baseSurface = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xd8d0c8,
      roughness: 0.72,
      metalness: 0.02,
      transparent: true,
      opacity: 0.74,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
  );

  baseSurface.visible = true;
  contentGroup.add(baseSurface);
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
    if (!shouldUseTriangleForSelectedRegions(tri)) continue;

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


// ------------------------------------------------------------
// Print-safe displacement rules and feature stabilization
// ------------------------------------------------------------
const EYE_MOUTH_PROTECTED_LANDMARKS = [
  // Left eye loop + eyelid support
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,

  // Right eye loop + eyelid support
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,

  // Outer and inner mouth/lip loops
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291,
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
  185, 40, 39, 37, 0, 267, 269, 270, 409,
  191, 80, 81, 82, 13, 312, 311, 310, 415
];

const NOSE_SHAPE_PROTECTED_LANDMARKS = [
  // Bridge, tip, nostril/base support. Gentler than eye/mouth locking:
  // texture can still appear, but geometry displacement is reduced.
  1, 2, 4, 5, 6, 19, 44, 45, 48, 51, 64, 94, 97, 98, 99,
  115, 122, 125, 128, 168, 195, 196, 197, 198, 236, 239, 240,
  241, 248, 275, 278, 279, 281, 326, 327, 328, 343, 344, 351,
  354, 357, 360, 363, 399, 412, 419, 420, 437, 438, 439, 440, 456
];

const NOSE_MIN_DISPLACEMENT_WEIGHT = 0.35;

function smoothstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function nearestLandmarkDistance(indices, x, y, z) {
  if (!meshData || !meshData.positions) return Infinity;

  let minD2 = Infinity;

  for (const idx of indices) {
    const p = meshData.positions[idx];
    if (!p) continue;

    const dx = x - p.x;
    const dy = y - p.y;
    const dz = z - p.z;
    const d2 = dx * dx + dy * dy + dz * dz;

    if (d2 < minD2) minD2 = d2;
  }

  return Math.sqrt(minD2);
}

function protectionRamp(d, radius, falloff, minimumWeight) {
  if (d <= radius) return minimumWeight;
  if (d >= radius + falloff) return 1;
  return minimumWeight + (1 - minimumWeight) * smoothstep01((d - radius) / Math.max(1e-9, falloff));
}

function featureProtectionWeight(x, y, z) {
  if (!ui.protectFeatureRegions || !ui.protectFeatureRegions.checked) {
    return 1;
  }

  const radius = ui.featureProtectRadius
    ? parseFloat(ui.featureProtectRadius.value)
    : 8.0;

  const falloff = ui.featureProtectFalloff
    ? parseFloat(ui.featureProtectFalloff.value)
    : 16.0;

  const eyeMouthD = nearestLandmarkDistance(EYE_MOUTH_PROTECTED_LANDMARKS, x, y, z);
  const eyeMouthWeight = protectionRamp(eyeMouthD, radius, falloff, 0);

  const noseD = nearestLandmarkDistance(NOSE_SHAPE_PROTECTED_LANDMARKS, x, y, z);
  const noseWeight = protectionRamp(
    noseD,
    radius * 0.85,
    falloff * 1.15,
    NOSE_MIN_DISPLACEMENT_WEIGHT
  );

  return Math.min(eyeMouthWeight, noseWeight);
}

function clampDisplacementForPrint(displacement) {
  if (!ui.limitNonplanarOffset || !ui.limitNonplanarOffset.checked) {
    return displacement;
  }

  const maxOffset = ui.maxNonplanarOffset
    ? parseFloat(ui.maxNonplanarOffset.value)
    : 2.5;

  return Math.max(-maxOffset, Math.min(maxOffset, displacement));
}

function applyDisplacementRules(displacement, x, y, z) {
  const clamped = clampDisplacementForPrint(displacement);
  const featureWeight = featureProtectionWeight(x, y, z);

  return {
    displacement: clamped * featureWeight,
    featureWeight,
    clampedDisplacement: clamped
  };
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
      const rawDisplacement = minDisp + (maxDisp - minDisp) * brightness;
      const rules = applyDisplacementRules(rawDisplacement, px, py, pz);
      const offset = baseOffset + rules.displacement;

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
    if (!shouldUseTriangleForSelectedRegions(tri)) continue;
    const ux = tri.uvCenter.x * (DESIGN_W - 1);
    const uy = uvYToDesignPixelY(tri.uvCenter.y);

    const sample = sampleCanvasRGBA(ux, uy);
    const b = sample.brightness / 255;

    const rawDelta = THREE.MathUtils.lerp(minDisp, maxDisp, b);
    const rules = applyDisplacementRules(rawDelta, tri.center.x, tri.center.y, tri.center.z);
    const offset = baseOffset + rules.displacement;
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
    `model: ${meshData.modelLabel || MODEL_LABELS[currentModelMode] || currentModelMode}
source: ${meshData.source || "unknown"}
vertices: ${meshData.positions.length}
triangles: ${meshData.triangles.length}
base face depth scale: ${ui.modelDepthScale ? Number(ui.modelDepthScale.value || 0).toFixed(2) : "n/a"}
manual face sliders active: ${getMorphValues ? Object.values(getMorphValues()).some((v) => Math.abs(v) > 1e-6) ? "yes" : "no" : "n/a"}
face SVG regions: ${modelHasFaceRegions() ? (selectedFaceRegions.size ? [...selectedFaceRegions].map(faceRegionLabel).join(", ") : "none selected") : "not available for this model"}
region geometry limit: ${faceRegionLimitActive() ? "on" : "off"}
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
samples per triangle ∝ 3D triangle surface area

print-safe clamp:
${ui.limitNonplanarOffset && ui.limitNonplanarOffset.checked ? "on" : "off"} ±${ui.maxNonplanarOffset ? ui.maxNonplanarOffset.value : "n/a"}

eye/mouth/nose shape stabilization:
${ui.protectFeatureRegions && ui.protectFeatureRegions.checked ? "on" : "off"}`;
}

function rebuildFloatingGeometry() {
  if (!meshData) return;
  if (currentWorkflowStage === "shape") {
    updateShapeStageStats();
    return;
  }

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
  if (triGlyphs) triGlyphs.visible = currentWorkflowStage === "texture" && ui.showTriGlyphs.checked;

  updateStatsText();
}
// ------------------------------------------------------------
// Two-state workflow
// ------------------------------------------------------------
function stageGroupList() {
  return {
    shape: [ui.baseHeadGroup, ui.faceMorphGroup],
    texture: [
      ui.faceRegionSvg ? document.getElementById("faceRegionGroup") : null,
      ui.visibilityGroup,
      ui.uvFloatingGroup,
      ui.triGlyphGroup,
      ui.designCanvasGroup,
      ui.textureChoicesGroup,
      ui.exportGroup
    ],
    optional: []
  };
}

function setGroupVisible(group, visible) {
  if (group) group.classList.toggle("stageHidden", !visible);
}

function setWorkflowStage(stage, options = {}) {
  currentWorkflowStage = stage === "texture" ? "texture" : "shape";
  document.body.classList.toggle("stage-shape", currentWorkflowStage === "shape");
  document.body.classList.toggle("stage-texture", currentWorkflowStage === "texture");

  const groups = stageGroupList();
  groups.shape.forEach((g) => setGroupVisible(g, currentWorkflowStage === "shape"));
  groups.texture.forEach((g) => setGroupVisible(g, currentWorkflowStage === "texture"));
  groups.optional.forEach((g) => setGroupVisible(g, false));

  if (ui.shapeStageBtn) ui.shapeStageBtn.classList.toggle("activeStage", currentWorkflowStage === "shape");
  if (ui.textureStageBtn) ui.textureStageBtn.classList.toggle("activeStage", currentWorkflowStage === "texture");
  if (ui.continueToTextureBtn) ui.continueToTextureBtn.style.display = currentWorkflowStage === "shape" ? "inline-block" : "none";
  if (ui.continueToTextureBtn2) ui.continueToTextureBtn2.style.display = currentWorkflowStage === "shape" ? "inline-block" : "none";
  if (ui.backToShapeBtn) ui.backToShapeBtn.style.display = currentWorkflowStage === "texture" ? "inline-block" : "none";

  if (ui.workflowStatus) {
    ui.workflowStatus.textContent = currentWorkflowStage === "shape"
      ? "State 1: base face/head mesh only. Use the sliders, rotate the head, and ignore images/textures until the shape feels right."
      : "State 2: the shaped head is locked in as the base. Now choose built-in patterns or upload images and assign them to SVG face regions.";
  }

  if (baseSurface) baseSurface.visible = true;
  if (baseWire) baseWire.visible = currentWorkflowStage === "shape" ? true : (ui.showMesh ? ui.showMesh.checked : true);
  if (floatingPoints) floatingPoints.visible = currentWorkflowStage === "texture" && ui.showPoints && ui.showPoints.checked;
  if (triGlyphs) triGlyphs.visible = currentWorkflowStage === "texture" && ui.showTriGlyphs && ui.showTriGlyphs.checked;

  if (!options.skipRebuild && meshData) {
    if (currentWorkflowStage === "texture") rebuildFloatingGeometry();
    else updateShapeStageStats();
  }
}

function updateShapeStageStats() {
  if (!ui.stats || !meshData) return;
  ui.stats.textContent = `State 1: base face/head shaping
model: ${meshData.modelLabel || "Base face/head"}
vertices: ${meshData.positions.length}
triangles: ${meshData.triangles.length}

Visible objects:
base shaded mesh + wire overlay only

Next step:
click “Continue to image / texture stage” when the head shape is ready.`;
}

function scheduleFaceMorphUpdate() {
  syncUIText();
  clearTimeout(morphUpdateTimer);
  morphUpdateTimer = setTimeout(() => {
    switchModel("face").catch((err) => {
      console.error(err);
      if (ui.stats) ui.stats.textContent = "Error updating face shape: " + err.message;
    });
  }, 45);
}

// ------------------------------------------------------------
// Events
// ------------------------------------------------------------
if (ui.shapeStageBtn) ui.shapeStageBtn.addEventListener("click", () => setWorkflowStage("shape"));
if (ui.textureStageBtn) ui.textureStageBtn.addEventListener("click", () => setWorkflowStage("texture"));
if (ui.continueToTextureBtn) ui.continueToTextureBtn.addEventListener("click", () => setWorkflowStage("texture"));
if (ui.continueToTextureBtn2) ui.continueToTextureBtn2.addEventListener("click", () => setWorkflowStage("texture"));
if (ui.backToShapeBtn) ui.backToShapeBtn.addEventListener("click", () => setWorkflowStage("shape"));

ui.showMesh.addEventListener("change", () => {
  if (baseWire) baseWire.visible = ui.showMesh.checked;
});

ui.showPoints.addEventListener("change", () => {
  if (floatingPoints) floatingPoints.visible = currentWorkflowStage === "texture" && ui.showPoints.checked;
});

ui.showTriGlyphs.addEventListener("change", () => {
  if (triGlyphs) triGlyphs.visible = currentWorkflowStage === "texture" && ui.showTriGlyphs.checked;
});

if (ui.flipY) {
  ui.flipY.addEventListener("change", applyModelOrientation);
}

[
  ui.sampleStep,
  ui.pointBaseOffset,
  ui.pointMinDisp,
  ui.pointMaxDisp,
  ui.maxNonplanarOffset,
  ui.featureProtectRadius,
  ui.featureProtectFalloff,
  ui.pointSize,
  ui.flipDesignY,
  ui.triBaseOffset,
  ui.triMinDisp,
  ui.triMaxDisp,
  ui.triScale
].filter(Boolean).forEach((el) => el.addEventListener("change", rebuildFloatingGeometry));

[ui.flipDesignY, ui.fitTextureToFaceUvBounds].filter(Boolean).forEach((el) => {
  el.addEventListener("change", buildFaceRegionSvg);
});

if (ui.modelMode) {
  ui.modelMode.addEventListener("change", () => {
    switchModel(ui.modelMode.value).catch((err) => {
      console.error(err);
      if (ui.stats) ui.stats.textContent = "Error switching model: " + err.message;
    });
  });
}

for (const id of FACE_MORPH_IDS) {
  const el = ui[id];
  if (!el) continue;
  el.addEventListener("input", scheduleFaceMorphUpdate);
  el.addEventListener("change", scheduleFaceMorphUpdate);
}

if (ui.resetMorphsBtn) ui.resetMorphsBtn.addEventListener("click", resetFaceMorphs);

if (ui.modelDepthScale) {
  ui.modelDepthScale.addEventListener("input", scheduleFaceMorphUpdate);
  ui.modelDepthScale.addEventListener("change", scheduleFaceMorphUpdate);
}

if (ui.selectAllFaceRegionsBtn) ui.selectAllFaceRegionsBtn.addEventListener("click", selectAllFaceRegions);
if (ui.clearFaceRegionsBtn) ui.clearFaceRegionsBtn.addEventListener("click", clearFaceRegions);
if (ui.selectCoreFaceRegionsBtn) ui.selectCoreFaceRegionsBtn.addEventListener("click", selectCoreFaceRegions);
if (ui.applySelectedTextureToRegionsBtn) ui.applySelectedTextureToRegionsBtn.addEventListener("click", applyActiveTextureToSelectedRegions);
if (ui.limitToSelectedFaceRegions) ui.limitToSelectedFaceRegions.addEventListener("change", rebuildFloatingGeometry);

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

// ------------------------------------------------------------
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
      baseSurface,
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
      applyDisplacementRules,
      featureProtectionWeight,
      clampDisplacementForPrint,
      cylindricalProjectionToDesignPixel,
      frontProjectionToDesignPixel,
      buildSurfaceSamplePlan,
      sampleTriangleBarycentric,
      lowDiscrepancyDesignPoint,
      uvYToDesignPixelY
    };
  }
};


function clearCurrentModelObjects() {
  floatingBuildToken++;
  for (const obj of [baseWire, baseSurface, floatingPoints, triGlyphs]) {
    if (obj) contentGroup.remove(obj);
  }
  baseWire = null;
  baseSurface = null;
  floatingPoints = null;
  triGlyphs = null;
  uvLookup = null;
  uvAccel = null;
  samplerInfo = null;
}

function configureMappingForModel(mode) {
  if (ui.flipY && MODEL_FLAGS[mode] && "defaultFlipY" in MODEL_FLAGS[mode]) {
    ui.flipY.checked = !!MODEL_FLAGS[mode].defaultFlipY;
    applyModelOrientation();
  }

  const studentHeadMode = mode.startsWith("student_");
  const handMode = mode === "hands" || mode === "rightHand" || mode === "leftHand" || mode === "faceHands";

  if (studentHeadMode) {
    // These imported heads have already been UV-remapped into the MediaPipe
    // design-canvas bounds. Use their UVs directly so texture placement matches
    // the SVG picker/MediaPipe map instead of re-projecting from x/y/z.
    if (ui.useCylindricalProjectionTexture) ui.useCylindricalProjectionTexture.checked = false;
    if (ui.useFrontProjectionTexture) ui.useFrontProjectionTexture.checked = false;
    if (ui.fitTextureToFaceUvBounds) ui.fitTextureToFaceUvBounds.checked = true;
  } else if (handMode) {
    if (ui.useCylindricalProjectionTexture) ui.useCylindricalProjectionTexture.checked = false;
    if (ui.useFrontProjectionTexture) ui.useFrontProjectionTexture.checked = true;
    if (ui.fitTextureToFaceUvBounds) ui.fitTextureToFaceUvBounds.checked = true;
  } else {
    if (ui.useCylindricalProjectionTexture) ui.useCylindricalProjectionTexture.checked = true;
    if (ui.useFrontProjectionTexture) ui.useFrontProjectionTexture.checked = true;
    if (ui.fitTextureToFaceUvBounds) ui.fitTextureToFaceUvBounds.checked = true;
  }
}

async function switchModel(mode) {
  const nextMode = MODEL_SOURCES[mode] ? mode : "face";
  currentModelMode = nextMode;
  if (ui.modelMode) ui.modelMode.value = nextMode;
  updateMorphPanelVisibility();
  if (ui.stats) ui.stats.textContent = "Loading " + (MODEL_LABELS[nextMode] || nextMode) + "...";
  clearCurrentModelObjects();
  configureMappingForModel(nextMode);

  try {
    meshData = await loadMesh(MODEL_SOURCES[nextMode]);
  } catch (e) {
    console.error(e);
    throw e;
  }
  meshData.modelMode = currentModelMode;
  meshData.modelLabel = MODEL_LABELS[currentModelMode] || currentModelMode;

  computeVertexNormals(meshData);
  buildTriangleData(meshData);
  buildFaceRegionSvg();
  uvAccel = buildUvAcceleration(meshData, 64);
  buildBaseSurface(meshData);
  buildBaseWire(meshData);
  updateBlurredDesign();
  if (currentWorkflowStage === "texture") {
    rebuildFloatingGeometry();
  } else {
    if (floatingPoints) floatingPoints.visible = false;
    if (triGlyphs) triGlyphs.visible = false;
    updateShapeStageStats();
  }
  setWorkflowStage(currentWorkflowStage, { skipRebuild: true });
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function init() {
  syncUIText();
  updateMorphPanelVisibility();
  applyDeviceLayout({ forceDefaults: false });
  const params = new URLSearchParams(window.location.search);
  const requestedStage = params.get("stage") === "texture" ? "texture" : "shape";
  setWorkflowStage(requestedStage, { skipRebuild: true });
  const initialMode = ui.modelMode && MODEL_SOURCES[ui.modelMode.value] ? ui.modelMode.value : "face";
  if (ui.modelMode) ui.modelMode.value = initialMode;
  await switchModel(initialMode);
  setWorkflowStage(requestedStage, { skipRebuild: true });
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
    "\n\nMake sure index.html, sketch.js, preset_face_mesh.json, the student_*.json mesh files, face_region_data.js, and face_svg_static.js are in the same folder, and run from a local server or GitHub Pages, not file://.";
});
