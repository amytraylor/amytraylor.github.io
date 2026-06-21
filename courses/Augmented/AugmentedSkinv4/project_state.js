/*
  Shared utility helpers for the floating-skin workshop app.
*/

(function () {
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

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
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const len = binary.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
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

  window.FSUtils = {
    timestampSlug,
    dataURLToBlob,
    downloadBlob,
    downloadText,
    nextFrame,
    dataURLMimeExtension
  };
})();
