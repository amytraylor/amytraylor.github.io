FLOATING SKIN — HEADS-ONLY MULTI-HEAD BASELINE

This is the corrected flat-root build based on the last working multi-head app before any experimental lighting or normal changes.

Included head selector choices:
- Base classroom head
- Bald head 3
- Bald head 13
- Bald head 38
- Brunette head
- MPFB head

This build includes:
- visible head selector in State 1
- Z compression default 0.90 inside Advanced Head Depth
- brush/stamp tools hidden until State 2
- original pre-lighting renderer and original geometry normal calculation
- no capture.html page

Console build marker:
Floating Skin feature-aligned topography mapping 2026-06-21e

For the p5 Web Editor, all files in the full ZIP belong at the sketch root. Do not upload the folder-wrapper ZIP into an existing sketch, because the old root index.html may continue to run.

MediaPipe model handling
------------------------
The 468-point MediaPipe face is stored separately as mediapipe_face_mesh.json.
It is not substituted for the procedural full-head asset. It loads with manual
procedural morphing and depth compression disabled, preserving its actual shape.

2026-06-21d non-MediaPipe shading update
- MediaPipe face mesh keeps the prior lighting, material, and geometry.computeVertexNormals() path unchanged.
- Procedural full head and all imported student heads use area-weighted normals averaged across coincident seam vertices.
- Face-normal contributions are oriented outward for shading without changing triangle order or deleting geometry.
- Non-MediaPipe heads use softer key/fill/rim lighting and an opaque, rough surface material to reduce patchy transparent overlap.


2026-06-21e feature-aligned topography update
- Replaced whole-UV-bounds transfer for the procedural and imported student heads.
- Each calibrated head now stores 20 semantic front-view anchors for the face outline, eye corners, nose bridge/tip/nostrils, mouth corners/lip outline, and chin.
- sketch.js fits a thin-plate-spline warp from those anchors into the canonical MediaPipe design map.
- Front-facing facial triangles use the landmark warp; side, ear, neck, scalp-side, and rear triangles use cylindrical fallback.
- SVG region classification is recalculated from the landmark projection instead of trusting the earlier incorrect triangleRegionNames.
- MediaPipe keeps its existing native UV, material, lighting, and normal path unchanged.

Console build marker:
Floating Skin feature-aligned topography mapping 2026-06-21e
