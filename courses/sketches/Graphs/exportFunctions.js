// exportFunctions.js - Export to SVG, PNG, JSON

function toSVG(w, h) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of graph.nodes()) {
    const r = getNodeSize(node) / 2;
    minX = Math.min(minX, node.x - r);
    minY = Math.min(minY, node.y - r);
    maxX = Math.max(maxX, node.x + r);
    maxY = Math.max(maxY, node.y + r);
  }
  
  const padding = 20;
  const gw = maxX - minX + padding * 2;
  const gh = maxY - minY + padding * 2;
  const scale = Math.min(w / gw, h / gh);
  const ox = w / 2 - (minX + maxX) / 2 * scale;
  const oy = h / 2 - (minY + maxY) / 2 * scale;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">\n  <rect width="100%" height="100%" fill="${style.background}"/>\n  <g id="edges">\n`;
  
  for (const e of graph.edges()) {
    svg += `    <line x1="${e.source.x * scale + ox}" y1="${e.source.y * scale + oy}" x2="${e.target.x * scale + ox}" y2="${e.target.y * scale + oy}" stroke="${style.edgeStroke}" stroke-width="${style.edgeStrokeWeight * scale}"/>\n`;
  }
  
  svg += `  </g>\n  <g id="nodes">\n`;
  
  for (const n of graph.nodes()) {
    const cx = n.x * scale + ox;
    const cy = n.y * scale + oy;
    const r = getNodeSize(n) / 2 * scale;
    svg += `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${style.nodeFill}"/>\n`;
    if (style.nodeLabel) {
      svg += `    <text x="${cx}" y="${cy}" fill="${style.nodeLabelColor}" font-size="${style.nodeLabelSize * scale}" text-anchor="middle" dominant-baseline="central">${n.getLabel().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>\n`;
    }
  }
  
  return svg + `  </g>\n</svg>`;
}

function downloadSVG() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([toSVG(1200, 800)], { type: 'image/svg+xml' }));
  a.download = `graph_${graph.id}.svg`;
  a.click();
}

function downloadPNG() {
  saveCanvas(`graph_${graph.id}`, 'png');
}

function downloadJSON() {
  const data = {
    id: graph.id,
    nodes: graph.nodes().map(n => ({ id: n.id, x: n.x, y: n.y, label: n.getLabel() })),
    edges: graph.edges().map(e => ({ id: e.id, source: e.source.id, target: e.target.id, directed: e.directed }))
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `graph_${graph.id}.json`;
  a.click();
}
