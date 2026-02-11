(() => {
  const terms = window.__GLOSSARY_TERMS__;
  const defs  = window.__GLOSSARY_DEFS__ || {};
  const glossaryPage = window.__GLOSSARY_PAGE__ || null;

  if (!Array.isArray(terms) || terms.length === 0) return;

  const root =
    document.querySelector(".course-content") ||
    document.querySelector("main") ||
    document.body;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const norm = (s) =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ");

  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  function findDef(term) {
    const t = norm(term);
    const candidates = [
      t,
      t.replace(/\s+/g, "-"),      // "thing power" -> "thing-power"
      t.replace(/-/g, " "),        // "thing-power" -> "thing power"
      t.replace(/\s+/g, ""),       // extreme fallback
    ];

    for (const k of candidates) {
      const v = defs[k];
      if (!v) continue;

      // your data is shaped like { def: "...", see: [...] }
      if (typeof v === "string") return v;
      if (typeof v === "object" && v.def) return v.def;
    }

    // Also handle your “variant” keys if present
    // e.g. "thing-power-space" / "thing-power-variant"
    const variantKeys = [
      `${t.replace(/\s+/g, "-")}-space`,
      `${t.replace(/\s+/g, "-")}-variant`,
    ];
    for (const k of variantKeys) {
      const v = defs[k];
      if (v && typeof v === "object" && v.def) return v.def;
    }

    return "";
  }

  function highlightTerm(term) {
    const trimmed = String(term).trim();
    if (!trimmed) return [];

    const isSingleWord = !trimmed.includes(" ");
    const pattern = isSingleWord ? `\\b${esc(trimmed)}\\b` : esc(trimmed);
    const regex = new RegExp(pattern, "gi");

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest("script, style, pre, code, a, mark")) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;

        // IMPORTANT: reset regex state in case of /g usage
        regex.lastIndex = 0;
        if (!regex.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;

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

      // reset again before replace
      regex.lastIndex = 0;
      text.replace(regex, (m, offset) => {
        if (offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));

        const mark = document.createElement("mark");
        mark.className = "glossary-hit";
        mark.dataset.term = trimmed;
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

  // Highlight all terms; collect occurrences
  const occurrences = new Map();
  for (const t of terms) occurrences.set(t, highlightTerm(t));

  const total = Array.from(occurrences.values()).reduce((a, arr) => a + arr.length, 0);
  if (total === 0) return;

  // Assign IDs for linking
  let idCounter = 0;
  for (const [term, marks] of occurrences.entries()) {
    for (const m of marks) m.id = `g-${slug(term)}-${idCounter++}`;
  }

  // Build always-visible sidebar
  const pop = document.createElement("aside");
  pop.className = "glossary-pop";
  pop.innerHTML = `<h3>Terms on this page</h3>`;
  document.body.appendChild(pop);

  if (glossaryPage) {
    const a = document.createElement("a");
    a.className = "term-glossary-link";
    a.href = glossaryPage;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Open full glossary";
    a.style.display = "block";
    a.style.margin = "0.25rem 0 0.75rem";
    pop.appendChild(a);
  }

  for (const [term, marks] of occurrences.entries()) {
    if (!marks.length) continue;

    const item = document.createElement("div");
    item.className = "glossary-item";

    const row = document.createElement("div");
    row.className = "term-row";

    const name = document.createElement("div");
    name.className = "term-name";
    name.textContent = term;

    const count = document.createElement("div");
    count.className = "term-count";
    count.textContent = `(${marks.length})`;

    row.appendChild(name);
    row.appendChild(count);

    const def = document.createElement("div");
    def.className = "term-def";
    const d = findDef(term);
    def.textContent = d ? d : "No definition found yet.";

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

    row.addEventListener("click", () => item.classList.toggle("is-open"));

    item.appendChild(row);
    item.appendChild(def);
    item.appendChild(ul);
    pop.appendChild(item);
  }
})();
