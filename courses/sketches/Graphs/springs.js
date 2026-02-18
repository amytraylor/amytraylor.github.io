// springs.js - Force-directed layout

class SpringLayout {
  constructor(graph) {
    this.graph = graph;
    this.springLength = 100;
    this.springK = 0.1;
    this.repulsionK = 10000;
    this.damping = 0.85;
    this.minEnergy = 0.5;
    this.totalEnergy = Infinity;
  }
  
  randomize(w, h) {
    for (const node of this.graph.nodes()) {
      node.x = (Math.random() - 0.5) * w * 0.8;
      node.y = (Math.random() - 0.5) * h * 0.8;
      node.vx = node.vy = 0;
    }
  }
  
  compute() {
    const nodes = this.graph.nodeList;
    const n = nodes.length;
    if (n === 0) return;
    
    const fx = new Float32Array(n);
    const fy = new Float32Array(n);
    
    // Repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ni = nodes[i], nj = nodes[j];
        let dx = nj.x - ni.x;
        let dy = nj.y - ni.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = this.repulsionK / (dist * dist);
        const fdx = (dx / dist) * force;
        const fdy = (dy / dist) * force;
        fx[i] -= fdx; fy[i] -= fdy;
        fx[j] += fdx; fy[j] += fdy;
      }
    }
    
    // Attraction
    for (const edge of this.graph.edgeList) {
      const si = edge.source.index;
      const ti = edge.target.index;
      let dx = edge.target.x - edge.source.x;
      let dy = edge.target.y - edge.source.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = this.springK * (dist - this.springLength);
      const fdx = (dx / dist) * force;
      const fdy = (dy / dist) * force;
      fx[si] += fdx; fy[si] += fdy;
      fx[ti] -= fdx; fy[ti] -= fdy;
    }
    
    // Apply
    this.totalEnergy = 0;
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      if (node.frozen) continue;
      node.vx = (node.vx + fx[i]) * this.damping;
      node.vy = (node.vy + fy[i]) * this.damping;
      node.x += node.vx;
      node.y += node.vy;
      this.totalEnergy += node.vx * node.vx + node.vy * node.vy;
    }
  }
  
  isStable() {
    return this.totalEnergy < this.minEnergy * Math.max(1, this.graph.getNodeCount());
  }
  
  shake(intensity) {
    for (const node of this.graph.nodes()) {
      if (!node.frozen) {
        node.vx += (Math.random() - 0.5) * intensity;
        node.vy += (Math.random() - 0.5) * intensity;
      }
    }
  }
}
