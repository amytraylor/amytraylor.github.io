// aesthetics.js - Visual styling

const style = {
  nodeFill: '#d64541',
  nodeSize: 30,
  nodeSizeMode: 'fixed',
  nodeSizeMin: 20,
  nodeSizeMax: 60,
  nodeLabel: true,
  nodeLabelColor: '#ffffff',
  nodeLabelSize: 12,
  edgeStroke: '#555555',
  edgeStrokeWeight: 1.5,
  edgeArrows: true,
  edgeArrowSize: 8,
  background: '#1e2028'
};

function getNodeSize(node) {
  if (style.nodeSizeMode === 'degree') {
    const maxDeg = Math.max(1, ...graph.nodes().map(n => n.getDegree()));
    return style.nodeSizeMin + (style.nodeSizeMax - style.nodeSizeMin) * (node.getDegree() / maxDeg);
  }
  return style.nodeSize;
}

function applyStyle(idx) {
  // Reset to defaults
  style.nodeFill = '#d64541';
  style.nodeSize = 30;
  style.nodeSizeMode = 'fixed';
  style.nodeLabel = true;
  
  const styles = {
    0: { fill: '#f1c40f', size: 25 },
    1: { fill: '#2c3e50', sizeMode: 'degree', sizeMin: 6, sizeMax: 60, label: false },  // Barabási-Albert
    2: { fill: '#9b59b6', size: 35 },
    3: { fill: '#34495e', sizeMode: 'degree', sizeMin: 8, sizeMax: 50, label: false },  // Dorogovtsev-Mendes
    4: { fill: '#e91e63', size: 28 },
    5: { fill: '#f39c12', size: 40 },
    6: { fill: '#1abc9c', size: 20, label: false },
    7: { fill: '#16a085', size: 20, label: false },
    8: { fill: '#27ae60', size: 18, label: false },
    9: { fill: '#8e44ad', size: 35 },
    10: { fill: '#2c3e50', sizeMode: 'degree', sizeMin: 6, sizeMax: 55, label: false }, // Preferential Attachment
    11: { fill: '#2ecc71', size: 25 },
    12: { fill: '#3498db', size: 28 },
    13: { fill: '#e74c3c', sizeMode: 'degree', sizeMin: 20, sizeMax: 45 },
    14: { fill: '#f1c40f', size: 30 },
    15: { fill: '#e67e22', size: 30 },
    16: { fill: '#9b59b6', size: 32 },
    17: { fill: '#3498db', size: 32 },
    18: { fill: '#2980b9', size: 35 },
    19: { fill: '#1abc9c', size: 30 },
    20: { fill: '#27ae60', size: 30 }
  };
  
  const s = styles[idx] || {};
  if (s.fill) style.nodeFill = s.fill;
  if (s.size) style.nodeSize = s.size;
  if (s.sizeMode) style.nodeSizeMode = s.sizeMode;
  if (s.sizeMin) style.nodeSizeMin = s.sizeMin;
  if (s.sizeMax) style.nodeSizeMax = s.sizeMax;
  if (s.label !== undefined) style.nodeLabel = s.label;
}
