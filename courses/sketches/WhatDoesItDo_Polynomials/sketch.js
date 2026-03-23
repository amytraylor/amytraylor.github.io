let timeStamp = "";
let y, x, a, b, c = 0;
let equation = "";
let range1, range2 = "";
let minX = -25;
let maxX = 25;
let stretch = 5;
let inc = 25;
let sinc = 1;
let rectSize, tS, spacing;
let rightAlign, leftAlign;

function setup() {
  createCanvas(windowWidth, windowHeight, P2D);
  recalc();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  recalc();
}

function recalc() {
  rectSize   = height * 0.05;
  tS         = height * 0.035;
  spacing    = tS * 1.25;
  rightAlign = width * 0.95;
  leftAlign  = width * 0.65;
  drawGraph();
}

function draw() {
  background(0);
  // graph
  push();
  translate(width * 0.33, height * 0.1);
  drawGraph();
  pop();
  
  noStroke();
  // section headers
  fill(255);
  textSize(tS * 1.05);
  spacing = tS * 1.3;
  textAlign(LEFT, CENTER);
  leftAlign  = width * 0.7;
  rightAlign = width * 0.95;

  text("EQUATION",           leftAlign, height * 0.05);
  text("CONTROLS",           leftAlign, height * 0.25);
 // text("RESULTING EQUATION", leftAlign, height * 0.825);

  // presets block
  push();
  translate(0, height * 0.05 + tS * 1.3);
  textSize(tS*0.95);
  textAlign(RIGHT, CENTER);
  text(equation, rightAlign, 0);
  textSize(tS*0.85);
  text(range1,    rightAlign, spacing);
  text(range2,    rightAlign, spacing*2);
  pop();

  // controls block
  textSize(tS * 0.6);
  spacing = tS * 0.6 * 1.1;

  push();
  translate(0, height * 0.25 + tS * 1.15);
  textAlign(RIGHT, CENTER);  
  rightAlign = width * 0.9;
  text(nf(stretch, 1, 0), rightAlign, spacing);  
  text(nf(a, 1, 1),       rightAlign, spacing * 3);
  text(nf(b, 1, 1),       rightAlign, spacing * 6);
  text(nf(c, 1, 1),       rightAlign, spacing * 10);
  text(minX,              rightAlign, spacing * 13);
  text(maxX,              rightAlign, spacing * 16);

  leftAlign = width * 0.75;
  textAlign(LEFT, CENTER);
  text("LEFT/RIGHT ARROWS",     leftAlign, 0);
  text("box stretch value:",    leftAlign, spacing);
  text("MOUSE X:",              leftAlign, spacing * 3);
  text("value of A:",           leftAlign, spacing * 4);
  text("MOUSE Y:",              leftAlign, spacing * 6);
  text("value of B:",           leftAlign, spacing * 7);
  text("UP/DOWN ARROWS",        leftAlign, spacing * 9);
  text("value of C:",           leftAlign, spacing * 10);
  text("Keys W and S",          leftAlign, spacing *12);
  text("value of min X:",       leftAlign, spacing * 13);
  text("Keys A and D",          leftAlign, spacing *15);
  text("value of max X:",       leftAlign, spacing * 16);
  
  fill(255, 0, 0);
  text("Press E to save image", leftAlign, spacing * 17.5);
  pop();

  // resulting equation
  fill(255);
  push();
  translate(0, height * 0.85);
  textSize(tS * 1.3);
  textAlign(RIGHT, CENTER);
  rightAlign = width * 0.95;
  text(
    "y = " + nf(a, 1, 1) + "x\u00B2 + " +
             nf(b, 1, 1) + "x + " +
             nf(c, 1, 1),
    rightAlign, 0
  );
  pop();

}

function drawGraph() {
  equation = "y = ax\u00B2 + bx + c";
  range1 = "minX: " + minX;
  range2 = "maxX: " + maxX;

  a = map(mouseX, 0, width,  -2.0,  2.0);
  b = map(mouseY, 0, height, -20.0, 20.0);

  fill(0);
  stroke(255);
  strokeWeight(3);
  //noStroke();
  for (let i = minX; i < maxX; i++) {
    x = i;
    y = a * pow(x, 2) + b * x + c;
    rect(x * stretch, y, rectSize, rectSize);
  }
}

function keyPressed() {
  if (key === 'e' || key === 'E') {
    timeStamp = year() + "_" + month() + "_" + day() +
                "_" + hour() + "_" + minute() + "_" + second();
    save("polynomials_" + timeStamp + ".png");
    console.log("saved " + timeStamp);
  }
  if (key === 'w' || key === 'W') minX--;
  if (key === 's' || key === 'S') minX++;
  if (key === 'a' || key === 'A') maxX--;
  if (key === 'd' || key === 'D') maxX++;

  if (keyCode === UP_ARROW)    { c += inc; console.log(c); }
  if (keyCode === DOWN_ARROW)  { c -= inc; console.log(c); }
  if (keyCode === LEFT_ARROW)  stretch -= sinc; 
  if (keyCode === RIGHT_ARROW) stretch += sinc;

  if ([UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW].includes(keyCode))
    return false;
}
