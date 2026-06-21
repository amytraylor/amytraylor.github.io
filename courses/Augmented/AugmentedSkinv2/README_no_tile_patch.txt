Standalone p5 SVG picker upload no-tile patch

Changed file: sketch.js

Patch: addImagePattern(t) now creates a 2048 x 2048 user-space SVG pattern with one fitted image, instead of a 120 x 120 repeating tile.

This affects uploaded images and raster/canvas-generated texture sources.
