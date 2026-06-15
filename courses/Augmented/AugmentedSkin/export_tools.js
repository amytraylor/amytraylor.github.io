
/*
  FSUtils fallback: keeps export_tools.js working even if project_state.js
  was not loaded or was loaded in the wrong order.
*/
if (typeof window.FSUtils === "undefined") {
  window.FSUtils = (function () {
    function pad2(n) { return String(n).padStart(2, "0"); }

    function timestampSlug() {
      const d = new Date();
      return [
        d.getFullYear(),
        pad2(d.getMonth() + 1),
        pad2(d.getDate()),
        "_",
        pad2(d.getHours()),
        pad2(d.getMinutes()),
        pad2(d.getSeconds())
      ].join("");
    }

    function dataURLToBlob(dataURL) {
      const parts = dataURL.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
      const binary = atob(parts[1]);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }

    function downloadBlob(blob, filename) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    }

    function downloadText(text, filename, mime = "text/plain") {
      downloadBlob(new Blob([text], { type: mime }), filename);
    }

    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(resolve));
    }

    function dataURLMimeExtension(dataURL) {
      if (dataURL.startsWith("data:image/png")) return "png";
      if (dataURL.startsWith("data:image/jpeg")) return "jpg";
      if (dataURL.startsWith("data:image/webp")) return "webp";
      return "bin";
    }

    return {
      timestampSlug,
      dataURLToBlob,
      downloadBlob,
      downloadText,
      nextFrame,
      dataURLMimeExtension
    };
  })();
}

/*
  Export tools for floating-skin workshop app.
  Loaded after sketch.js.
*/

(function () {
  const VIEW_PRESETS = [
    { name: "front", position: [0, 0, 420], target: [0, 0, 0] },
    { name: "left_profile", position: [-420, 0, 0], target: [0, 0, 0] },
    { name: "right_profile", position: [420, 0, 0], target: [0, 0, 0] },
    { name: "three_quarter_left", position: [-300, 90, 300], target: [0, 0, 0] },
    { name: "three_quarter_right", position: [300, 90, 300], target: [0, 0, 0] },
    { name: "top", position: [0, 420, 0], target: [0, 0, 0] }
  ];

  function app() {
    if (!window.FloatingSkinApp) {
      throw new Error("FloatingSkinApp is not available yet.");
    }
    return window.FloatingSkinApp.getContext();
  }

  function getExportStep() {
    const ctx = app();
    const v = ctx.ui.xyzExportStep ? parseInt(ctx.ui.xyzExportStep.value, 10) : 4;
    return Number.isFinite(v) && v > 0 ? v : 4;
  }

  function status(message) {
    const ctx = app();
    console.log(message);
    if (ctx.ui.stats) ctx.ui.stats.textContent += "\n\n" + message;
  }

  function textureToDataURL(entry) {
    if (!entry || !entry.source) return null;
    const source = entry.source;

    if (source instanceof HTMLCanvasElement) {
      return source.toDataURL("image/png");
    }

    if (source instanceof HTMLImageElement) {
      if (source.src && source.src.startsWith("data:")) return source.src;
      try {
        const c = document.createElement("canvas");
        c.width = source.naturalWidth || source.width || 256;
        c.height = source.naturalHeight || source.height || 256;
        const g = c.getContext("2d");
        g.drawImage(source, 0, 0, c.width, c.height);
        return c.toDataURL("image/png");
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  function buildProjectManifest(options = {}) {
    const ctx = app();
    const textures = ctx.textureChoices.map((entry, index) => {
      const out = {
        index,
        label: entry.label,
        selected: index === ctx.activeTextureIndex,
        kind: entry.source instanceof HTMLCanvasElement ? "built-in-canvas" : "image"
      };
      if (options.includeTextureDataURLs) out.dataURL = textureToDataURL(entry);
      return out;
    });

    return {
      appVersion: "floating-skin-workshop-v1",
      exportedAt: new Date().toISOString(),

      meshSource: {
        type: "preset-or-captured-json",
        vertexCount: ctx.meshData ? ctx.meshData.positions.length : 0,
        triangleCount: ctx.meshData ? ctx.meshData.triangles.length : 0
      },

      displaySettings: {
        flipY: !!ctx.ui.flipY?.checked,
        flipDesignY: !!ctx.ui.flipDesignY?.checked
      },

      displacementSettings: {
        pointBaseOffset: Number(ctx.ui.pointBaseOffset?.value),
        pointMinDisp: Number(ctx.ui.pointMinDisp?.value),
        pointMaxDisp: Number(ctx.ui.pointMaxDisp?.value),
        pointSize: Number(ctx.ui.pointSize?.value),
        maxFloatingPoints: Number(ctx.ui.maxFloatingPoints?.value),

        triBaseOffset: Number(ctx.ui.triBaseOffset?.value),
        triMinDisp: Number(ctx.ui.triMinDisp?.value),
        triMaxDisp: Number(ctx.ui.triMaxDisp?.value),
        triScale: Number(ctx.ui.triScale?.value)
      },

      softeningSettings: {
        blurRadiusPx: Number(ctx.ui.blurRadius?.value || 0),
        useBlurredDesignForDisplacement: !!ctx.ui.useBlurredDesign?.checked
      },

      samplerSettings: {
        mode: ctx.uvLookup?.mode,
        requestedUvStep: ctx.uvLookup?.requestedStep,
        effectiveUvStep: ctx.uvLookup?.effectiveStep,
        uvCoverageEstimate: ctx.uvLookup?.uvCoverage,
        renderedFloatingPoints: ctx.floatingBuildStatus?.renderedCount
      },

      exportSettings: {
        xyzExportStep: getExportStep()
      },

      textureState: {
        textures,
        activeTextureIndex: ctx.activeTextureIndex,
        stampHistory: ctx.stampHistory
      },

      files: {
        rawDesignPNG: "design_raw.png",
        softenedDesignPNG: "design_softened.png",
        xyzRawCSV: "points_raw_before_blur.csv",
        xyzSoftenedCSV: "points_after_blur.csv"
      }
    };
  }

  function renderViewDataURL(preset) {
    const ctx = app();

    const savedPosition = ctx.camera.position.clone();
    const savedTarget = ctx.controls.target.clone();
    const savedZoom = ctx.camera.zoom;

    ctx.camera.position.set(...preset.position);
    ctx.controls.target.set(...preset.target);
    ctx.camera.zoom = savedZoom;
    ctx.camera.lookAt(ctx.controls.target);
    ctx.camera.updateProjectionMatrix();
    ctx.controls.update();

    ctx.renderer.render(ctx.scene, ctx.camera);
    const dataURL = ctx.renderer.domElement.toDataURL("image/png");

    ctx.camera.position.copy(savedPosition);
    ctx.controls.target.copy(savedTarget);
    ctx.camera.zoom = savedZoom;
    ctx.camera.lookAt(ctx.controls.target);
    ctx.camera.updateProjectionMatrix();
    ctx.controls.update();
    ctx.renderer.render(ctx.scene, ctx.camera);

    return dataURL;
  }

  async function generateViewImages(updateGui = true) {
    const ctx = app();
    const images = [];

    if (updateGui && ctx.ui.viewThumbGrid) {
      ctx.ui.viewThumbGrid.innerHTML = "";
    }

    for (const preset of VIEW_PRESETS) {
      const dataURL = renderViewDataURL(preset);
      images.push({ name: preset.name, dataURL });

      if (updateGui && ctx.ui.viewThumbGrid) {
        const div = document.createElement("div");
        div.className = "viewThumb";

        const img = document.createElement("img");
        img.src = dataURL;

        const caption = document.createElement("div");
        caption.className = "caption";
        caption.textContent = preset.name;

        div.appendChild(img);
        div.appendChild(caption);
        ctx.ui.viewThumbGrid.appendChild(div);
      }

      await FSUtils.nextFrame();
    }

    return images;
  }

  async function buildXYZCSV(stage, sampleCtx) {
    const ctx = app();

    const targetCount = ctx.floatingPoints && ctx.floatingPoints.geometry
      ? ctx.floatingPoints.geometry.getAttribute("position").count
      : Number(ctx.ui.maxFloatingPoints.value || 360000);

    const plan = ctx.buildSurfaceSamplePlan(ctx.meshData, targetCount);
    const designPixels = sampleCtx.getImageData(0, 0, ctx.DESIGN_W, ctx.DESIGN_H).data;

    const rows = [
      [
        "point_index",
        "stage",
        "x",
        "y",
        "z",
        "r",
        "g",
        "b",
        "brightness_0_1",
        "displacement",
        "design_pixel_x",
        "design_pixel_y",
        "triangle_index",
        "bary_a",
        "bary_b",
        "bary_c"
      ].join(",")
    ];

    const baseOffset = Number(ctx.ui.pointBaseOffset.value);
    const minDisp = Number(ctx.ui.pointMinDisp.value);
    const maxDisp = Number(ctx.ui.pointMaxDisp.value);

    let triIndex = 0;
    let localIndex = 0;
    let pointIndex = 0;

    return await new Promise((resolve) => {
      function processChunk() {
        const BATCH_SIZE = 3000;
        let batchCount = 0;

        while (
          batchCount < BATCH_SIZE &&
          triIndex < ctx.meshData.triangleData.length &&
          pointIndex < targetCount
        ) {
          const nSamples = plan.allocations[triIndex] || 0;

          if (localIndex >= nSamples) {
            triIndex++;
            localIndex = 0;
            continue;
          }

          const tri = ctx.meshData.triangleData[triIndex];
          const bary = ctx.sampleTriangleBarycentric(localIndex, nSamples, triIndex);
          localIndex++;

          const a = bary.a;
          const b = bary.b;
          const c = bary.c;

          const pAndN = ctx.interpolateTrianglePositionAndNormal(tri, a, b, c);
          const dp = ctx.designPixelForBarycentric(tri, a, b, c);
          const sample = ctx.sampleImageDataRGBA(designPixels, dp.x, dp.y);
          const brightness = sample.brightness / 255;
          const displacement = minDisp + (maxDisp - minDisp) * brightness;
          const finalPos = pAndN.p.clone().addScaledVector(pAndN.n, baseOffset + displacement);

          rows.push([
            pointIndex,
            stage,
            finalPos.x.toFixed(6),
            finalPos.y.toFixed(6),
            finalPos.z.toFixed(6),
            sample.r,
            sample.g,
            sample.b,
            brightness.toFixed(6),
            displacement.toFixed(6),
            Math.floor(dp.x),
            Math.floor(dp.y),
            tri.index,
            a.toFixed(8),
            b.toFixed(8),
            c.toFixed(8)
          ].join(","));

          pointIndex++;
          batchCount++;
        }

        if (triIndex < ctx.meshData.triangleData.length && pointIndex < targetCount) {
          requestAnimationFrame(processChunk);
          return;
        }

        resolve(rows.join("\n"));
      }

      requestAnimationFrame(processChunk);
    });
  }

  async function exportXYZ(stage) {
    const ctx = app();
    ctx.updateBlurredDesign();

    const sampleCtx = stage === "raw_before_blur" ? ctx.dctx : ctx.blurredDctx;
    const csv = await buildXYZCSV(stage, sampleCtx);

    FSUtils.downloadText(
      csv,
      `floating_skin_${stage}_${FSUtils.timestampSlug()}.csv`,
      "text/csv"
    );
  }

  async function buildRenderedPointsCSVWorker() {
    const ctx = app();

    if (!ctx.floatingPoints || !ctx.floatingPoints.geometry) {
      throw new Error("No rendered floating point cloud is available yet.");
    }

    const posAttr = ctx.floatingPoints.geometry.getAttribute("position");
    const colAttr = ctx.floatingPoints.geometry.getAttribute("color");

    const positions = new Float32Array(posAttr.array);
    const colors = colAttr ? new Float32Array(colAttr.array) : null;
    const total = posAttr.count;

    const workerCode = `
      self.onmessage = function(e) {
        const positions = e.data.positions;
        const colors = e.data.colors;
        const total = e.data.total;

        const rows = new Array(total + 1);
        rows[0] = "point_index,stage,x,y,z,r,g,b";

        for (let i = 0; i < total; i++) {
          const k = i * 3;
          const r = colors ? Math.round(255 * colors[k]) : "";
          const g = colors ? Math.round(255 * colors[k + 1]) : "";
          const b = colors ? Math.round(255 * colors[k + 2]) : "";

          rows[i + 1] = [
            i,
            "rendered_current",
            positions[k].toFixed(6),
            positions[k + 1].toFixed(6),
            positions[k + 2].toFixed(6),
            r,
            g,
            b
          ].join(",");
        }

        self.postMessage(rows.join("\n"));
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);

    try {
      const worker = new Worker(workerUrl);
      const transfer = [positions.buffer];
      if (colors) transfer.push(colors.buffer);

      const csv = await new Promise((resolve, reject) => {
        worker.onmessage = (e) => resolve(e.data);
        worker.onerror = (e) => reject(new Error(e.message || "Worker export failed."));
        worker.postMessage({ positions, colors, total }, transfer);
      });

      worker.terminate();
      return csv;
    } finally {
      URL.revokeObjectURL(workerUrl);
    }
  }

  async function exportRenderedPointsXYZ() {
    const csv = await buildRenderedPointsCSVWorker();

    FSUtils.downloadText(
      csv,
      `floating_skin_rendered_points_${FSUtils.timestampSlug()}.csv`,
      "text/csv"
    );
  }


  async function exportManifestJSON() {
    const ctx = app();
    ctx.updateBlurredDesign();

    const manifest = buildProjectManifest({ includeTextureDataURLs: true });

    manifest.designImages = {
      rawDesignCanvasPNG: ctx.designCanvas.toDataURL("image/png"),
      softenedDesignCanvasPNG: ctx.blurredDesignCanvas.toDataURL("image/png")
    };

    FSUtils.downloadText(
      JSON.stringify(manifest, null, 2),
      `floating_skin_project_${FSUtils.timestampSlug()}.json`,
      "application/json"
    );
  }

  async function exportViewsZip() {
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip is not loaded. Add the JSZip script tag to index.html before export_tools.js.");
    }

    const images = await generateViewImages(true);
    const zip = new JSZip();

    for (const img of images) {
      zip.file(`views/${img.name}.png`, FSUtils.dataURLToBlob(img.dataURL));
    }

    const blob = await zip.generateAsync({ type: "blob" });
    FSUtils.downloadBlob(blob, `floating_skin_views_${FSUtils.timestampSlug()}.zip`);
  }

  async function exportFullProjectZip() {
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip is not loaded. Add the JSZip script tag to index.html before export_tools.js.");
    }

    const ctx = app();
    ctx.updateBlurredDesign();

    status("Building project ZIP...");

    const zip = new JSZip();
    const manifest = buildProjectManifest({ includeTextureDataURLs: false });
    const viewImages = await generateViewImages(true);

    zip.file("project_manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("design_raw.png", FSUtils.dataURLToBlob(ctx.designCanvas.toDataURL("image/png")));
    zip.file("design_softened.png", FSUtils.dataURLToBlob(ctx.blurredDesignCanvas.toDataURL("image/png")));

    for (const img of viewImages) {
      zip.file(`views/${img.name}.png`, FSUtils.dataURLToBlob(img.dataURL));
    }

    const renderedCSV = await buildRenderedPointsCSVWorker();
    zip.file("points_rendered_current.csv", renderedCSV);

    ctx.textureChoices.forEach((entry, index) => {
      const dataURL = textureToDataURL(entry);
      if (!dataURL) return;
      const ext = FSUtils.dataURLMimeExtension(dataURL);
      const safeLabel = String(entry.label || `texture_${index}`).replace(/[^a-z0-9_-]+/gi, "_");
      zip.file(`textures/${String(index).padStart(2, "0")}_${safeLabel}.${ext}`, FSUtils.dataURLToBlob(dataURL));
    });

    const blob = await zip.generateAsync({ type: "blob" });
    FSUtils.downloadBlob(blob, `floating_skin_project_${FSUtils.timestampSlug()}.zip`);
    status("Project ZIP complete. It includes points_rendered_current.csv.");
  }

  function attachExportButtonHandlers() {
    const ids = {
      previewViewsBtn: () => generateViewImages(true),
      exportViewsBtn: exportViewsZip,
      exportXYZRawBtn: () => exportXYZ("raw_before_blur"),
      exportXYZBlurredBtn: () => exportXYZ("after_blur"),
      exportRenderedXYZBtn: exportRenderedPointsXYZ,
      exportManifestBtn: exportManifestJSON,
      exportProjectZipBtn: exportFullProjectZip
    };

    for (const [id, handler] of Object.entries(ids)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener("click", async () => {
        try {
          el.disabled = true;
          await handler();
        } catch (err) {
          console.error(err);
          alert(err.message || String(err));
        } finally {
          el.disabled = false;
        }
      });
    }
  }

  window.FSExportTools = {
    VIEW_PRESETS,
    buildProjectManifest,
    generateViewImages,
    buildXYZCSV,
    exportXYZ,
    exportRenderedPointsXYZ,
    exportManifestJSON,
    exportViewsZip,
    exportFullProjectZip
  };

  requestAnimationFrame(attachExportButtonHandlers);
})();
