UV Floating Skin Three.js Fixed Files

Use these files together:
- index.html
- sketch.js
- preset_face_mesh.json

The browser error:
  TypeError: Failed to resolve module specifier "three"

is fixed by the import map in index.html:

  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"
      }
    }
  </script>

Then sketch.js can use:

  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";

Important:
Because sketch.js loads preset_face_mesh.json with fetch(), this must be served from
a local server or web editor. Opening index.html directly as file:// may fail.

For a local folder, run one of these commands in the folder:

  python -m http.server 8000

Then open:

  http://localhost:8000/index.html
