// sketch.js - Main p5.js sketch
//https://graphstream-project.org/doc/Generators/Overview-of-generators/

let graph, layout;
let offsetX = 0,
  offsetY = 0,
  viewScale = 1;
let hoveredNode = null,
  selectedNode = null,
  draggedNode = null;
let isPanning = false,
  lastMouseX = 0,
  lastMouseY = 0;
let autoLayout = true;
let editMode = "normal";

const graphTypes = [
  { name: "Banana Tree (4,4)", create: () => GraphGenerators.bananaTree(4, 4) },
  {
    name: "Barabási-Albert",
    create: () => GraphGenerators.barabasiAlbert(20, 3),
  },
  { name: "Chvátal", create: () => GraphGenerators.chvatal() },
  {
    name: "Dorogovtsev-Mendes",
    create: () => GraphGenerators.dorogovtsevMendes(20),
  },
  { name: "Flower Snark J₅", create: () => GraphGenerators.flowerSnark(5) },
  { name: "Complete K₁₀", create: () => GraphGenerators.complete(10) },
  { name: "Grid (10×10)", create: () => GraphGenerators.grid(10, 10) },
  {
    name: "Incomplete Grid (10×10)",
    create: () => GraphGenerators.incompleteGrid(10, 10, 0.1),
  },
  { name: "Lobster", create: () => GraphGenerators.lobster(15, 2, 0.5) },
  { name: "Petersen", create: () => GraphGenerators.petersen() },
  {
    name: "Preferential Attachment (40)",
    create: () => GraphGenerators.preferentialAttachment(40),
  },
  {
    name: "Random Euclidean (40)",
    create: () => GraphGenerators.randomEuclidean(40, 100),
  },
  {
    name: "Watts-Strogatz (20,2,0.5)",
    create: () => GraphGenerators.wattsStrogatz(20, 2, 0.5),
  },
  { name: "Erdős-Rényi", create: () => GraphGenerators.erdosRenyi(20, 0.1) },
  { name: "Star (12)", create: () => GraphGenerators.star(12) },
  { name: "Wheel (12)", create: () => GraphGenerators.wheel(12) },
  { name: "Hypercube 4D", create: () => GraphGenerators.hypercube(4) },
  {
    name: "Bipartite (6,8)",
    create: () => GraphGenerators.bipartite(6, 8, 0.4),
  },
  {
    name: "Complete Bipartite K₅,₆",
    create: () => GraphGenerators.completeBipartite(5, 6),
  },
  { name: "Ring (20)", create: () => GraphGenerators.ring(20) },
  { name: "Path (15)", create: () => GraphGenerators.path(15) },
];

let currentGraphIndex = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("sans-serif");

  const select = document.getElementById("graphType");
  graphTypes.forEach((gt, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = gt.name;
    select.appendChild(opt);
  });
  select.addEventListener("change", (e) =>
    createGraph(parseInt(e.target.value))
  );

  createGraph(0);
}

function createGraph(idx) {
  currentGraphIndex = idx;
  graph = graphTypes[idx].create();
  layout = new SpringLayout(graph);
  applyStyle(idx);

  const needsLayout = !graph._isGrid && !graph._isStructured;
  if (needsLayout) {
    layout.randomize(windowWidth, windowHeight);
    autoLayout = true;
  } else {
    autoLayout = false;
  }

  offsetX = offsetY = 0;
  viewScale = 1;
  selectedNode = hoveredNode = draggedNode = null;
  editMode = "normal";
  updateModeIndicator();
  updateAutoLayoutButton();
  document.getElementById("graphType").value = idx;
}

function draw() {
  if (autoLayout && !layout.isStable()) {
    for (let i = 0; i < 5; i++) layout.compute();
  }

  background(style.background);
  push();
  translate(width / 2 + offsetX, height / 2 + offsetY);
  scale(viewScale);

  for (const edge of graph.edges()) drawEdge(edge);
  hoveredNode = null;
  for (const node of graph.nodes()) drawNode(node);

  if (editMode === "add" && draggedNode && !isPanning) {
    const gp = screenToGraph(mouseX, mouseY);
    stroke(100, 255, 100, 150);
    strokeWeight(2);
    line(draggedNode.x, draggedNode.y, gp.x, gp.y);
  }
  pop();

  document.getElementById("info").innerHTML =
    `Nodes: ${graph.getNodeCount()} &nbsp; Edges: ${graph.getEdgeCount()}` +
    (layout.isStable() || !autoLayout
      ? ""
      : " &nbsp; <em>[layouting...]</em>") +
    (selectedNode ? ` &nbsp; Selected: ${selectedNode.id}` : "");
}

function drawEdge(edge) {
  const x1 = edge.source.x,
    y1 = edge.source.y,
    x2 = edge.target.x,
    y2 = edge.target.y;
  let isHovered = editMode === "remove" && getEdgeAt(mouseX, mouseY) === edge;
  const isHighlighted =
    hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);

  if (isHovered) {
    stroke(255, 100, 100);
    strokeWeight(style.edgeStrokeWeight * 3);
  } else if (isHighlighted) {
    stroke(100, 180, 255);
    strokeWeight(style.edgeStrokeWeight * 2);
  } else {
    stroke(style.edgeStroke);
    strokeWeight(style.edgeStrokeWeight);
  }

  line(x1, y1, x2, y2);

  if (style.edgeArrows && edge.directed) {
    const nr = getNodeSize(edge.target) / 2;
    const dx = x2 - x1,
      dy = y2 - y1,
      len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const ux = dx / len,
        uy = dy / len;
      const ax = x2 - ux * nr,
        ay = y2 - uy * nr;
      fill(style.edgeStroke);
      noStroke();
      push();
      translate(ax, ay);
      rotate(Math.atan2(dy, dx));
      triangle(
        0,
        0,
        -style.edgeArrowSize,
        -style.edgeArrowSize / 2,
        -style.edgeArrowSize,
        style.edgeArrowSize / 2
      );
      pop();
    }
  }
}

function drawNode(node) {
  const sz = getNodeSize(node);
  const sx = node.x * viewScale + width / 2 + offsetX;
  const sy = node.y * viewScale + height / 2 + offsetY;
  const isHovered =
    (mouseX - sx) ** 2 + (mouseY - sy) ** 2 < ((sz * viewScale) / 2) ** 2;
  if (isHovered) hoveredNode = node;

  if (editMode === "remove" && isHovered) fill(255, 80, 80);
  else if (editMode === "add" && isHovered) fill(80, 255, 80);
  else if (node === selectedNode) fill(46, 204, 113);
  else if (isHovered) fill(52, 152, 219);
  else fill(style.nodeFill);

  noStroke();
  ellipse(node.x, node.y, sz, sz);

  if (style.nodeLabel) {
    fill(style.nodeLabelColor);
    textSize(style.nodeLabelSize);
    textAlign(CENTER, CENTER);
    text(node.getLabel(), node.x, node.y);
  }
}

// Interaction helpers
function screenToGraph(sx, sy) {
  return {
    x: (sx - width / 2 - offsetX) / viewScale,
    y: (sy - height / 2 - offsetY) / viewScale,
  };
}

function getNodeAt(sx, sy) {
  const gp = screenToGraph(sx, sy);
  for (const node of graph.nodes()) {
    const r = getNodeSize(node) / 2 / viewScale;
    if ((gp.x - node.x) ** 2 + (gp.y - node.y) ** 2 < r * r) return node;
  }
  return null;
}

function getEdgeAt(sx, sy) {
  const gp = screenToGraph(sx, sy);
  const threshold = 10 / viewScale;
  for (const edge of graph.edges()) {
    const x1 = edge.source.x,
      y1 = edge.source.y,
      x2 = edge.target.x,
      y2 = edge.target.y;
    const dx = x2 - x1,
      dy = y2 - y1,
      len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    let t = Math.max(
      0,
      Math.min(1, ((gp.x - x1) * dx + (gp.y - y1) * dy) / len2)
    );
    if (
      Math.sqrt((gp.x - (x1 + t * dx)) ** 2 + (gp.y - (y1 + t * dy)) ** 2) <
      threshold
    )
      return edge;
  }
  return null;
}

function addNodeAt(x, y) {
  const gp = screenToGraph(x, y);
  const node = graph.addNode();
  node.setAttribute("ui.label", node.id);
  node.x = gp.x;
  node.y = gp.y;
  return node;
}

// Mouse events
let addModeStartNode = null;

function mousePressed() {
  lastMouseX = mouseX;
  lastMouseY = mouseY;

  if (editMode === "add") {
    const node = getNodeAt(mouseX, mouseY);
    if (node) {
      addModeStartNode = node;
      draggedNode = node;
    } else if (mouseButton === LEFT) addNodeAt(mouseX, mouseY);
    return;
  }

  if (editMode === "remove") {
    if (mouseButton === LEFT) {
      const node = getNodeAt(mouseX, mouseY);
      if (node) {
        graph.removeNode(node);
        if (selectedNode === node) selectedNode = null;
      } else {
        const edge = getEdgeAt(mouseX, mouseY);
        if (edge) graph.removeEdge(edge);
      }
    }
    return;
  }

  const node = getNodeAt(mouseX, mouseY);
  if (node) {
    selectedNode = node;
    draggedNode = node;
    node.freeze();
  } else if (mouseButton === RIGHT || mouseButton === CENTER) isPanning = true;
}

function mouseDragged() {
  if (editMode === "add" && addModeStartNode) return;
  if (draggedNode && editMode === "normal") {
    const gp = screenToGraph(mouseX, mouseY);
    draggedNode.x = gp.x;
    draggedNode.y = gp.y;
  } else if (isPanning) {
    offsetX += mouseX - lastMouseX;
    offsetY += mouseY - lastMouseY;
  }
  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function mouseReleased() {
  if (editMode === "add" && addModeStartNode) {
    const targetNode = getNodeAt(mouseX, mouseY);
    if (targetNode && targetNode !== addModeStartNode) {
      if (!addModeStartNode.getEdgeBetween(targetNode))
        graph.addEdge(undefined, addModeStartNode.id, targetNode.id);
    } else if (!targetNode) {
      const newNode = addNodeAt(mouseX, mouseY);
      graph.addEdge(undefined, addModeStartNode.id, newNode.id);
    }
    addModeStartNode = null;
    draggedNode = null;
    return;
  }
  if (draggedNode) {
    draggedNode.unfreeze();
    draggedNode = null;
  }
  isPanning = false;
}

function mouseWheel(event) {
  const zoomFactor = event.delta > 0 ? 0.9 : 1.1;
  const newScale = viewScale * zoomFactor;
  if (newScale > 0.1 && newScale < 10) {
    const wx = (mouseX - width / 2 - offsetX) / viewScale;
    const wy = (mouseY - height / 2 - offsetY) / viewScale;
    viewScale = newScale;
    offsetX = mouseX - width / 2 - wx * viewScale;
    offsetY = mouseY - height / 2 - wy * viewScale;
  }
  return false;
}

function keyPressed() {
  if (keyCode === RIGHT_ARROW)
    createGraph((currentGraphIndex + 1) % graphTypes.length);
  else if (keyCode === LEFT_ARROW)
    createGraph(
      (currentGraphIndex - 1 + graphTypes.length) % graphTypes.length
    );
  else if (key === " ") shakeLayout();
  else if (key === "a" || key === "A") toggleAutoLayout();
  else if (key === "r" || key === "R") createGraph(currentGraphIndex);
  else if (key === "v" || key === "V") resetView();
  else if (key === "n" || key === "N") setMode("add");
  else if (key === "x" || key === "X") setMode("remove");
  else if (keyCode === ESCAPE) setMode("normal");
  else if ((keyCode === DELETE || keyCode === BACKSPACE) && selectedNode) {
    graph.removeNode(selectedNode);
    selectedNode = null;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// UI helpers
function setMode(mode) {
  editMode = mode;
  updateModeIndicator();
}

function updateModeIndicator() {
  const ind = document.getElementById("mode-indicator");
  ind.classList.remove("active", "add", "remove");
  if (editMode === "add") {
    ind.textContent = "+ ADD NODE MODE (click to add, drag to connect)";
    ind.classList.add("active", "add");
  } else if (editMode === "remove") {
    ind.textContent = "− REMOVE MODE (click node/edge to delete)";
    ind.classList.add("active", "remove");
  }
}

function updateAutoLayoutButton() {
  document.getElementById("autoBtn").textContent =
    "Auto: " + (autoLayout ? "ON" : "OFF");
}

function randomizeLayout() {
  if (graph._isGrid) {
    const rows = Math.floor(Math.random() * 5) + 3;
    const cols = Math.floor(Math.random() * 5) + 3;
    graph = graph.id.includes("incomplete")
      ? GraphGenerators.incompleteGrid(rows, cols, 0.15 + Math.random() * 0.2)
      : GraphGenerators.grid(rows, cols);
    layout = new SpringLayout(graph);
    applyStyle(currentGraphIndex);
    autoLayout = false;
  } else {
    layout.randomize(windowWidth, windowHeight);
    autoLayout = true;
  }
  updateAutoLayoutButton();
}

function shakeLayout() {
  layout.shake(50);
  if (!autoLayout) {
    autoLayout = true;
    updateAutoLayoutButton();
  }
}

function toggleAutoLayout() {
  autoLayout = !autoLayout;
  updateAutoLayoutButton();
}

function resetView() {
  offsetX = offsetY = 0;
  viewScale = 1;
}

document.addEventListener("contextmenu", (e) => e.preventDefault());
