/* assets/js/glossary-pop.js
   Canonical glossary + variants + highlighting controls (clean version)

   Inputs (set in your layout):
   - window.__GLOSSARY_TERMS__ : array of CANONICAL terms for this page
   - window.__GLOSSARY_DEFS__  : object from site.data.glossary (keys typically lowercase)
       Each entry can include:
         def: "..."
         see: ["..."]
         variants: ["plural", "alt spelling", ...]
   - window.__GLOSSARY_PAGE__  : optional URL to a glossary page (leave "" to disable)

   Behavior:
   - Highlights canonical terms AND any variants listed in defs[term].variants
   - Sidebar shows one item per canonical term
   - Click term row to expand (definition + occurrences). Accordion behavior (one open at a time)
   - Highlight controls:
       (1) Toggle all highlighting on/off
       (2) Focus mode: only highlight the selected term (selected = last clicked in sidebar)
*/

(() => {
  const canonicalTerms = window.__GLOSSARY_TERMS__;
  if (!Array.isArray(canonicalTerms) || canonicalTerms.length === 0) return;

  const defs = window.__GLOSSARY_DEFS__ || {};
  // const glossaryPage = (window.__GLOSSARY_PAGE__ || "").trim(); // currently unused (kept for future)

  const root =
    document.querySelector(".course-content") ||
    document.querySelector("main") ||
    document.body;

  // -----------------------------
  // Small utilities
  // -----------------------------
  const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const slug = (s) =>
    String(s)
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  function getEntry(term) {
    const key = String(term).toLowerCase();
    return defs[key] || defs[term] || null;
  }

  // -----------------------------
  // Settings (persisted)
  // -----------------------------
  const STORE_KEY = "glossary_settings_v1";

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return {
        highlightAll: s.highlightAll !== false, // default true
        focusMode: !!s.focusMode,
        activeCanon: typeof s.activeCanon === "string" ? s.activeCanon : "",
      };
    } catch {
      return { highlightAll: true, focusMode: false, activeCanon: "" };
    }
  }

  function saveSettings(s) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  const settings = loadSettings();

  function applyHighlightState() {
    document.body.classList.toggle("glossary_highlight_off", !settings.highlightAll);
    document.body.classList.toggle("glossary_focus_mode", settings.focusMode);

    // Clear active flags
    root.querySelectorAll("mark.glossary-hit.is-active").forEach((m) => m.classList.remove("is-active"));

    if (settings.focusMode && settings.activeCanon) {
      root
        .querySelectorAll(`mark.glossary-hit[data-term="${cssEscape(settings.activeCanon)}"]`)
        .forEach((m) => m.classList.add("is-active"));
    }
  }

  // Minimal CSS.escape fallback (covers quotes/backslashes safely for our use)
  function cssEscape(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  // -----------------------------
  // Build lookup: canonical -> [canonical + variants]
  // -----------------------------
  const groups = [];
  for (const canonRaw of canonicalTerms) {
    const canon = String(canonRaw).trim();
    if (!canon) continue;

    const entry = getEntry(canon);
    const variants = Array.isArray(entry?.variants) ? entry.variants : [];

    const all = [canon, ...variants]
      .map((x) => String(x).trim())
      .filter(Boolean);

    const seen = new Set();
    const phrases = [];
    for (const p of all) {
      const k = p.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        phrases.push(p);
      }
    }

    groups.push({ canonical: canon, phrases });
  }

  if (groups.length === 0) return;

  // -----------------------------
  // Highlighting engine:
  // wraps matched phrases in <mark class="glossary-hit" data-term="<canonical>">...</mark>
  // -----------------------------
  function highlightPhrase(phrase, canonical) {
    const p = String(phrase).trim();
    if (!p) return [];

    const isSingleWord = !p.includes(" ");
    const pattern = isSingleWord ? `\\b${escRe(p)}\\b` : escRe(p);
    const regex = new RegExp(pattern, "gi");

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;

        // Don't highlight inside these contexts
        if (el.closest("script, style, pre, code, a, mark, .glossary-pop")) return NodeFilter.FILTER_REJECT;

        const text = node.nodeValue;
        if (!text) return NodeFilter.FILTER_REJECT;

        regex.lastIndex = 0;
        if (!regex.test(text)) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    const hits = [];
    for (const textNode of nodes) {
      const text = textNode.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0;

      regex.lastIndex = 0;
      text.replace(regex, (m, offset) => {
        if (offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));

        const mark = document.createElement("mark");
        mark.className = "glossary-hit";
        mark.dataset.term = canonical; // tag with CANONICAL
        mark.textContent = m;
        frag.appendChild(mark);

        hits.push(mark);
        last = offset + m.length;
        return m;
      });

      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }

    return hits;
  }

  // 1) Highlight everything, collect marks per canonical
  const occurrences = new Map(); // canonical -> marks[]
  for (const g of groups) occurrences.set(g.canonical, []);

  for (const g of groups) {
    const bucket = occurrences.get(g.canonical);
    for (const phrase of g.phrases) {
      const hits = highlightPhrase(phrase, g.canonical);
      bucket.push(...hits);
    }
  }

  const total = Array.from(occurrences.values()).reduce((a, arr) => a + arr.length, 0);
  if (total === 0) return;

  // 2) Assign IDs for each hit
  let idCounter = 0;
  for (const [canon, marks] of occurrences.entries()) {
    const base = slug(canon) || "term";
    for (const m of marks) m.id = `g-${base}-${idCounter++}`;
  }

  // If focus mode is enabled but no active term selected, pick the first term with hits
  if (settings.focusMode && !settings.activeCanon) {
    const first = groups.find((g) => (occurrences.get(g.canonical) || []).length > 0);
    settings.activeCanon = first ? first.canonical : "";
    saveSettings(settings);
  }

  // -----------------------------
  // Sidebar (floating panel)
  // -----------------------------
  const pop = document.createElement("aside");
  pop.className = "glossary-pop";
  pop.innerHTML = `
    <h3>Terms on this page</h3>
    <div class="glossary-controls">
      <label class="glossary-control">
        <input type="checkbox" class="glossary-toggle-all">
        <span>Highlight terms</span>
      </label>
      <label class="glossary-control">
        <input type="checkbox" class="glossary-toggle-focus">
        <span>Focus highlight (only selected term)</span>
      </label>
    </div>
  `;
  document.body.appendChild(pop);

  // Controls wiring (no extra CSS required; your CSS can style .glossary-controls if desired)
  const elAll = pop.querySelector(".glossary-toggle-all");
  const elFocus = pop.querySelector(".glossary-toggle-focus");

  elAll.checked = settings.highlightAll;
  elFocus.checked = settings.focusMode;

  elAll.addEventListener("change", () => {
    settings.highlightAll = !!elAll.checked;
    saveSettings(settings);
    applyHighlightState();
  });

  elFocus.addEventListener("change", () => {
    settings.focusMode = !!elFocus.checked;
    if (settings.focusMode && !settings.activeCanon) {
      const first = groups.find((g) => (occurrences.get(g.canonical) || []).length > 0);
      settings.activeCanon = first ? first.canonical : "";
    }
    saveSettings(settings);
    applyHighlightState();
  });

  function defTextFor(canon) {
    const entry = getEntry(canon) || getEntry(canon.toLowerCase());
    return entry?.def ? String(entry.def) : "";
  }

  // 4) Render accordion items
  for (const g of groups) {
    const canon = g.canonical;
    const marks = occurrences.get(canon) || [];
    if (marks.length === 0) continue;

    const item = document.createElement("div");
    item.className = "glossary-item";

    const row = document.createElement("div");
    row.className = "term-row";

    const name = document.createElement("span");
    name.className = "term-name";
    name.textContent = canon;

    const count = document.createElement("span");
    count.className = "term-count";
    count.textContent = marks.length;

    row.appendChild(name);
    row.appendChild(count);
    item.appendChild(row);

    const def = document.createElement("div");
    def.className = "term-def";
    const dt = defTextFor(canon);
    def.textContent = dt || "(No definition yet)";
    item.appendChild(def);

    const ul = document.createElement("ul");
    ul.className = "occurrences";

    marks.forEach((m, idx) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${m.id}`;
      a.textContent = `Occurrence ${idx + 1}`;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        m.scrollIntoView({ behavior: "smooth", block: "center" });
        m.style.outline = "2px solid var(--accent)";
        setTimeout(() => (m.style.outline = ""), 700);
        history.replaceState(null, "", `#${m.id}`);
      });
      li.appendChild(a);
      ul.appendChild(li);
    });

    item.appendChild(ul);

    // Accordion toggle (one open at a time) + set active term for focus mode
    row.addEventListener("click", () => {
      settings.activeCanon = canon;
      saveSettings(settings);
      applyHighlightState();

      const wasOpen = item.classList.contains("is-open");
      pop.querySelectorAll(".glossary-item.is-open").forEach((el) => el.classList.remove("is-open"));
      if (!wasOpen) item.classList.add("is-open");
    });

    pop.appendChild(item);
  }

  // Apply initial highlighting state once everything exists
  applyHighlightState();
})();
