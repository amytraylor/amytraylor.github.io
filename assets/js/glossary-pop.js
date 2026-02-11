/* assets/js/glossary-pop.js
   Builds an always-available right-side glossary panel:
   - Highlights all terms on the page
   - Creates a collapsed/accordion list of terms
   - Clicking a term shows definition + occurrences (only one open at a time)
   - Clicking an occurrence scrolls to it and briefly outlines it
*/

(() => {
  const terms = window.__GLOSSARY_TERMS__;
  if (!Array.isArray(terms) || terms.length === 0) return;

  const defs = window.__GLOSSARY_DEFS__ || {};
  const glossaryPage = window.__GLOSSARY_PAGE__ || "";

  const root =
    document.querySelector(".course-content") ||
    document.querySelector("main") ||
    document.body;

  // Escape for RegExp patterns (NOT for ids)
  const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Make a safe-ish id slug
  const slug = (s) =>
    String(s)
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  function highlightTerm(term) {
    const t = String(term || "").trim();
    if (!t) return [];

    // Whole words for single words; phrases match as-is (case-insensitive)
    const isSingleWord = !t.includes(" ");
    const pattern = isSingleWord ? `\\b${escRe(t)}\\b` : escRe(t);
    const regex = new RegExp(pattern, "gi");

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        // don't highlight inside these tags
        if (p.closest("script, style, pre, code, a, mark")) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
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

      regex.lastIndex = 0;
      text.replace(regex, (m, offset) => {
        if (offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));

        const mark = document.createElement("mark");
        mark.className = "glossary-hit";
        mark.dataset.term = t;
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

  // 1) Highlight all terms and collect occurrences
  const occurrences = new Map();
  for (const t of terms) occurrences.set(String(t), highlightTerm(String(t)));

  const total = Array.from(occurrences.values()).reduce((a, arr) => a + (arr?.length || 0), 0);
  if (total === 0) return;

  // 2) Assign IDs for each hit so we can deep-link
  let idCounter = 0;
  for (const [term, marks] of occurrences.entries()) {
    const base = slug(term) || "term";
    for (const m of marks) {
      m.id = `g-${base}-${idCounter++}`;
    }
  }

  // 3) Build always-visible sidebar panel
  const pop = document.createElement("aside");
  pop.className = "glossary-pop";
  pop.innerHTML = `<h3>Terms on this page</h3>`;
  document.body.appendChild(pop);

  // Helper to find a definition entry
  function getDef(term) {
    const k = String(term).toLowerCase();
    return defs[k] || defs[term] || null;
  }

  // 4) Render each term as a collapsible item
  for (const [term, marks] of occurrences.entries()) {
    if (!marks || marks.length === 0) continue;

    const entry = getDef(term);
    const defText = entry?.def ? String(entry.def) : "";

    const item = document.createElement("div");
    item.className = "glossary-item";

    const row = document.createElement("div");
    row.className = "term-row";

    const name = document.createElement("span");
    name.className = "term-name";
    name.textContent = term;

    const count = document.createElement("span");
    count.className = "term-count";
    count.textContent = marks.length;

    row.appendChild(name);
    row.appendChild(count);
    item.appendChild(row);

    // Definition block
    const def = document.createElement("div");
    def.className = "term-def";
    if (defText) {
      def.appendChild(document.createTextNode(defText));
    } else {
      def.appendChild(document.createTextNode("(No definition yet)"));
    }

    if (glossaryPage) {
      const key = slug(term) || encodeURIComponent(String(term).toLowerCase());
      const a = document.createElement("a");
      a.className = "term-glossary-link";
      a.href = `${glossaryPage}#${key}`;
      a.textContent = "Open glossary";
      a.style.display = "inline-block";
      a.style.marginLeft = "0.35rem";
      def.appendChild(document.createElement("br"));
      def.appendChild(a);
    }

    item.appendChild(def);

    // Occurrence list (collapsed by CSS unless .is-open)
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

    // Accordion toggle: only one open at a time
    row.addEventListener("click", () => {
      const wasOpen = item.classList.contains("is-open");
      pop.querySelectorAll(".glossary-item.is-open").forEach((el) => el.classList.remove("is-open"));
      if (!wasOpen) item.classList.add("is-open");
    });

    pop.appendChild(item);
  }

  // 5) If the URL already has #g-... scroll highlight lightly
  if (location.hash && location.hash.startsWith("#g-")) {
    const el = document.querySelector(location.hash);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.outline = "2px solid var(--accent)";
        setTimeout(() => (el.style.outline = ""), 900);
      }, 200);
    }
  }
})();
