// ============================================================================
// STAGE 3 -- RENDER. Four layers, any combination, all driven by the Stage-2
// region weights over the chosen mesh:
//   mesh         : the face surface itself (textured/shaded)
//   displacement : region triangles subdivided + pushed along normals
//   pointcloud   : a UV grid sampled to the surface, primitives where bright
//   studs        : one primitive per triangle, welded to topology
//
// Every layer uses the same field:  strength x brightness(u,v) x regionWeight.
// Geometries are built on entry / weight-change and cached; draw() just issues
// one model() per enabled layer. Shares globals with app.js (chosenMesh, mstate,
// FD, byId).
// ============================================================================

const S3 = {
  patterns: {}, // 5 raster source patterns (p5.Graphics)
  blends: {}, // regionName -> { img, total, strength, bbox }
  composite: null, // face texture: base skin + region decals
  geom: { mesh: null },
  built: false,
};

const S3_IMPORT_K = 30,
  S3_IMPORT_CAP = 55,
  S3_TEX = 1024,
  S3_PAT = 256;

// ---------------- entry ----------------

// implode <-> extrude, driven by the slider. finalize=false during drag
// (only the cheap displacement re-bakes live); cloud/studs re-bake on release.

// ---------------- weights -> per-region blended brightness ----------------
function computeBlends() {
  S3.blends = {};
  for (const region of FD.GROUPS) {
    const w = mstate.weights[region];
    if (!w) {
      continue;
    }
    let total = 0;
    for (const k of S3SRC()) {
      total += w[k] || 0;
    }
    if (total <= 0) {
      continue;
    }
    S3.blends[region] = {
      img: blendS3(w, total),
      total,
      strength: Math.min(total * S3_IMPORT_K, S3_IMPORT_CAP),
      bbox: regionBBox(region),
    };
  }
}

// dynamic source list: the built-in patterns + any uploaded image textures
function S3SRC() {
  return typeof TEXTURES !== "undefined"
    ? TEXTURES.map((t) => t.id)
    : ["water", "circuit", "bio", "star", "strata"];
}

function blendS3(weights, total) {
  for (const k of S3SRC()) {
    const im = S3.patterns[k];
    if (!im._px) {
      im.loadPixels();
      im._px = 1;
    }
  }
  const out = createImage(S3_PAT, S3_PAT);
  out.loadPixels();
  const n = S3_PAT * S3_PAT;
  for (let i = 0; i < n; i++) {
    let r = 0,
      g = 0,
      b = 0;
    const idx = i * 4;
    for (const k of S3SRC()) {
      const wv = (weights[k] || 0) / total;
      if (wv === 0) {
        continue;
      }
      const p = S3.patterns[k].pixels;
      r += p[idx] * wv;
      g += p[idx + 1] * wv;
      b += p[idx + 2] * wv;
    }
    out.pixels[idx] = r;
    out.pixels[idx + 1] = g;
    out.pixels[idx + 2] = b;
    out.pixels[idx + 3] = 255;
  }
  out.updatePixels();
  out._px = 0;
  return out;
}

function regionBBox(region) {
  const gi = FD.GROUPS.indexOf(region);
  let u0 = 1,
    v0 = 1,
    u1 = 0,
    v1 = 0,
    any = false;
  FD.TRIS.forEach((t, ti) => {
    if (FD.TRI_GROUP[ti] !== gi) {
      return;
    }
    for (const i of t) {
      const uv = chosenMesh.uvs[i];
      u0 = min(u0, uv[0]);
      u1 = max(u1, uv[0]);
      v0 = min(v0, uv[1]);
      v1 = max(v1, uv[1]);
      any = true;
    }
  });
  return any ? { u0, v0, w: max(u1 - u0, 1e-4), h: max(v1 - v0, 1e-4) } : null;
}

// brightness at a UV point that is known to belong to `region`
function brightAt(region, u, v) {
  const bl = S3.blends[region];
  if (!bl || !bl.bbox) {
    return 0;
  }
  const lu = (u - bl.bbox.u0) / bl.bbox.w,
    lv = (v - bl.bbox.v0) / bl.bbox.h;
  const img = bl.img;
  if (!img._px) {
    img.loadPixels();
    img._px = 1;
  }
  const x = constrain(floor(lu * img.width), 0, img.width - 1);
  const y = constrain(floor(lv * img.height), 0, img.height - 1);
  const i = (y * img.width + x) * 4;
  return (img.pixels[i] + img.pixels[i + 1] + img.pixels[i + 2]) / 765;
}

// ---------------- layer: base mesh ----------------
// the eye sockets are cut OUT (open holes): skip the eye-interior fill triangles so
// the eyes don't read as solid skin.
const EYE_HOLE_GROUPS = new Set(
  ["leftEyeInterior", "rightEyeInterior"].map((n) => FD.GROUPS.indexOf(n)),
);
function buildMeshGeom() {
  const g = buildGeometry(() => {
    beginShape(TRIANGLES);
    FD.TRIS.forEach((t, ti) => {
      if (EYE_HOLE_GROUPS.has(FD.TRI_GROUP[ti])) return;
      for (const i of t) {
        const v = chosenMesh.verts[i],
          uv = chosenMesh.uvs[i];
        vertex(v[0], v[1], v[2], uv[0], uv[1]);
      }
    });
    endShape();
  });
  g.computeNormals();
  return g;
}

// ---------------- layer: surface displacement ----------------

// THE EXTRUSION: every vertex sits on the base shell (face + base lift), and the
// design rises/sinks from there by morph. morph>0 extrude, <0 implode, 0 = the
// flat base shell. The base ground layer stays at the face the whole time.
// Built as an INDEXED p5.Geometry (vertices + faces), NOT immediate-mode
// beginShape/vertex -- immediate mode generates per-triangle edge geometry that
// overflows the call stack on this subdivided mesh ("Maximum call stack size").

// The base ground layer: the bare face surface, built once and never morphed,
// rendered in the solid filament color. The design extrusion rises/sinks above
// it, so there is always an intact base close to the face.

// Representative "filament" color of the composite: the mode (most common)
// color, quantized into coarse bins. Also reports the brightest and darkest
// pixels for reference. Stored in S3.baseColor and used for the ground shell.

// interior 1, boundary 0 (hard pin keeps subdivided regions crack-free)

// ---------------- layer: point cloud (UV grid -> surface) ----------------

// ---------------- layer: centroid studs ----------------

// ---------------- composite face texture (base skin + region decals) ----------------
function buildComposite() {
  if (!S3.composite) {
    S3.composite = createGraphics(S3_TEX, S3_TEX);
    S3.composite.pixelDensity(1);
  }
  const cg = S3.composite;
  cg.clear();
  if (chosenMesh.texture) {
    cg.image(chosenMesh.texture, 0, 0, S3_TEX, S3_TEX);
  } else {
    proceduralSkinInto(cg);
  }
  for (const region in S3.blends) {
    const bb = S3.blends[region].bbox;
    if (!bb) {
      continue;
    }
    const tmp = createGraphics(S3_TEX, S3_TEX);
    tmp.pixelDensity(1);
    tmp.image(
      S3.blends[region].img,
      bb.u0 * S3_TEX,
      bb.v0 * S3_TEX,
      bb.w * S3_TEX,
      bb.h * S3_TEX,
    );
    const decal = tmp.get();
    decal.mask(regionMask(region));
    cg.tint(255, 0.8 * 255);
    cg.image(decal, 0, 0);
    cg.noTint();
    tmp.remove();
  }
  cg.loadPixels();
  S3._compReady = true;
}

function sampleComposite(u, v) {
  if (!S3._compReady) {
    S3.composite.loadPixels();
    S3._compReady = true;
  }
  const x = constrain(floor(u * S3_TEX), 0, S3_TEX - 1),
    y = constrain(floor(v * S3_TEX), 0, S3_TEX - 1);
  const i = (y * S3_TEX + x) * 4,
    p = S3.composite.pixels;
  return [p[i], p[i + 1], p[i + 2]];
}

const S3_maskCache = {};
function regionMask(region) {
  if (S3_maskCache[region]) {
    return S3_maskCache[region];
  }
  const gi = FD.GROUPS.indexOf(region);
  const mg = createGraphics(S3_TEX, S3_TEX);
  mg.pixelDensity(1);
  mg.clear();
  mg.noStroke();
  mg.fill(255);
  FD.TRIS.forEach((t, ti) => {
    if (FD.TRI_GROUP[ti] !== gi) {
      return;
    }
    mg.triangle(
      chosenMesh.uvs[t[0]][0] * S3_TEX,
      chosenMesh.uvs[t[0]][1] * S3_TEX,
      chosenMesh.uvs[t[1]][0] * S3_TEX,
      chosenMesh.uvs[t[1]][1] * S3_TEX,
      chosenMesh.uvs[t[2]][0] * S3_TEX,
      chosenMesh.uvs[t[2]][1] * S3_TEX,
    );
  });
  S3_maskCache[region] = mg.get();
  mg.remove();
  return S3_maskCache[region];
}

function proceduralSkinInto(s) {
  s.noStroke();
  s.background(214, 178, 148);
  for (let r = S3_TEX; r > 0; r -= 40) {
    s.fill(214 + (S3_TEX - r) * 0.012, 178, 148, 14);
    s.ellipse(S3_TEX / 2, S3_TEX / 2, r, r * 1.15);
  }
  const tone = (region, c) => {
    const gi = FD.GROUPS.indexOf(region);
    s.fill(c);
    FD.TRIS.forEach((t, ti) => {
      if (FD.TRI_GROUP[ti] !== gi) {
        return;
      }
      s.triangle(
        chosenMesh.uvs[t[0]][0] * S3_TEX,
        chosenMesh.uvs[t[0]][1] * S3_TEX,
        chosenMesh.uvs[t[1]][0] * S3_TEX,
        chosenMesh.uvs[t[1]][1] * S3_TEX,
        chosenMesh.uvs[t[2]][0] * S3_TEX,
        chosenMesh.uvs[t[2]][1] * S3_TEX,
      );
    });
  };
  tone("lips", s.color(176, 110, 104));
  tone("leftEyebrow", s.color(92, 66, 50));
  tone("rightEyebrow", s.color(92, 66, 50));
  tone("leftEyeInterior", s.color(238));
  tone("rightEyeInterior", s.color(238));
}

// ---------------- patterns + normals (shared) ----------------
function buildS3Patterns() {
  for (const k of S3SRC()) {
    S3.patterns[k] = makeS3Pattern(k);
  }
}
function makeS3Pattern(name) {
  const g = createGraphics(S3_PAT, S3_PAT);
  g.pixelDensity(1);
  g.noStroke();
  const tx = typeof TEXTURES !== "undefined" ? TEXTURES.find((t) => t.id === name) : null;
  const blurPx = tx && tx.blur ? tx.blur * 0.5 : 0;
  if (tx && tx.isImage) {
    if (tx.p5img) g.image(tx.p5img, 0, 0, S3_PAT, S3_PAT);
    else g.background(140);
    if (blurPx > 0) g.filter(BLUR, blurPx);
    return g;
  }
  randomSeed(7);
  noiseSeed(7);
  const S = S3_PAT;
  if (name === "water") {
    g.background(18, 40, 60);
    g.noFill();
    for (let r = 8; r < S; r += 22) {
      g.stroke(120, 220, 255, map(r, 0, S, 230, 40));
      g.strokeWeight(map(r, 0, S, 6, 2));
      g.ellipse(S / 2, S * 0.55, r * 2, r * 2);
    }
  } else if (name === "circuit") {
    g.background(35, 26, 65);
    g.stroke(201, 168, 255);
    g.strokeWeight(5);
    g.strokeCap(ROUND);
    for (let i = 0; i < 26; i++) {
      const x = random(S),
        y = random(S),
        L = random(30, 95),
        h = random() < 0.5;
      g.line(x, y, h ? x + L : x, h ? y : y + L);
      g.noStroke();
      g.fill(255, 247, 255);
      g.ellipse(x, y, 11, 11);
      g.noFill();
      g.stroke(201, 168, 255);
    }
  } else if (name === "bio") {
    g.background(30, 45, 32);
    g.noFill();
    for (let row = 0; row < 6; row++) {
      g.stroke(142, 234, 123, 200);
      g.strokeWeight(6);
      g.beginShape();
      for (let x = -10; x <= S + 10; x += 8) {
        g.vertex(x, (row * S) / 6 + 20 + 16 * sin(x * 0.09 + row));
      }
      g.endShape();
    }
  } else if (name === "star") {
    g.background(8, 17, 38);
    for (let i = 0; i < 70; i++) {
      const x = random(S),
        y = random(S),
        r = random(1, 4.5);
      g.fill(255, random(180, 255));
      g.ellipse(x, y, r, r);
    }
    g.fill(216, 238, 255);
    g.push();
    g.translate(S / 2, S / 2);
    g.beginShape();
    for (const [dx, dy] of [
      [0, -22],
      [5, -5],
      [22, 0],
      [5, 5],
      [0, 22],
      [-5, 5],
      [-22, 0],
      [-5, -5],
    ]) {
      g.vertex(dx, dy);
    }
    g.endShape(CLOSE);
    g.pop();
  } else if (name === "strata") {
    g.background(58, 39, 32);
    const cols = [
      [255, 209, 138],
      [255, 158, 126],
      [255, 240, 186],
    ];
    for (let b = 0; b < 3; b++) {
      g.stroke(...cols[b], 200);
      g.strokeWeight(5);
      g.noFill();
      g.beginShape();
      for (let x = -10; x <= S + 10; x += 10) {
        g.vertex(x, ((b + 0.5) * S) / 3 + 14 * sin(x * 0.05 + b * 1.7));
      }
      g.endShape();
    }
  }
  if (blurPx > 0) g.filter(BLUR, blurPx);
  return g;
}

// ---------------- export ----------------

// ---------------- entry / draw (textured mesh only) ----------------
function enterStage3() {
  buildS3Patterns(); // rebuild every entry so new uploads + blur are included
  computeBlends(); // from mstate.weights
  buildComposite();
  if (S3.geom.mesh) {
    freeGeometry(S3.geom.mesh);
  }
  S3.geom.mesh = buildMeshGeom();
  S3.built = true;
  console.log("render: mesh built | weighted regions =", Object.keys(S3.blends).length);
}

function drawStage3() {
  background(13, 16, 24);
  orbitControl(2, 2, 0.1);
  if (typeof applyMiddleDragZoom === "function") {
    applyMiddleDragZoom();
  }
  if (typeof viewZoom !== "undefined") {
    scale(viewZoom);
  }
  ambientLight(185, 185, 195);
  directionalLight(255, 246, 235, -0.4, -0.5, -0.75);
  directionalLight(150, 170, 205, 0.6, 0.2, 0.4);
  directionalLight(160, 160, 170, 0, 0.7, 0.2);
  pointLight(255, 245, 230, 0, -220, 420);
  noStroke();
  if (S3.geom.mesh) {
    texture(S3.composite);
    model(S3.geom.mesh);
  }
}

// ---------------- export: textured base mesh OBJ + texture + canvas PNG ----------------
function exportStage3() {
  const stamp = Date.now(),
    base = "futureface_" + stamp;
  saveCanvas(base + "_view", "png");
  const w = createWriter(base + ".obj");
  w.print("# Future Face textured mesh");
  w.print("mtllib " + base + ".mtl");
  w.print("usemtl skin");
  for (const v of chosenMesh.verts) {
    w.print("v " + v[0].toFixed(3) + " " + (-v[1]).toFixed(3) + " " + v[2].toFixed(3));
  }
  for (const uv of chosenMesh.uvs) {
    w.print("vt " + uv[0].toFixed(5) + " " + (1 - uv[1]).toFixed(5));
  }
  let cur = -1;
  const order = FD.TRIS.map((t, i) => i).sort(
    (a, b) => FD.TRI_GROUP[a] - FD.TRI_GROUP[b],
  );
  for (const i of order) {
    if (FD.TRI_GROUP[i] !== cur) {
      cur = FD.TRI_GROUP[i];
      w.print("o " + FD.GROUPS[cur]);
      w.print("g " + FD.GROUPS[cur]);
    }
    const [a, b, c] = FD.TRIS[i];
    w.print(
      "f " +
        (a + 1) +
        "/" +
        (a + 1) +
        " " +
        (b + 1) +
        "/" +
        (b + 1) +
        " " +
        (c + 1) +
        "/" +
        (c + 1),
    );
  }
  w.close();
  const mtl = createWriter(base + ".mtl");
  mtl.print("newmtl skin");
  mtl.print("map_Kd " + base + "_texture.png");
  mtl.close();
  S3.composite.get().save(base + "_texture", "png");
}
