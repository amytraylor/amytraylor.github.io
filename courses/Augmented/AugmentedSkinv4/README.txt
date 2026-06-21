Floating Skin / Future Face — texture UI cleanup, advanced-at-bottom build

Student-facing defaults:
- Top build notes and Workshop Pages links moved into Advanced controls.
- Advanced controls are collapsed by default and placed at the very bottom of the control panel.
- UV Floating Points exposes only Min Displacement and Max Displacement by default.
- Advanced controls contain visibility/mapping, nonplanar limits, feature protection, point size, max point count, triangle glyph settings, brush/stamp settings, device layout, and technical notes.
- Point Size default: 1.5.
- Max Floating Points default: 180,000.
- Default visibility/mapping: all checked except Show triangle-center glyphs and Hide stretched boundary triangles.
- Export section shows only Export View Images and Export Project ZIP.
- Export View Images downloads individual PNG files; view images are not added to the Project ZIP.
- Stats are hidden.

Region texture fix:
- When a texture/pattern is assigned to SVG face regions, the source image is now fitted separately to each selected region's mask bounds.
- Paired regions such as left cheek and right cheek no longer receive uneven left/right slices of one global wallpaper image.
- Full-face application still fills the whole design canvas once.

Replace changed files in your existing sketch:
- sketch.js
- README.txt

Keep the existing index.html and export_tools.js if you already uploaded the advanced-at-bottom/export-reference-fix build.


Update: Uploaded images are now normalized into a single 1000 x 1000 canvas source on load. They are fitted with cover behavior and will not tile when applied to the full face or SVG-selected regions.


2026-06-20 SVG picker / upload no-tile confirmation:
- face_svg_static.js was regenerated from the uploaded p5 SVG picker index.html.
- Uploaded images are normalized into full-design canvas sources and applied with cover behavior.
- Uploaded images are not drawn as repeating SVG/canvas patterns.

Update: manual face/head sliders are now inside Advanced controls as their own collapsed section.
Default print-safe nonplanar limiting is off; instructors can re-enable it in Advanced UV Floating Points.


Texture brush update:
- Advanced Brush / Stamp now includes a Round/Square brush shape selector.
- Texture brush strokes interpolate between pointer positions so marks are continuous instead of separated stamps.
- Brush updates are deferred until pointer release for smoother drawing.


Mesh choice prep update:
- Added five student-selectable head meshes: Bald head 3, Bald head 13, Bald head 38, Brunette head, and MPFB head.
- Each imported mesh was converted to a Future Face mesh JSON with UVs remapped into the MediaPipe face UV bounds used by the SVG picker/design canvas.
- Each mesh includes triangleRegionNames so SVG face-region assignments transfer to the imported topology without manual vertex correspondence.
- Imported heads keep their authored depth and do not use the manual classroom morph sliders by default.
- Base classroom head still supports the advanced manual face/head shape sliders.

- Student head choices default to direct UV mapping: cylindrical and front-projection sampling are turned off when a student_* head is selected so the MediaPipe/SVG UV mapping is used consistently.

Update: shape-depth and brush-stage cleanup
- Default base classroom head z compression is now 0.90.
- The z compression control moved into Advanced Head Depth at the bottom of the panel.
- Advanced Head Depth and Manual Face / Head Shape are only shown during State 1 when Advanced is opened.
- Advanced Brush / Stamp is hidden during State 1 and only appears in State 2, after students have moved from choosing/shaping a head to applying images/textures.
