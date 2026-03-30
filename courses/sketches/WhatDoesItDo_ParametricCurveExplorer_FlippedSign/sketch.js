// +1 = addition (epitrochoid family), -1 = subtraction (hypotrochoid family)
let signX = -1;
let signY = -1;

const params = {
  nx:    { label: "Term 1 x", val: 8,  min: 0, max: 16 },
  ny:    { label: "Term 1 y", val: 8,  min: 0, max: 16 },
  jx:    { label: "Term 2 x", val: 6,  min: 0, max: 16 },
  jy:    { label: "Term 2 y", val: 6,  min: 0, max: 16 },
  kx:    { label: "Term 3 x", val: 8,  min: 0, max: 16 },
  ky:    { label: "Term 3 y", val: 8,  min: 0, max: 16 },
  vx:    { label: "Term 4 x", val: 3,  min: 1, max: 16 },
  vy:    { label: "Term 4 y", val: 3,  min: 1, max: 16 },
  scale:      { label: "Scale",       val: 20,   min: 5,   max: 50    },
  boxSize:    { label: "Box Size",    val: 5,    min: 1,   max: 50    },
  maxBoxes:   { label: "Max # Boxes", val: 1000, min: 100, max: 2000, step: 100 },
  boxSpacing: { label: "Box Spacing", val: 10,   min: 1,   max: 100, step: 10 }
};

function getVals() {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.val]));
}

function updateEquations() {
  const { nx, ny, jx, jy, kx, ky, vx, vy } = getVals();
  const sx = signX === 1 ? "+" : "−";
  const sy = signY === 1 ? "+" : "−";
  document.getElementById("eq1").textContent =
    `x = ${nx}·cos(t) ${sx} ${jx}·cos((${kx}·t)/${vx})`;
  document.getElementById("eq2").textContent =
    `y = ${ny}·sin(t) ${sy} ${jy}·sin((${ky}·t)/${vy})`;
  updateFamilyLabel();
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
    sl.step  = p.step || 1;
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

  // Sign toggles
  const toggleSection = document.createElement("div");
  toggleSection.style.cssText = "margin-top:1rem;padding-top:0.75rem;border-top:1px solid #333;";

  [["signX", "X sign"], ["signY", "Y sign"]].forEach(([id, label]) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";

    const lbl = document.createElement("span");
    lbl.textContent = label;
    lbl.style.cssText = "min-width:80px;font-size:11px;color:#888;font-family:monospace;";

    const btnMinus = document.createElement("button");
    btnMinus.textContent = "−";
    btnMinus.dataset.id = id;
    btnMinus.dataset.val = "-1";

    const btnPlus = document.createElement("button");
    btnPlus.textContent = "+";
    btnPlus.dataset.id = id;
    btnPlus.dataset.val = "1";

    const btnStyle = "padding:2px 10px;font-size:13px;font-family:monospace;cursor:pointer;border-radius:3px;border:1px solid #555;background:#222;color:#fff;";
    btnMinus.style.cssText = btnStyle;
    btnPlus.style.cssText  = btnStyle;

    function updateToggle() {
      const current = id === "signX" ? signX : signY;
      btnMinus.style.background = current === -1 ? "#2563eb" : "#222";
      btnPlus.style.background  = current ===  1 ? "#2563eb" : "#222";
    }

    [btnMinus, btnPlus].forEach(btn => {
      btn.onclick = () => {
        const val = parseInt(btn.dataset.val);
        if (btn.dataset.id === "signX") signX = val;
        else signY = val;
        updateToggle();
        updateEquations();
        drawCurve();
      };
    });

    updateToggle();
    row.append(lbl, btnMinus, btnPlus);
    toggleSection.appendChild(row);
  });

  container.appendChild(toggleSection);
}

function timestamp() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth()+1, d.getDate(),
          d.getHours(), d.getMinutes(), d.getSeconds()].join("_");
}

function updateFamilyLabel() {
  const el = document.getElementById("family-label");
  if (!el) return;
  const families = {
    "--": { name: "Hypotrochoid", desc: "Both terms subtract — point on a circle rolling inside another circle. Classic spirograph inner curves." },
    "+-": { name: "Hybrid (epi-x / hypo-y)", desc: "X uses addition, Y subtraction. Not a standard named family — produces asymmetric, exotic forms." },
    "-+": { name: "Hybrid (hypo-x / epi-y)", desc: "X uses subtraction, Y addition. Mirror-asymmetric hybrid family." },
    "++": { name: "Epitrochoid", desc: "Both terms add — point on a circle rolling outside another circle. Classic spirograph outer curves and rose curves." }
  };
  const key = (signX === -1 ? "-" : "+") + (signY === -1 ? "-" : "+");
  const f = families[key];
  el.querySelector(".family-name").textContent = f.name;
  el.querySelector(".family-desc").textContent = f.desc;
}

function drawCurve() {
  const { nx, ny, jx, jy, kx, ky, vx, vy, scale: m, boxSize: sq, maxBoxes, boxSpacing: rawSpacing } = getVals();
  const spacing = rawSpacing / 1000.0;

  background(10);
  push();
  translate(width / 2, height / 2);
  stroke(1);
  fill(255);

  for (let t = 0; t < maxBoxes; t += spacing) {
    const x = nx * cos(t) + signX * jx * cos((kx * t) / vx);
    const y = ny * sin(t) + signY * jy * sin((ky * t) / vy);
    rect(x * m, y * m, sq, sq);
  }

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
