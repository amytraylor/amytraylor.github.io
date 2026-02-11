(() => {
  const terms = window.__GLOSSARY_TERMS__;
  const defs  = window.__GLOSSARY_DEFS__ || {};
  const glossaryPage = window.__GLOSSARY_PAGE__ || "";

  if (!Array.isArray(terms) || terms.length === 0) return;

  const root =
    document.querySelector(".course-content") ||
    document.querySelector("main") ||
    document.body;

  const escReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const slug = (s) =>
    String(s).trim().toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  function highlightTerm(term) {
    const isSingleWord = !term.trim().includes(" ");
    const pattern = isSingleWord ? `\\b${escReg(term)}\\b` : escReg(term);
    const regex = new RegExp(pattern, "gi");

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest("script, style, pre, code, a, mark")) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !regex.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
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

      text.replace(regex, (m, offset) => {
        if (offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));

        const mark = document.createElement("mark");
        mark.className = "glossary-hit";
        mark.dataset.term = term;
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

  // Highlight all terms; collect all occurrences
  const occurrences = new Map();
  for (const t of terms) occurrences.set(t, highlightTerm(t) || []);
  const total = Array.from(occurrences.values()).reduce((a, arr) => a + arr.length, 0);
  if (total === 0) return;

  // Assign IDs for linking
  let idCounter = 0;
  for (const [term, marks] of occurrences.entries()) {
    for (const m of marks) m.id = `g-${slug(term)}-${idCounter++}`;
  }

  // Build always-visible sidebar (collapsed terms)
  const pop = document.createElement("aside");
  pop.className = "glossary-pop";
  pop.innerHTML = `<h3>Terms on this page</h3>`;
  document.body.appendChild(pop);

  for (const [term, marks] of occurrences.entries()) {
    if (!marks.length) continue;

    const key = slug(term);
    const entry = defs[key]; // defs are keyed by slug in your JSON output
    const defText = entry && entry.def ? entry.def : "";

    const item = document.createElement("div");
    item.className = "glossary-item";

    const row = document.createElement("div");
    row.className = "term-row";
    row.innerHTML = `
      <span class="term-name">${term}</span>
      <span class="term-count">${marks.length}</span>
    `;

    // Definition block (THIS is what you were missing)
    const def = document.createElement("div");
    def.className = "term-def";
    def.textContent = defText || "No definition yet.";

    // Optional link to glossary page (if you make one later)
    if (glossaryPage) {
      const a = document.createElement("a");
      a.className = "term-glossary-link";
      a.href = glossaryPage + "#" + key;
      a.textContent = "Open glossary";
      a.style.display = "inline-block";
      a.style.marginLeft = "0.35rem";
      def.appendChild(document.createTextNode(" "));
      def.appendChild(a);
    }

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

    row.addEventListener("click", () => {
      item.classList.toggle("is-open");
    });

    item.appendChild(row);
    item.appendChild(def);
    item.appendChild(ul);
    pop.appendChild(item);
  }
})();
