const params = {
  nx:    { label: "Term 1 x", val: 8,  min: 0, max: 16 },
  ny:    { label: "Term 1 y", val: 8,  min: 0, max: 16 },
  jx:    { label: "Term 2 x", val: 6,  min: 0, max: 16 },
  jy:    { label: "Term 2 y", val: 6,  min: 0, max: 16 },
  kx:    { label: "Term 3 x", val: 8,  min: 0, max: 16 },
  ky:    { label: "Term 3 y", val: 8,  min: 0, max: 16 },
  vx:    { label: "Term 4 x", val: 3,  min: 1, max: 16 },
  vy:    { label: "Term 4 y", val: 3,  min: 1, max: 16 },
  scale:    { label: "Scale",     val: 20, min: 5, max: 50 },
  rectSize: { label: "Rect Size", val: 5,  min: 1, max: 50 }
};

function getVals() {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.val]));
}

function updateEquations() {
  const { nx, ny, jx, jy, kx, ky, vx, vy } = getVals();
  document.getElementById("eq1").textContent =
    `x = ${nx}*cos(t) - ${jx}*cos((${kx}*t)/${vx})`;
  document.getElementById("eq2").textContent =
    `y = ${ny}*sin(t) - ${jy}*sin((${ky}*t)/${vy})`;
}

function buildControls() {
  const container = document.getElementById("sliders");

  const eqDiv = document.createElement("div");
  eqDiv.style.cssText = "margin-bottom:1rem;font-family:monospace;font-size:11px;color:#aaa;line-height:1.8;";
  eqDiv.innerHTML = '<div id="eq1"></div><div id="eq2"></div>';
  container.appendChild(eqDiv);

  Object.entries(params).forEach(([key, p]) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px;";

    const lbl = document.createElement("label");
    lbl.textContent = p.label;
    lbl.style.cssText = "min-width:80px;font-size:11px;color:#888;font-family:monospace;";

    const sl = document.createElement("input");
    sl.type  = "range";
    sl.min   = p.min;
    sl.max   = p.max;
    sl.step  = 1;
    sl.value = p.val;
    sl.style.flex = "1";

    const valSpan = document.createElement("span");
    valSpan.textContent = p.val;
    valSpan.style.cssText = "min-width:24px;text-align:right;font-size:12px;color:#fff;font-family:monospace;";

    sl.oninput = () => {
      p.val = +sl.value;
      valSpan.textContent = sl.value;
      updateEquations();
      drawCurve();
    };

    row.append(lbl, sl, valSpan);
    container.appendChild(row);
  });
}

function timestamp() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth()+1, d.getDate(),
          d.getHours(), d.getMinutes(), d.getSeconds()].join("_");
}

function drawCurve() {
  const { nx, ny, jx, jy, kx, ky, vx, vy, scale: m, rectSize: sq } = getVals();

  background(10);
  push();
  translate(width / 2, height / 2);
  //noStroke();
  stroke(1);
  fill(255);

  for (let t = 0; t < 1000; t += 0.1) {
    const x = nx * cos(t) - jx * cos((kx * t) / vx);
    const y = ny * sin(t) - jy * sin((ky * t) / vy);
    rect(x * m, y * m, sq, sq);
  }
  text(`x = ${nx}*cos(t) - ${jx}*cos((${kx}*t)/${vx})`, 0, 0);  
  text(`y = ${ny}*sin(t) - ${jy}*sin((${ky}*t)/${vy})`, 0, 100);
  pop();
}

function setup() {
  const size = min(windowWidth - 340, windowHeight - 40, 800);
  const cnv = createCanvas(size, size, P2D);
  cnv.parent("canvas-container");
  noLoop();

  // Inject sliders div into the info sidebar then populate it
  const infoPanel = document.querySelector(".info");
  const slidersDiv = document.createElement("div");
  slidersDiv.id = "sliders";
  infoPanel.insertBefore(slidersDiv, infoPanel.firstChild);

  buildControls();
  updateEquations();

  drawCurve();
}

function mousePressed() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    drawCurve();
  }
}

function keyPressed() {
  if (key === "e" || key === "E") {
    save("parametric_" + timestamp() + ".png");
  }
}
