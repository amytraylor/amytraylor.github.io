// graphFactories.js - Graph generators

const GraphGenerators = {
  
  bananaTree(n, k) {
    const g = new Graph('banana_tree', false, true, false);
    g.addNode('root').setAttribute('ui.label', 'R');
    for (let i = 0; i < n; i++) {
      const cid = 'c' + i;
      g.addNode(cid).setAttribute('ui.label', 'C' + i);
      const l0 = 'l' + i + '_0';
      g.addNode(l0).setAttribute('ui.label', '');
      g.addEdge(undefined, 'root', l0);
      g.addEdge(undefined, cid, l0);
      for (let j = 1; j < k; j++) {
        const lid = 'l' + i + '_' + j;
        g.addNode(lid).setAttribute('ui.label', '');
        g.addEdge(undefined, cid, lid);
      }
    }
    return g;
  },
  
  barabasiAlbert(nodeCount, edgesPerStep) {
    const g = new Graph('barabasi_albert', false, true, false);
    for (let i = 0; i <= edgesPerStep; i++) g.addNode('n' + i).setAttribute('ui.label', '' + i);
    for (let i = 1; i <= edgesPerStep; i++) g.addEdge(undefined, 'n0', 'n' + i);
    
    for (let i = edgesPerStep + 1; i < nodeCount; i++) {
      const newNode = g.addNode('n' + i);
      newNode.setAttribute('ui.label', '' + i);
      let totalDegree = 0;
      for (const n of g.nodes()) totalDegree += n.getDegree();
      const targets = [];
      let conn = 0;
      while (conn < edgesPerStep && conn < i) {
        let r = Math.random() * totalDegree, cum = 0, sel = null;
        for (const n of g.nodes()) {
          if (n === newNode || targets.includes(n)) continue;
          cum += n.getDegree();
          if (cum >= r) { sel = n; break; }
        }
        if (sel && !targets.includes(sel)) {
          targets.push(sel);
          g.addEdge(undefined, newNode.id, sel.id);
          conn++;
        }
      }
    }
    return g;
  },
  
  chvatal() {
    const g = new Graph('chvatal', false, true, false);
    for (let i = 0; i < 12; i++) g.addNode('n' + i).setAttribute('ui.label', '' + i);
    [[0,1],[0,4],[0,6],[0,9],[1,2],[1,5],[1,7],[2,3],[2,6],[2,8],[3,4],[3,7],[3,9],[4,5],[4,8],[5,10],[5,11],[6,10],[6,11],[7,8],[7,11],[8,10],[9,10],[9,11]].forEach(([a,b]) => g.addEdge(undefined, 'n'+a, 'n'+b));
    return g;
  },
  
  dorogovtsevMendes(nodeCount) {
    const g = new Graph('dorogovtsev_mendes', false, true, false);
    if (nodeCount < 3) nodeCount = 3;
    for (let i = 0; i < 3; i++) g.addNode('n' + i).setAttribute('ui.label', '' + i);
    g.addEdge(undefined, 'n0', 'n1'); g.addEdge(undefined, 'n1', 'n2'); g.addEdge(undefined, 'n2', 'n0');
    for (let i = 3; i < nodeCount; i++) {
      const edge = g.getEdge(Math.floor(Math.random() * g.getEdgeCount()));
      const newNode = g.addNode('n' + i);
      newNode.setAttribute('ui.label', '' + i);
      g.addEdge(undefined, newNode.id, edge.source.id);
      g.addEdge(undefined, newNode.id, edge.target.id);
    }
    return g;
  },
  
  flowerSnark(n) {
    if (n < 3) n = 3;
    if (n % 2 === 0) n++;
    const g = new Graph('flower_snark', false, true, false);
    for (let i = 0; i < n; i++) {
      ['a','b','c','d'].forEach(p => g.addNode(p + i).setAttribute('ui.label', p + i));
    }
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      g.addEdge(undefined, 'a' + i, 'a' + next);
      g.addEdge(undefined, 'a' + i, 'b' + i);
      g.addEdge(undefined, 'b' + i, 'c' + i);
      g.addEdge(undefined, 'b' + i, 'd' + i);
      g.addEdge(undefined, 'c' + i, 'd' + next);
      g.addEdge(undefined, 'd' + i, 'c' + next);
    }
    return g;
  },
  
  complete(n) {
    const g = new Graph('complete_K' + n, false, true, false);
    for (let i = 0; i < n; i++) g.addNode('n' + i).setAttribute('ui.label', '' + i);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) g.addEdge(undefined, 'n' + i, 'n' + j);
    return g;
  },
  
  grid(rows, cols) {
    const g = new Graph('grid_' + rows + 'x' + cols, false, true, false);
    g._isGrid = true; g._gridRows = rows; g._gridCols = cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const node = g.addNode(r + '_' + c);
        node.setAttribute('ui.label', '');
        node.x = (c - (cols - 1) / 2) * 60;
        node.y = (r - (rows - 1) / 2) * 60;
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) g.addEdge(undefined, r + '_' + c, r + '_' + (c + 1));
        if (r < rows - 1) g.addEdge(undefined, r + '_' + c, (r + 1) + '_' + c);
      }
    }
    return g;
  },
  
  incompleteGrid(rows, cols, holeProbability) {
    const g = new Graph('incomplete_grid', false, true, false);
    g._isGrid = true; g._gridRows = rows; g._gridCols = cols;
    const exists = [];
    for (let r = 0; r < rows; r++) {
      exists[r] = [];
      for (let c = 0; c < cols; c++) {
        if (Math.random() > holeProbability) {
          exists[r][c] = true;
          const node = g.addNode(r + '_' + c);
          node.setAttribute('ui.label', '');
          node.x = (c - (cols - 1) / 2) * 60;
          node.y = (r - (rows - 1) / 2) * 60;
        }
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!exists[r][c]) continue;
        if (c < cols - 1 && exists[r][c + 1]) g.addEdge(undefined, r + '_' + c, r + '_' + (c + 1));
        if (r < rows - 1 && exists[r + 1] && exists[r + 1][c]) g.addEdge(undefined, r + '_' + c, (r + 1) + '_' + c);
      }
    }
    return g;
  },
  
  lobster(pathLength, maxDistance, branchProb) {
    const g = new Graph('lobster', false, true, false);
    for (let i = 0; i < pathLength; i++) {
      const node = g.addNode('p' + i);
      node.setAttribute('ui.label', '');
      node.x = (i - pathLength / 2) * 60;
      node.y = 0;
      if (i > 0) g.addEdge(undefined, 'p' + (i - 1), 'p' + i);
    }
    let bid = 0;
    function addBranches(parentId, depth, maxDepth, prob) {
      if (depth >= maxDepth) return;
      const parent = g.getNode(parentId);
      let count = 0;
      while (Math.random() < prob && count < 3) {
        const childId = 'b' + (bid++);
        const child = g.addNode(childId);
        child.setAttribute('ui.label', '');
        const angle = Math.random() * Math.PI * 2;
        child.x = parent.x + Math.cos(angle) * (40 + depth * 20);
        child.y = parent.y + Math.sin(angle) * (40 + depth * 20);
        g.addEdge(undefined, parentId, childId);
        addBranches(childId, depth + 1, maxDepth, prob * 0.7);
        count++;
      }
    }
    for (let i = 0; i < pathLength; i++) addBranches('p' + i, 0, maxDistance, branchProb);
    return g;
  },
  
  petersen() {
    const g = new Graph('petersen', false, true, false);
    g._isStructured = true;
    for (let i = 0; i < 10; i++) {
      const node = g.addNode('n' + i);
      node.setAttribute('ui.label', '' + i);
      const angle = (Math.PI * 2 * (i % 5)) / 5 - Math.PI / 2;
      node.x = Math.cos(angle) * (i < 5 ? 150 : 70);
      node.y = Math.sin(angle) * (i < 5 ? 150 : 70);
    }
    for (let i = 0; i < 5; i++) {
      g.addEdge(undefined, 'n' + i, 'n' + ((i + 1) % 5));
      g.addEdge(undefined, 'n' + (i + 5), 'n' + (((i + 2) % 5) + 5));
      g.addEdge(undefined, 'n' + i, 'n' + (i + 5));
    }
    return g;
  },
  
  preferentialAttachment(nodeCount) {
    const g = new Graph('preferential_attachment', false, true, false);
    g.addNode('n0').setAttribute('ui.label', '0');
    for (let i = 1; i < nodeCount; i++) {
      const newNode = g.addNode('n' + i);
      newNode.setAttribute('ui.label', '' + i);
      let totalDegree = 0;
      for (const n of g.nodes()) totalDegree += Math.max(1, n.getDegree());
      let r = Math.random() * totalDegree, cum = 0, target = g.getNode(0);
      for (const n of g.nodes()) {
        if (n === newNode) continue;
        cum += Math.max(1, n.getDegree());
        if (cum >= r) { target = n; break; }
      }
      g.addEdge(undefined, newNode.id, target.id);
    }
    return g;
  },
  
  randomEuclidean(nodeCount, threshold) {
    const g = new Graph('random_euclidean', false, true, false);
    g._isStructured = true;
    for (let i = 0; i < nodeCount; i++) {
      const node = g.addNode('n' + i);
      node.setAttribute('ui.label', '' + i);
      node.x = (Math.random() - 0.5) * 600;
      node.y = (Math.random() - 0.5) * 600;
    }
    for (let i = 0; i < nodeCount; i++) {
      const ni = g.getNode(i);
      for (let j = i + 1; j < nodeCount; j++) {
        const nj = g.getNode(j);
        if (Math.sqrt((ni.x - nj.x) ** 2 + (ni.y - nj.y) ** 2) < threshold) g.addEdge(undefined, ni.id, nj.id);
      }
    }
    return g;
  },
  
  wattsStrogatz(nodeCount, k, beta) {
    if (k % 2 !== 0) k++;
    const g = new Graph('watts_strogatz', false, true, false);
    g._isStructured = true;
    for (let i = 0; i < nodeCount; i++) {
      const node = g.addNode('n' + i);
      node.setAttribute('ui.label', '' + i);
      const angle = (Math.PI * 2 * i) / nodeCount - Math.PI / 2;
      node.x = Math.cos(angle) * 200;
      node.y = Math.sin(angle) * 200;
    }
    const edges = [];
    for (let i = 0; i < nodeCount; i++) for (let j = 1; j <= k / 2; j++) edges.push([i, (i + j) % nodeCount]);
    const hasEdge = (a, b) => { const na = g.getNode('n'+a), nb = g.getNode('n'+b); return na && nb && na.getEdgeBetween(nb); };
    for (const [src, tgt] of edges) {
      let target = tgt;
      if (Math.random() < beta) {
        let newT, att = 0;
        do { newT = Math.floor(Math.random() * nodeCount); att++; } while ((newT === src || hasEdge(src, newT)) && att < 100);
        if (att < 100) target = newT;
      }
      if (!hasEdge(src, target)) g.addEdge(undefined, 'n' + src, 'n' + target);
    }
    return g;
  },
  
  erdosRenyi(nodeCount, prob) {
    const g = new Graph('erdos_renyi', false, true, false);
    for (let i = 0; i < nodeCount; i++) g.addNode('n' + i).setAttribute('ui.label', '' + i);
    for (let i = 0; i < nodeCount; i++) for (let j = i + 1; j < nodeCount; j++) if (Math.random() < prob) g.addEdge(undefined, 'n' + i, 'n' + j);
    return g;
  },
  
  star(n) {
    const g = new Graph('star', false, true, false);
    g._isStructured = true;
    g.addNode('center').setAttribute('ui.label', 'C');
    g.getNode('center').x = g.getNode('center').y = 0;
    for (let i = 0; i < n; i++) {
      const leaf = g.addNode('n' + i);
      leaf.setAttribute('ui.label', '' + i);
      const angle = (Math.PI * 2 * i) / n;
      leaf.x = Math.cos(angle) * 150;
      leaf.y = Math.sin(angle) * 150;
      g.addEdge(undefined, 'center', 'n' + i);
    }
    return g;
  },
  
  wheel(n) {
    const g = this.star(n);
    g.id = 'wheel';
    for (let i = 0; i < n; i++) g.addEdge(undefined, 'n' + i, 'n' + ((i + 1) % n));
    return g;
  },
  
  hypercube(dimensions) {
    const g = new Graph('hypercube_' + dimensions + 'D', false, true, false);
    const numNodes = 1 << dimensions;
    for (let i = 0; i < numNodes; i++) g.addNode('n' + i).setAttribute('ui.label', i.toString(2).padStart(dimensions, '0'));
    for (let i = 0; i < numNodes; i++) for (let bit = 0; bit < dimensions; bit++) { const nb = i ^ (1 << bit); if (nb > i) g.addEdge(undefined, 'n' + i, 'n' + nb); }
    return g;
  },
  
  bipartite(n1, n2, prob) {
    const g = new Graph('bipartite', false, true, false);
    g._isStructured = true;
    for (let i = 0; i < n1; i++) { const n = g.addNode('a' + i); n.setAttribute('ui.label', 'A' + i); n.x = -150; n.y = (i - (n1 - 1) / 2) * 50; }
    for (let i = 0; i < n2; i++) { const n = g.addNode('b' + i); n.setAttribute('ui.label', 'B' + i); n.x = 150; n.y = (i - (n2 - 1) / 2) * 50; }
    for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) if (Math.random() < prob) g.addEdge(undefined, 'a' + i, 'b' + j);
    return g;
  },
  
  completeBipartite(n, m) { return this.bipartite(n, m, 1.0); },
  
  ring(n) {
    const g = new Graph('ring', false, true, false);
    g._isStructured = true;
    for (let i = 0; i < n; i++) {
      const node = g.addNode('n' + i);
      node.setAttribute('ui.label', '' + i);
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      node.x = Math.cos(angle) * 150;
      node.y = Math.sin(angle) * 150;
    }
    for (let i = 0; i < n; i++) g.addEdge(undefined, 'n' + i, 'n' + ((i + 1) % n));
    return g;
  },
  
  path(n) {
    const g = new Graph('path', false, true, false);
    g._isStructured = true;
    for (let i = 0; i < n; i++) {
      const node = g.addNode('n' + i);
      node.setAttribute('ui.label', '' + i);
      node.x = (i - (n - 1) / 2) * 60;
      node.y = 0;
    }
    for (let i = 0; i < n - 1; i++) g.addEdge(undefined, 'n' + i, 'n' + (i + 1));
    return g;
  }
};
