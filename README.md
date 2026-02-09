# Site Repository

A Jekyll-based personal site with academic profile, artist portfolio, and course hosting with p5.js sketches.

## Quick Start

### Option 1: GitHub Pages (recommended)

1. Create a new repository on GitHub
2. Push this folder to the repo:
   ```bash
   git init
   git add .
   git commit -m "Initial site"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Go to repo Settings → Pages → Source: Deploy from branch `main`
4. Site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/`

### Option 2: Custom Domain

1. Edit `CNAME` to contain your domain (e.g., `gregkrueger.com`)
2. Push to GitHub as above
3. Configure your DNS:
   - Add A records pointing to GitHub's IPs:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - Or add a CNAME record: `YOUR_REPO.github.io`
4. In repo Settings → Pages, enter your custom domain
5. Enable "Enforce HTTPS"

### Local Development

```bash
# Install Jekyll (one time)
gem install bundler jekyll

# Run locally
bundle install
bundle exec jekyll serve

# View at http://localhost:4000
```

## Structure

```
.
├── _config.yml          # Site configuration
├── _layouts/            # HTML templates
├── assets/
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript
│   └── images/         # Site images
├── index.md            # Homepage
├── about.md            # About page
├── work/               # Portfolio
├── courses/            # Course materials
│   └── creative-coding-s26/
│       ├── index.md    # Course overview
│       ├── syllabus.md
│       ├── schedule.md
│       └── sketches/   # p5.js examples
│           └── week-01-intro/
│               ├── index.html
│               ├── sketch.js
│               └── assets/  # Sketch-specific media
└── CNAME               # Custom domain (edit or delete)
```

## Adding Content

### New Portfolio Item

Edit `work/index.md` and add to the grid:

```html
<a href="/work/project-name/" class="work-item">
  <img src="/assets/images/project-thumb.jpg" alt="Project">
  <div class="work-item-info">
    <h3>Project Title</h3>
    <p>Description</p>
  </div>
</a>
```

### New Course

1. Copy the `courses/creative-coding-s26/` folder
2. Rename and edit the markdown files
3. Add to `courses/index.md`

### New Sketch

1. Create folder: `courses/YOUR_COURSE/sketches/week-XX-topic/`
2. Add `index.html` (copy from existing sketch)
3. Add `sketch.js` with your p5.js code
4. Add `assets/` folder for images/sounds/etc.
5. Update the sketches index page

## p5.js in Sketches

Sketches are standalone HTML pages that load p5.js from CDN. Each sketch folder contains:

- `index.html` - Page structure and UI
- `sketch.js` - Your p5.js code
- `assets/` - Media files (images, sounds, etc.)

### Loading Assets

```javascript
function preload() {
  img = loadImage('assets/photo.jpg');
  snd = loadSound('assets/sound.mp3');
}
```

### Saving Output

```javascript
// Save canvas as image
saveCanvas('filename', 'png');

// Save data as JSON
saveJSON(dataObject, 'data.json');

// Save text
saveStrings(['line1', 'line2'], 'output.txt');
```

### Adding Libraries

In your sketch's `index.html` head:

```html
<script src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/addons/p5.sound.min.js"></script>
<!-- Add more libraries as needed -->
<script src="https://unpkg.com/ml5@latest/dist/ml5.min.js"></script>
```

## Notes

- Large files (>100MB) won't work on GitHub. Host video/audio elsewhere if needed.
- GitHub Pages soft limit is 1GB per repo.
- Sketches run client-side only—no server-side code possible.
