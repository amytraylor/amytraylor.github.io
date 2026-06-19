import * as THREE from 'https://unpkg.com/three@0.160.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.1/examples/jsm/controls/OrbitControls.js';
import { ProjectionUVMapper, TEMPLATE_CALIBRATIONS, UVMath } from './projection_shader_or_uv_mapper.js';
import { TextureCanvas, REGION_DEFS } from './texture_canvas.js';

const { clamp, smoothstep } = UVMath;

const viewer = document.querySelector('#viewer');
const textureCanvasEl = document.querySelector('#textureCanvas');
const textureCanvas = new TextureCanvas(textureCanvasEl);
const uvMapper = new ProjectionUVMapper(TEMPLATE_CALIBRATIONS.templateA);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, viewer.clientWidth / viewer.clientHeight, 0.01, 100);
camera.position.set(0, 0.2, 5.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.05, 0.0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x262b33, 2.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 5, 4);
scene.add(key);
const fill = new THREE.DirectionalLight(0x9bbcff, 1.1);
fill.position.set(-4, 2, 3);
scene.add(fill);

const morphs = {
  faceWidth: 0.00,
  faceLength: 0.00,
  jawWidth: 0.10,
  chinLength: 0.00,
  noseProjection: 1.00,
  noseWidth: 0.00,
  lips: 0.65,
  leftCheek: 0.35,
  rightCheek: 0.35,
  browRidge: 0.30,
  earSize: 1.00
};
const defaults = structuredClone(morphs);

let headGeometry, headMesh, wireMesh, neckMesh, leftEar, rightEar, landmarkGroup;
let material;

function gaussian(x, sigma) {
  return Math.exp(-(x * x) / (2 * sigma * sigma));
}

function angleToFront(theta) {
  // theta is generated around the vertical axis, with 0 = front.
  let t = ((theta + Math.PI) % (2 * Math.PI)) - Math.PI;
  return t;
}

function computeHeadVertex(meta, m) {
  const yNorm = meta.yNorm;
  const theta = meta.theta;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const r = Math.sqrt(Math.max(0.001, 1 - yNorm * yNorm));

  const lowerMask = 1 - smoothstep(-0.88, -0.22, yNorm);
  const upperMask = smoothstep(0.15, 0.95, yNorm);
  const cheekBand = gaussian(yNorm + 0.05, 0.48);

  // Base printable-ish head proportions.  The 0.38+0.70*r part is mirrored in
  // ProjectionUVMapper.semanticXFromPosition() so template alignment stays stable.
  let width = 0.38 + 0.70 * r;
  width *= 1 + 0.16 * m.faceWidth;
  width *= 1 + 0.24 * m.jawWidth * lowerMask;
  width *= 1 - 0.08 * upperMask;

  let depth = 0.48 + 0.45 * r;
  depth *= 1 - 0.06 * m.faceWidth;

  let x = width * sinT;
  let y = yNorm * (1.26 + 0.16 * m.faceLength);
  y -= 0.14 * m.chinLength * lowerMask * gaussian(yNorm + 0.88, 0.18);
  let z = depth * cosT;

  const frontTheta = angleToFront(theta);
  const frontMask = gaussian(frontTheta, 0.72);
  const semanticX = clamp(x / Math.max(width, 0.001), -1, 1);

  // Eye sockets create visible face landmarks while keeping a closed mesh.
  const eyeL = gaussian(semanticX + 0.36, 0.13) * gaussian(yNorm - 0.36, 0.095) * frontMask;
  const eyeR = gaussian(semanticX - 0.36, 0.13) * gaussian(yNorm - 0.36, 0.095) * frontMask;
  z -= 0.11 * (eyeL + eyeR);

  // Nose extrusion: this is geometry displacement, not texture-only fake shading.
  const noseSigma = 0.105 + 0.055 * (m.noseWidth + 1) / 2;
  const nose = gaussian(semanticX, noseSigma) * gaussian(yNorm - 0.04, 0.29) * frontMask;
  const noseTip = gaussian(semanticX, noseSigma * 1.1) * gaussian(yNorm + 0.12, 0.12) * frontMask;
  z += (0.10 + 0.22 * m.noseProjection) * nose;
  z += 0.10 * m.noseProjection * noseTip;
  x += Math.sign(semanticX) * 0.035 * m.noseWidth * nose;

  // Cheeks can be raised asymmetrically for cyborg/adaptation features.
  const cheekL = gaussian(semanticX + 0.47, 0.22) * gaussian(yNorm + 0.05, 0.24) * frontMask;
  const cheekR = gaussian(semanticX - 0.47, 0.22) * gaussian(yNorm + 0.05, 0.24) * frontMask;
  z += 0.12 * m.leftCheek * cheekL;
  z += 0.12 * m.rightCheek * cheekR;

  // Lips and brow ridges.
  const lips = gaussian(semanticX, 0.28) * gaussian(yNorm + 0.49, 0.075) * frontMask;
  z += 0.16 * m.lips * lips;
  const brow = (gaussian(semanticX + 0.35, 0.16) + gaussian(semanticX - 0.35, 0.16)) * gaussian(yNorm - 0.52, 0.075) * frontMask;
  z += 0.11 * m.browRidge * brow;

  // Slight flattening at the back of the skull improves print-like stability.
  const backMask = gaussian(Math.abs(frontTheta) - Math.PI, 0.55);
  z += 0.05 * backMask * cheekBand;

  return [x, y, z];
}

function createHeadGeometry(rows = 92, cols = 128) {
  const positions = [];
  const indices = [];
  const semantic = [];

  for (let iy = 0; iy <= rows; iy++) {
    const yNorm = 1 - 2 * (iy / rows); // top to bottom
    for (let ix = 0; ix < cols; ix++) {
      const theta = (ix / cols) * Math.PI * 2;
      const meta = { yNorm, theta };
      const [x, y, z] = computeHeadVertex(meta, morphs);
      positions.push(x, y, z);
      semantic.push(meta);
    }
  }

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const a = iy * cols + ix;
      const b = iy * cols + ((ix + 1) % cols);
      const c = (iy + 1) * cols + ix;
      const d = (iy + 1) * cols + ((ix + 1) % cols);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.userData.semantic = semantic;
  uvMapper.applyToGeometry(geometry);
  geometry.computeVertexNormals();
  return geometry;
}

function updateHeadGeometry() {
  const pos = headGeometry.getAttribute('position');
  const semantic = headGeometry.userData.semantic;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = computeHeadVertex(semantic[i], morphs);
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  headGeometry.computeVertexNormals();
  // Keep the feature-aligned UVs stable after shape changes, but allow very large
  // face-width changes to be reprojected if the user clicks Recompute UVs.

  const earScale = 0.34 * morphs.earSize;
  leftEar.scale.set(0.18 * morphs.earSize, earScale, 0.105 * morphs.earSize);
  rightEar.scale.copy(leftEar.scale);
}

function createEarMesh(side) {
  const geo = new THREE.SphereGeometry(1, 40, 22);
  // Pinch the inner side a little so the ears look less like balls.
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rim = Math.sqrt(y * y + z * z);
    pos.setXYZ(i, x * (0.72 + 0.18 * rim), y, z);
  }
  geo.computeVertexNormals();
  uvMapper.applyEarUVs(geo, side);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(side * 1.05, 0.02, -0.02);
  mesh.rotation.z = side * 0.08;
  mesh.scale.set(0.18, 0.34, 0.105);
  return mesh;
}

function createNeckMesh() {
  const geo = new THREE.CylinderGeometry(0.55, 0.72, 0.86, 96, 8, false);
  geo.translate(0, -1.55, -0.05);
  geo.userData.semantic = [];
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    geo.userData.semantic.push({ yNorm: clamp((y + 1.55) / 0.43 - 1.0, -1, -0.72) });
  }
  uvMapper.applyToGeometry(geo);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function resetLandmarks() {
  if (landmarkGroup) scene.remove(landmarkGroup);
  landmarkGroup = new THREE.Group();
  const points = [
    [0.0, 0.98, 'crown'], [-0.36, 0.36, 'eye'], [0.36, 0.36, 'eye'],
    [0.0, 0.02, 'nose'], [0.0, -0.49, 'mouth'], [0.0, -0.82, 'chin'],
    [-0.48, -0.05, 'cheek'], [0.48, -0.05, 'cheek']
  ];
  const sphereGeo = new THREE.SphereGeometry(0.025, 12, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x4f8cff });
  for (const [sx, sy] of points) {
    const yNorm = sy;
    const r = Math.sqrt(Math.max(0.001, 1 - yNorm * yNorm));
    const width = 0.38 + 0.70 * r;
    const x = sx * width;
    const y = yNorm * 1.26;
    const z = 0.68 * Math.sqrt(Math.max(0.001, 1 - (x / Math.max(width, 0.001)) ** 2));
    const marker = new THREE.Mesh(sphereGeo, sphereMat);
    marker.position.set(x, y, z + 0.06);
    landmarkGroup.add(marker);
  }
  scene.add(landmarkGroup);
}

function makeSlider(key, label, min, max, step = 0.01) {
  const root = document.createElement('div');
  root.className = 'control-row';
  const lab = document.createElement('label');
  lab.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = morphs[key];
  const value = document.createElement('span');
  value.className = 'value';
  value.textContent = Number(morphs[key]).toFixed(2);
  input.addEventListener('input', () => {
    morphs[key] = Number(input.value);
    value.textContent = Number(morphs[key]).toFixed(2);
    updateHeadGeometry();
  });
  root.append(lab, input, value);
  return { root, input, value, key };
}

const sliderDefs = [
  ['faceWidth', 'Face width', -1, 1],
  ['faceLength', 'Face length', -1, 1],
  ['jawWidth', 'Jaw width', -1, 1],
  ['chinLength', 'Chin length', -1, 1],
  ['noseProjection', 'Nose extrusion', 0, 2.2],
  ['noseWidth', 'Nose width', -1, 1],
  ['lips', 'Lip extrusion', 0, 1.8],
  ['leftCheek', 'Left cheek', 0, 1.6],
  ['rightCheek', 'Right cheek', 0, 1.6],
  ['browRidge', 'Brow ridge', 0, 1.6],
  ['earSize', 'Ear size', 0.55, 1.7]
];
const sliderRecords = [];

function setupUI() {
  const morphControls = document.querySelector('#morphControls');
  for (const def of sliderDefs) {
    const record = makeSlider(...def);
    sliderRecords.push(record);
    morphControls.appendChild(record.root);
  }

  const regionSelect = document.querySelector('#regionSelect');
  for (const region of REGION_DEFS) {
    const opt = document.createElement('option');
    opt.value = region.id;
    opt.textContent = region.name;
    regionSelect.appendChild(opt);
  }
  regionSelect.value = textureCanvas.selectedRegionId;
  regionSelect.addEventListener('change', () => textureCanvas.setSelectedRegion(regionSelect.value));

  textureCanvasEl.addEventListener('click', (event) => {
    const hit = textureCanvas.hitTest(event.clientX, event.clientY);
    if (hit) {
      regionSelect.value = hit;
      textureCanvas.setSelectedRegion(hit);
    }
  });

  document.querySelector('#fillRegionButton').addEventListener('click', () => {
    textureCanvas.fillRegion(regionSelect.value, document.querySelector('#fillColor').value);
  });
  document.querySelector('#resetTextureButton').addEventListener('click', () => textureCanvas.reset());

  document.querySelectorAll('.template-button').forEach(button => {
    button.addEventListener('click', async () => {
      document.querySelectorAll('.template-button').forEach(b => b.classList.remove('selected'));
      button.classList.add('selected');
      const id = button.dataset.template;
      await textureCanvas.loadTemplate(id);
      uvMapper.setCalibration(TEMPLATE_CALIBRATIONS[id]);
      recomputeUVs();
    });
  });

  document.querySelector('#showWire').addEventListener('change', (e) => {
    wireMesh.visible = e.currentTarget.checked;
  });
  document.querySelector('#showLandmarks').addEventListener('change', (e) => {
    textureCanvas.showLandmarks = e.currentTarget.checked;
    textureCanvas.redraw();
    landmarkGroup.visible = e.currentTarget.checked;
  });
  document.querySelector('#recomputeUVButton').addEventListener('click', recomputeUVs);
  document.querySelector('#resetMorphsButton').addEventListener('click', () => {
    Object.assign(morphs, defaults);
    for (const rec of sliderRecords) {
      rec.input.value = morphs[rec.key];
      rec.value.textContent = Number(morphs[rec.key]).toFixed(2);
    }
    updateHeadGeometry();
  });
}

function recomputeUVs() {
  uvMapper.applyToGeometry(headGeometry);
  uvMapper.applyToGeometry(neckMesh.geometry);
  uvMapper.applyEarUVs(leftEar.geometry, -1);
  uvMapper.applyEarUVs(rightEar.geometry, 1);
}

async function init() {
  await textureCanvas.loadTemplate('templateA');
  material = new THREE.MeshStandardMaterial({
    map: textureCanvas.texture,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  headGeometry = createHeadGeometry();
  headMesh = new THREE.Mesh(headGeometry, material);
  scene.add(headMesh);

  wireMesh = new THREE.Mesh(headGeometry, new THREE.MeshBasicMaterial({
    color: 0x111111,
    wireframe: true,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  }));
  wireMesh.visible = false;
  scene.add(wireMesh);

  leftEar = createEarMesh(-1);
  rightEar = createEarMesh(1);
  scene.add(leftEar, rightEar);

  neckMesh = createNeckMesh();
  scene.add(neckMesh);

  resetLandmarks();
  setupUI();
  updateHeadGeometry();
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

init().catch(err => {
  console.error(err);
  viewer.innerHTML = `<pre style="color:white;padding:20px;white-space:pre-wrap">${err.stack || err}</pre>`;
});
