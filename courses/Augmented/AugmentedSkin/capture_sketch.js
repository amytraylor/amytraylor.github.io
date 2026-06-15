let video;
let faceMesh;
let faces = [];
let triangles = [];
let uvCoords = [];
let frozenFace = null;
let statusText = "Loading model...";

function setup() {
  const canvas = createCanvas(720, 540);
  canvas.parent("sketch-holder");

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  const freezeBtn = createButton("Freeze Current Face");
  freezeBtn.parent("sketch-holder");
  freezeBtn.mousePressed(freezeCurrentFace);

  const exportBtn = createButton("Export Captured Mesh JSON");
  exportBtn.parent("sketch-holder");
  exportBtn.mousePressed(exportCapturedMesh);

  try {
    faceMesh = ml5.faceMesh(
      { maxFaces: 1, refineLandmarks: true, flipped: true },
      () => {
        statusText = "Model ready. Look at the camera.";
      }
    );
    faceMesh.detectStart(video, gotFaces);

    if (faceMesh.getTriangles) triangles = faceMesh.getTriangles();
    if (faceMesh.getUVCoords) uvCoords = faceMesh.getUVCoords();
  } catch (e) {
    statusText = "FaceMesh setup failed: " + e.message;
    console.error(e);
  }
}

function gotFaces(results) {
  faces = results || [];
}

function draw() {
  background(20);
  image(video, 0, 0, 640, 480);

  const face = frozenFace || faces[0];

  if (face && face.keypoints) {
    noFill();
    stroke(0, 255, 255);
    strokeWeight(2);
    for (const kp of face.keypoints) circle(kp.x, kp.y, 3);
  }

  fill(255);
  noStroke();
  textSize(14);
  text(statusText, 10, 505);
  text(frozenFace ? "Frozen face ready for export." : "Live preview.", 10, 525);
}

function freezeCurrentFace() {
  if (!faces[0] || !faces[0].keypoints) {
    statusText = "No face found yet.";
    return;
  }
  frozenFace = JSON.parse(JSON.stringify(faces[0]));
  statusText = "Face frozen.";
}

function exportCapturedMesh() {
  const face = frozenFace || faces[0];
  if (!face || !face.keypoints) {
    statusText = "No face to export.";
    return;
  }

  if (!triangles || triangles.length === 0) {
    if (faceMesh && faceMesh.getTriangles) triangles = faceMesh.getTriangles();
  }
  if (!uvCoords || uvCoords.length === 0) {
    if (faceMesh && faceMesh.getUVCoords) uvCoords = faceMesh.getUVCoords();
  }

  const pts = face.keypoints.slice(0, 468);
  let cx = 0, cy = 0, cz = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
    cz += p.z || 0;
  }
  cx /= pts.length;
  cy /= pts.length;
  cz /= pts.length;

  const positions = pts.map((p) => [
    p.x - cx,
    -(p.y - cy),
    (p.z || 0) - cz
  ]);

  const fallbackUVs = pts.map((p) => [
    constrain(p.x / video.width, 0, 1),
    constrain(p.y / video.height, 0, 1)
  ]);

  const out = {
    source: "ml5-live-capture",
    createdAt: new Date().toISOString(),
    vertex_count: positions.length,
    triangle_count: triangles.length,
    positions,
    uvs: uvCoords && uvCoords.length >= positions.length ? uvCoords.slice(0, positions.length) : fallbackUVs,
    triangles
  };

  saveJSON(out, "captured_face_mesh.json");
  statusText = "Exported captured_face_mesh.json.";
}
