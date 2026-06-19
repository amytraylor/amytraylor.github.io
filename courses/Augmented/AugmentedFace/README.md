# Face Futures Lab — aligned 2D template to 3D head demo

This is a static browser demo for GitHub Pages.

It demonstrates the intended project architecture:

1. `full_head_with_ears.glb` — not included yet. This prototype uses a procedural full head with ears so the demo runs immediately.
2. `src/texture_canvas.js` — loads the provided 2D face templates, lets students click/fill regions, and turns the canvas into a live Three.js texture.
3. `src/projection_shader_or_uv_mapper.js` — aligns the 2D template to 3D face geometry using feature landmarks, not a generic image wrap.

## Run locally

Because this uses JavaScript modules, run it from a small local web server rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy on GitHub Pages

Upload this folder to a GitHub repository, then enable GitHub Pages for the branch/folder that contains `index.html`.

## Where the actual `full_head_with_ears.glb` goes

Put it here:

```text
assets/models/full_head_with_ears.glb
```

The current procedural mesh should later be replaced by a GLB loader in `src/main.js`. The UV mapper can still be used if the mesh has a normal face-forward coordinate system:

- x = left/right
- y = up/down
- z = front/back
- front = positive z

## Mapping notes

The important method is:

```js
ProjectionUVMapper.frontProject(semanticX, semanticY)
```

It maps mesh coordinates to the template through calibrated facial landmarks: crown, brow, eyes, nose, mouth, chin, cheeks, side zones, and ear zones.

Cylinder wrapping is used only for the side and back of the head. The seam is forced to the back by:

```js
const theta = Math.atan2(x, z);
const u = 0.5 + theta / (2 * Math.PI);
```

With `front = +z`, this makes the front of the face land at `u = 0.5` and the seam land at the back of the head.
