import * as THREE from 'https://unpkg.com/three@0.160.1/build/three.module.js';
import { TEMPLATE_CALIBRATIONS } from './projection_shader_or_uv_mapper.js';

function buildPath(ctx, points, w, h) {
  ctx.beginPath();
  points.forEach(([u, v], i) => {
    const x = u * w;
    const y = v * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

export const REGION_DEFS = [
  { id: 'forehead', name: 'Forehead / crown', points: [[0.28,0.08],[0.72,0.08],[0.80,0.24],[0.64,0.31],[0.50,0.28],[0.36,0.31],[0.20,0.24]] },
  { id: 'leftEye', name: 'Left eye area', points: [[0.24,0.34],[0.42,0.31],[0.47,0.40],[0.40,0.47],[0.24,0.44]] },
  { id: 'rightEye', name: 'Right eye area', points: [[0.58,0.31],[0.76,0.34],[0.76,0.44],[0.60,0.47],[0.53,0.40]] },
  { id: 'nose', name: 'Nose ridge / nostrils', points: [[0.47,0.33],[0.53,0.33],[0.57,0.58],[0.53,0.66],[0.47,0.66],[0.43,0.58]] },
  { id: 'leftCheek', name: 'Left cheek', points: [[0.22,0.47],[0.43,0.45],[0.46,0.62],[0.39,0.75],[0.22,0.70],[0.13,0.58]] },
  { id: 'rightCheek', name: 'Right cheek', points: [[0.57,0.45],[0.78,0.47],[0.87,0.58],[0.78,0.70],[0.61,0.75],[0.54,0.62]] },
  { id: 'mouth', name: 'Mouth / lips', points: [[0.35,0.64],[0.65,0.64],[0.70,0.72],[0.62,0.78],[0.38,0.78],[0.30,0.72]] },
  { id: 'chin', name: 'Chin / lower face', points: [[0.34,0.78],[0.66,0.78],[0.78,0.91],[0.50,0.98],[0.22,0.91]] },
  { id: 'leftSide', name: 'Left side / ear zone', points: [[0.02,0.15],[0.24,0.24],[0.21,0.78],[0.05,0.88],[0.00,0.65]] },
  { id: 'rightSide', name: 'Right side / ear zone', points: [[0.76,0.24],[0.98,0.15],[1.00,0.65],[0.95,0.88],[0.79,0.78]] }
];

export class TextureCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    this.baseImage = new Image();
    this.baseImage.crossOrigin = 'anonymous';
    this.activeTemplateId = 'templateA';
    this.regionFills = new Map();
    this.selectedRegionId = 'nose';
    this.showLandmarks = true;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
  }

  get calibration() { return TEMPLATE_CALIBRATIONS[this.activeTemplateId]; }

  async loadTemplate(templateId) {
    this.activeTemplateId = templateId;
    const src = TEMPLATE_CALIBRATIONS[templateId].imagePath;
    await new Promise((resolve, reject) => {
      this.baseImage.onload = resolve;
      this.baseImage.onerror = reject;
      this.baseImage.src = src;
    });

    this.canvas.width = this.baseImage.naturalWidth;
    this.canvas.height = this.baseImage.naturalHeight;
    this.redraw();
  }

  reset() {
    this.regionFills.clear();
    this.redraw();
  }

  setSelectedRegion(regionId) {
    this.selectedRegionId = regionId;
    this.redraw();
  }

  fillRegion(regionId, color) {
    this.regionFills.set(regionId, color);
    this.redraw();
  }

  hitTest(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (clientY - rect.top) * (this.canvas.height / rect.height);
    for (const region of REGION_DEFS) {
      this.ctx.save();
      buildPath(this.ctx, region.points, this.canvas.width, this.canvas.height);
      const hit = this.ctx.isPointInPath(x, y);
      this.ctx.restore();
      if (hit) return region.id;
    }
    return null;
  }

  redraw() {
    const { width: w, height: h } = this.canvas;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(this.baseImage, 0, 0, w, h);

    // Optional region fills. These are intentionally transparent so the original
    // hand-drawn template remains visible under the region design.
    for (const region of REGION_DEFS) {
      const color = this.regionFills.get(region.id);
      if (!color) continue;
      this.ctx.save();
      buildPath(this.ctx, region.points, w, h);
      this.ctx.globalAlpha = 0.55;
      this.ctx.fillStyle = color;
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
      this.ctx.lineWidth = Math.max(2, w * 0.002);
      this.ctx.strokeStyle = color;
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Selected region outline.
    const selected = REGION_DEFS.find(r => r.id === this.selectedRegionId);
    if (selected) {
      this.ctx.save();
      buildPath(this.ctx, selected.points, w, h);
      this.ctx.setLineDash([10, 8]);
      this.ctx.lineWidth = Math.max(3, w * 0.003);
      this.ctx.strokeStyle = '#4f8cff';
      this.ctx.stroke();
      this.ctx.restore();
    }

    if (this.showLandmarks) this.drawLandmarks();

    this.texture.needsUpdate = true;
  }

  drawLandmarks() {
    const landmarks = this.calibration.landmarks;
    const { width: w, height: h } = this.canvas;
    this.ctx.save();
    this.ctx.font = `${Math.max(14, Math.round(w * 0.014))}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    for (const [name, [u, v]] of Object.entries(landmarks)) {
      const x = u * w;
      const y = v * h;
      this.ctx.beginPath();
      this.ctx.arc(x, y, Math.max(5, w * 0.004), 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(79, 140, 255, 0.92)';
      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = 'white';
      this.ctx.stroke();
      this.ctx.fillStyle = 'rgba(0,0,0,0.74)';
      this.ctx.fillText(name, x, y - Math.max(8, w * 0.006));
    }
    this.ctx.restore();
  }
}
