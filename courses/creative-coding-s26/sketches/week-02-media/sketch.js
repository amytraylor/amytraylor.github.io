// Image & Download - Week 2
// Load an image, apply filters, save the result

let img;
let currentFilter = 'none';

function preload() {
  // Load image from assets folder
  // If no image exists, we'll generate a placeholder
  img = loadImage('assets/sample.jpg', 
    () => console.log('Image loaded'),
    () => {
      console.log('No image found, generating placeholder');
      img = null;
    }
  );
}

function setup() {
  let canvas = createCanvas(600, 400);
  canvas.parent('canvas-container');
  pixelDensity(1);
}

function draw() {
  background(30);
  
  if (img) {
    // Draw the original image, scaled to fit
    push();
    imageMode(CENTER);
    
    // Calculate scale to fit canvas while maintaining aspect ratio
    let scale = min(width / img.width, height / img.height) * 0.9;
    let w = img.width * scale;
    let h = img.height * scale;
    
    // Draw image
    image(img, width/2, height/2, w, h);
    pop();
    
    // Apply selected filter
    applyFilter();
  } else {
    // Generate a placeholder pattern if no image loaded
    drawPlaceholder();
    applyFilter();
  }
  
  // Show current filter name
  fill(255);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(14);
  text('Filter: ' + currentFilter, 10, 10);
  
  // Show mouse position hint
  textAlign(LEFT, BOTTOM);
  textSize(12);
  fill(200);
  text('Move mouse horizontally to adjust intensity', 10, height - 10);
}

function applyFilter() {
  // Use mouse X position to control intensity where applicable
  let intensity = map(mouseX, 0, width, 0, 1);
  
  switch(currentFilter) {
    case 'invert':
      filter(INVERT);
      break;
    case 'gray':
      filter(GRAY);
      break;
    case 'threshold':
      filter(THRESHOLD, intensity);
      break;
    case 'posterize':
      let levels = floor(map(intensity, 0, 1, 2, 10));
      filter(POSTERIZE, levels);
      break;
    case 'blur':
      let blurAmt = map(intensity, 0, 1, 0, 6);
      filter(BLUR, blurAmt);
      break;
    default:
      // No filter
      break;
  }
}

function drawPlaceholder() {
  // Create a colorful gradient pattern as placeholder
  loadPixels();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let idx = (x + y * width) * 4;
      
      // Create a gradient pattern
      let r = sin(x * 0.02) * 127 + 128;
      let g = sin(y * 0.02 + 2) * 127 + 128;
      let b = sin((x + y) * 0.01 + 4) * 127 + 128;
      
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
  updatePixels();
}

// Export data function (for data export button if needed)
function exportData() {
  // Example: save current filter settings as JSON
  let data = {
    filter: currentFilter,
    intensity: map(mouseX, 0, width, 0, 1),
    timestamp: new Date().toISOString()
  };
  saveJSON(data, 'filter-settings.json');
}
