import * as THREE from 'https://unpkg.com/three@0.160.1/build/three.module.js';

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
function wrap01(u) { return u - Math.floor(u); }

function piecewiseLinear(x, stops) {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0 || 1);
      return lerp(y0, y1, t);
    }
  }
  return stops[stops.length - 1][1];
}

// These are deliberately kept as editable calibration tables.  The numbers are
// normalized image coordinates measured from the provided paper templates.
// v=0 is top of the image; u=0 is left of the image.
export const TEMPLATE_CALIBRATIONS = {
  templateA: {
    id: 'templateA',
    name: 'Template A',
    imagePath: './assets/templates/template-a.jpg',
    centerU: 0.500,
    // Map semantic mesh height yNorm [-1 chin/neck, +1 crown] to template image v.
    yToV: [
      [-1.00, 0.900], // neck tabs / bottom of template
      [-0.82, 0.785], // chin
      [-0.48, 0.665], // mouth line
      [-0.12, 0.555], // nostril / nose tip
      [ 0.18, 0.440], // mid nose / lower eyes
      [ 0.36, 0.385], // eye centers
      [ 0.52, 0.315], // brow
      [ 0.78, 0.185], // forehead
      [ 1.00, 0.060]  // crown / top hair area
    ],
    // Half-width of the *front template* at each v.
    // A vertex with xRel=-1 maps to centerU-halfU; xRel=+1 maps to centerU+halfU.
    faceHalfUByV: [
      [0.060, 0.300],
      [0.180, 0.330],
      [0.315, 0.300],
      [0.385, 0.265],
      [0.555, 0.245],
      [0.665, 0.265],
      [0.785, 0.310],
      [0.900, 0.420]
    ],
    // Approximate landmark positions for the overlay dots on the template canvas.
    landmarks: {
      crown: [0.500, 0.060], browL: [0.385, 0.315], browR: [0.615, 0.315],
      eyeL: [0.365, 0.385], eyeR: [0.635, 0.385], nose: [0.500, 0.555],
      mouth: [0.500, 0.665], chin: [0.500, 0.785], leftSide: [0.170, 0.520], rightSide: [0.830, 0.520]
    }
  },
  templateB: {
    id: 'templateB',
    name: 'Template B',
    imagePath: './assets/templates/template-b.jpg',
    centerU: 0.500,
    yToV: [
      [-1.00, 0.920],
      [-0.82, 0.825],
      [-0.48, 0.645],
      [-0.12, 0.525],
      [ 0.18, 0.420],
      [ 0.36, 0.315],
      [ 0.52, 0.275],
      [ 0.78, 0.145],
      [ 1.00, 0.050]
    ],
    faceHalfUByV: [
      [0.050, 0.270],
      [0.145, 0.320],
      [0.315, 0.255],
      [0.525, 0.230],
      [0.645, 0.255],
      [0.825, 0.305],
      [0.920, 0.400]
    ],
    landmarks: {
      crown: [0.500, 0.050], browL: [0.365, 0.275], browR: [0.635, 0.275],
      eyeL: [0.360, 0.315], eyeR: [0.640, 0.315], nose: [0.500, 0.525],
      mouth: [0.500, 0.645], chin: [0.500, 0.825], leftSide: [0.165, 0.525], rightSide: [0.835, 0.525]
    }
  }
};

export class ProjectionUVMapper {
  constructor(calibration) {
    this.calibration = calibration;
    this.frontAngle = Math.PI * 0.63; // wider than a strict front view; helps cheek artwork stay on the face.
  }

  setCalibration(calibration) {
    this.calibration = calibration;
  }

  semanticYToV(yNorm) {
    return piecewiseLinear(clamp(yNorm, -1, 1), this.calibration.yToV);
  }

  faceHalfWidthAtV(v) {
    return piecewiseLinear(clamp(v, 0, 1), this.calibration.faceHalfUByV);
  }

  // Feature-aware front projection.  This is the important part: the vertical
  // placement is not a generic min/max bbox.  It is landmark-calibrated so eyes,
  // nose, mouth, chin, forehead, and cheek areas land on the corresponding parts
  // of the template.
  frontProject(semanticX, semanticY) {
    const v = this.semanticYToV(semanticY);
    const halfU = this.faceHalfWidthAtV(v);
    const u = this.calibration.centerU + clamp(semanticX, -1, 1) * halfU;
    return new THREE.Vector2(clamp(u, 0.001, 0.999), clamp(v, 0.001, 0.999));
  }

  // Cylinder projection with seam at the back.  Model convention here:
  // x = left/right, y = up/down, z = front/back, front is +z.
  cylinderProject(x, yNorm, z) {
    const theta = Math.atan2(x, z);          // front center => 0
    const u = wrap01(0.5 + theta / (2 * Math.PI)); // back center => 0/1 seam
    const v = this.semanticYToV(yNorm);
    return new THREE.Vector2(u, clamp(v, 0.001, 0.999));
  }

  // Computes a semantic x coordinate in [-1, 1] from a head vertex.  The head
  // width changes with height, so this normalizes x against the local front width.
  semanticXFromPosition(x, yNorm) {
    const r = Math.sqrt(Math.max(0.001, 1 - yNorm * yNorm));
    const localHalfWidth = 0.38 + 0.70 * r; // matches procedural head generator
    return clamp(x / localHalfWidth, -1.25, 1.25);
  }

  isFrontFaceVertex(x, z) {
    // angle 0 is front.  Values near pi/-pi are the back seam.
    const theta = Math.atan2(x, z);
    return Math.abs(theta) < this.frontAngle;
  }

  projectVertex(x, yNorm, z) {
    if (this.isFrontFaceVertex(x, z)) {
      const semanticX = this.semanticXFromPosition(x, yNorm);
      return this.frontProject(semanticX, yNorm);
    }
    return this.cylinderProject(x, yNorm, z);
  }

  applyToGeometry(geometry) {
    const pos = geometry.getAttribute('position');
    const meta = geometry.userData.semantic || [];
    const uv = new Float32Array(pos.count * 2);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const yNorm = meta[i]?.yNorm ?? clamp(y / 1.35, -1, 1);
      const p = this.projectVertex(x, yNorm, z);
      uv[2 * i + 0] = p.x;
      uv[2 * i + 1] = p.y;
    }

    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.attributes.uv.needsUpdate = true;
  }

  // For ear meshes, sample from the side regions of the template instead of the
  // central face region.  side = -1 is left ear, +1 is right ear.
  applyEarUVs(geometry, side = 1) {
    const pos = geometry.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    const sideCenterU = side < 0 ? 0.155 : 0.845;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const u = sideCenterU + clamp(z / 0.55, -1, 1) * 0.075;
      const yNorm = clamp(y / 0.75, -1, 1);
      const v = this.semanticYToV(yNorm * 0.80);
      uv[2 * i + 0] = clamp(u, 0.001, 0.999);
      uv[2 * i + 1] = clamp(v, 0.001, 0.999);
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.attributes.uv.needsUpdate = true;
  }
}

// Export helpers for possible use in a shader version later.
export const UVMath = { clamp, lerp, smoothstep, piecewiseLinear, wrap01 };
