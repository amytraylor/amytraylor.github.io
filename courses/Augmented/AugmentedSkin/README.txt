Floating Skin Workshop v1

Files
-----
Main designer:
- index.html
- sketch.js
- project_state.js
- export_tools.js
- preset_face_mesh.json

Live capture:
- capture.html
- capture_sketch.js

Education pages:
- learn_machine_learning.html
- history_opencv_faces.html

New features in this build
--------------------------
1. Boundary softening / blur
   - visible design canvas is the raw design
   - softened preview is generated from the raw design
   - exports can save raw-before-blur and after-blur XYZ point CSVs

2. Standard view export
   - front
   - left profile
   - right profile
   - three-quarter left
   - three-quarter right
   - top

3. Project-state export
   - settings
   - mesh counts
   - displacement values
   - blur values
   - texture labels
   - stamp history
   - design images

4. Full ZIP export
   - project_manifest.json
   - design_raw.png
   - design_softened.png
   - points_raw_before_blur.csv
   - points_after_blur.csv
   - standard view PNGs
   - texture images when possible

Notes
-----
The XYZ export is chunked over animation frames so it should not trigger long-loop protection.
The live capture page is a first-pass capture utility and may need minor ml5 option adjustments depending on the p5/ml5 editor version.


FSUtils error fix
-----------------
If you see:

  FSUtils is not defined

check that index.html loads:

  <script src="./project_state.js"></script>
  <script src="./sketch.js"></script>
  <script src="./export_tools.js"></script>

This fixed package also puts a fallback copy of FSUtils inside export_tools.js,
so export_tools.js will still work if project_state.js is missing or misordered.


High-density rendering update
-----------------------------
This build can push much higher point counts, including 360,000+ rendered
points on stronger computers.

What changed:
- Max Floating Points slider now goes up to 500,000.
- Point building uses Float32Array buffers instead of normal JS arrays.
- The active design canvas is read once per rebuild instead of once per point.
- If the visible UV grid has fewer samples than the requested max, cells are
  supersampled with deterministic subpixel samples.
- A processing/progress overlay appears while the dense point cloud is building.
- Export Rendered Points XYZ saves the exact point cloud currently visible in
  the scene.

Performance:
- CPU controls rebuild time.
- GPU controls orbit/render smoothness after the point cloud is built.
- THREE.Points can handle far more points than individual sphere meshes.


Surface-area exact sampler update
---------------------------------
This build changes the dense point renderer from UV-grid sampling to 3D
surface-area sampling.

Why:
- UV-grid sampling preserved texture scale but could make point density higher
  where many small triangles occupied the texture.
- Surface-area sampling allocates points proportional to each triangle's actual
  3D area, so density is more even across the model surface.

Point count:
- If Max Floating Points is 500,000, the rendered point cloud contains exactly
  500,000 points.
- Export Rendered Points XYZ writes every currently rendered point.
- Raw/Softened XYZ exports now use the same exact surface-area sample count.

CSV newline fix:
- CSV files now use real newlines, not literal \n text, so rows open correctly
  in spreadsheets and text editors.


Fitted-design exact sampler update
----------------------------------
This build changes the point generator again:

- The full 1000x1000 design image is fitted to the face UV bounds by default.
  This fixes the problem where only a small portion of the source image appeared
  on the face.
- Points are chosen from a low-discrepancy sequence over the whole fitted design
  image, then projected through the UV triangles.
- Stretched boundary/back triangles are filtered from point sampling by default.
  The wireframe can still show them, but the generated point cloud should not
  form long stretched sheets behind the head.
- The rendered point count is exact unless too many samples are rejected. If
  that happens, disable "Hide stretched boundary triangles" or reduce the count.
- CSV exports use real newlines and the raw/softened exports use the same fitted
  design sampling logic as the renderer.


Surface exact + front-projection texture update
-----------------------------------------------
This build changes the default texture lookup:

- Points are still allocated by 3D triangle surface area.
- The design image is now sampled by front X/Y projection by default.
  This makes the full 1000x1000 design pattern appear over the face instead of
  only the part covered by the MediaPipe UV island.
- UV mapping is still available by unchecking "Map design by front X/Y projection."
- The stretched-boundary filter now removes only the most extreme 1% of long
  triangles, so more side/back support remains.
- Raw/softened XYZ export is processed in animation-frame chunks to avoid the
  p5.js editor's infinite-loop detector during Export Full ZIP.


Cylindrical repaired package
----------------------------
This package was rebuilt from the complete front-projection surface package, so
all designer functions are preserved. It adds:

- cylindrical texture wrap as the default mapping mode
- worker-based rendered point CSV export
- project ZIP export that uses the already-rendered point cloud instead of
  recomputing raw/softened point clouds inside the p5.js editor
