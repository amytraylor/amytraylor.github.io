// Basic Shapes - Week 1
// Click to add circles, press any key to regenerate

let shapes = [];

function setup() {
  let canvas = createCanvas(600, 400);
  canvas.parent('canvas-container');
  
  // Generate initial random shapes
  generateShapes();
}

function draw() {
  background(20);
  
  // Draw all shapes
  for (let s of shapes) {
    drawShape(s);
  }
}

function generateShapes() {
  shapes = [];
  
  // Add some random rectangles
  for (let i = 0; i < 5; i++) {
    shapes.push({
      type: 'rect',
      x: random(width),
      y: random(height),
      w: random(30, 100),
      h: random(30, 100),
      color: randomColor()
    });
  }
  
  // Add some random ellipses
  for (let i = 0; i < 5; i++) {
    shapes.push({
      type: 'ellipse',
      x: random(width),
      y: random(height),
      w: random(20, 80),
      h: random(20, 80),
      color: randomColor()
    });
  }
  
  // Add some random lines
  for (let i = 0; i < 8; i++) {
    shapes.push({
      type: 'line',
      x1: random(width),
      y1: random(height),
      x2: random(width),
      y2: random(height),
      color: randomColor()
    });
  }
}

function drawShape(s) {
  if (s.type === 'rect') {
    fill(s.color);
    noStroke();
    rect(s.x, s.y, s.w, s.h, 4);
  } 
  else if (s.type === 'ellipse') {
    fill(s.color);
    noStroke();
    ellipse(s.x, s.y, s.w, s.h);
  }
  else if (s.type === 'line') {
    stroke(s.color);
    strokeWeight(2);
    line(s.x1, s.y1, s.x2, s.y2);
  }
}

function randomColor() {
  // Return a nice semi-transparent color
  colorMode(HSB);
  let c = color(random(360), 70, 90, 0.7);
  colorMode(RGB);
  return c;
}

function mousePressed() {
  // Add a circle where user clicks
  shapes.push({
    type: 'ellipse',
    x: mouseX,
    y: mouseY,
    w: random(30, 60),
    h: random(30, 60),
    color: randomColor()
  });
}

function keyPressed() {
  // Clear and regenerate
  generateShapes();
}
