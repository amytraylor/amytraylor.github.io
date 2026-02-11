(() => {
  const terms = window.__GLOSSARY_TERMS__;
  if (!Array.isArray(terms) || terms.length === 0) return;

  const root =
    document.querySelector(".course-content") ||
    document.querySelector("main") ||
    document.body;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function highlightTerm(term) {
    // Match whole words when term is a single word; allow spaces/hyphens in phrases
    const isSingleWord = !term.trim().includes(" ");
    const pattern = isSingleWord ? `\\b${esc(term)}\\b` : esc(term);
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
    for (const m of marks) m.id = `g-${esc(term).toLowerCase()}-${idCounter++}`;
  }

  // Build always-visible sidebar
  const pop = document.createElement("aside");
  pop.className = "glossary-pop";
  pop.innerHTML = `<h3>Terms on this page</h3>`;
  document.body.appendChild(pop);

  for (const [term, marks] of occurrences.entries()) {
    if (!marks.length) continue;

    const heading = document.createElement("div");
    heading.className = "term";
    heading.textContent = `${term} (${marks.length})`;
    pop.appendChild(heading);
    

    const ul = document.createElement("ul");
    pop.appendChild(ul);

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
  }
})();
