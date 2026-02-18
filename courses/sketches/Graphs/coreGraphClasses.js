// coreGraphClasses.js - Graph, GraphNode, GraphEdge

class GraphNode {
  constructor(graph, id, index) {
    this.graph = graph;
    this.id = id;
    this.index = index;
    this.edges = [];
    this.attributes = new Map();
    this.x = (Math.random() - 0.5) * 400;
    this.y = (Math.random() - 0.5) * 400;
    this.vx = 0;
    this.vy = 0;
    this.frozen = false;
  }
  
  getDegree() { return this.edges.length; }
  
  getEdgeBetween(other) {
    return this.edges.find(e => e.getOpposite(this) === other) || null;
  }
  
  getAttribute(key) { return this.attributes.get(key) || null; }
  setAttribute(key, value) { this.attributes.set(key, value); return this; }
  
  getLabel() {
    const label = this.attributes.get('ui.label');
    return label !== null && label !== undefined ? String(label) : this.id;
  }
  
  freeze() { this.frozen = true; }
  unfreeze() { this.frozen = false; }
}

class GraphEdge {
  constructor(id, source, target, directed, index) {
    this.id = id;
    this.source = source;
    this.target = target;
    this.directed = directed;
    this.index = index;
    this.attributes = new Map();
  }
  
  getOpposite(node) {
    if (node === this.source) return this.target;
    if (node === this.target) return this.source;
    return null;
  }
  
  getAttribute(key) { return this.attributes.get(key) || null; }
  setAttribute(key, value) { this.attributes.set(key, value); return this; }
  
  getLabel() {
    const label = this.attributes.get('ui.label');
    return label ? String(label) : '';
  }
}

class Graph {
  constructor(id, strictChecking = true, autoCreate = false, allowMultiEdges = false) {
    this.id = id;
    this.strictChecking = strictChecking;
    this.autoCreate = autoCreate;
    this.allowMultiEdges = allowMultiEdges;
    this.nodeMap = new Map();
    this.edgeMap = new Map();
    this.nodeList = [];
    this.edgeList = [];
    this.nodeCounter = 0;
    this.edgeCounter = 0;
  }
  
  addNode(id) {
    if (id === undefined) id = 'n' + (this.nodeCounter++);
    let node = this.nodeMap.get(id);
    if (node) return node;
    node = new GraphNode(this, id, this.nodeList.length);
    this.nodeMap.set(id, node);
    this.nodeList.push(node);
    return node;
  }
  
  getNode(id) {
    if (typeof id === 'number') return this.nodeList[id];
    return this.nodeMap.get(id) || null;
  }
  
  getNodeCount() { return this.nodeList.length; }
  
  removeNode(id) {
    const node = typeof id === 'string' ? this.nodeMap.get(id) : id;
    if (!node) return null;
    
    const edgesToRemove = [...node.edges];
    for (const e of edgesToRemove) {
      this.removeEdge(e);
    }
    
    this.nodeMap.delete(node.id);
    const idx = this.nodeList.indexOf(node);
    if (idx >= 0) {
      this.nodeList.splice(idx, 1);
      for (let i = idx; i < this.nodeList.length; i++) {
        this.nodeList[i].index = i;
      }
    }
    return node;
  }
  
  addEdge(id, from, to, directed = false) {
    if (id === undefined) id = 'e' + (this.edgeCounter++);
    if (this.edgeMap.has(id)) return this.edgeMap.get(id);
    
    let src = typeof from === 'string' ? this.getNode(from) : from;
    let dst = typeof to === 'string' ? this.getNode(to) : to;
    
    if (!src && this.autoCreate) src = this.addNode(from);
    if (!dst && this.autoCreate) dst = this.addNode(to);
    if (!src || !dst) return null;
    
    if (!this.allowMultiEdges && src.getEdgeBetween(dst)) return null;
    
    const edge = new GraphEdge(id, src, dst, directed, this.edgeList.length);
    this.edgeMap.set(id, edge);
    this.edgeList.push(edge);
    src.edges.push(edge);
    if (src !== dst) dst.edges.push(edge);
    
    return edge;
  }
  
  getEdge(id) {
    if (typeof id === 'number') return this.edgeList[id];
    return this.edgeMap.get(id) || null;
  }
  
  getEdgeCount() { return this.edgeList.length; }
  
  removeEdge(id) {
    const edge = typeof id === 'string' ? this.edgeMap.get(id) : id;
    if (!edge) return null;
    
    let idx = edge.source.edges.indexOf(edge);
    if (idx >= 0) edge.source.edges.splice(idx, 1);
    if (edge.source !== edge.target) {
      idx = edge.target.edges.indexOf(edge);
      if (idx >= 0) edge.target.edges.splice(idx, 1);
    }
    
    this.edgeMap.delete(edge.id);
    idx = this.edgeList.indexOf(edge);
    if (idx >= 0) {
      this.edgeList.splice(idx, 1);
      for (let i = idx; i < this.edgeList.length; i++) {
        this.edgeList[i].index = i;
      }
    }
    return edge;
  }
  
  nodes() { return this.nodeList; }
  edges() { return this.edgeList; }
  
  clear() {
    this.nodeMap.clear();
    this.edgeMap.clear();
    this.nodeList = [];
    this.edgeList = [];
  }
}
