document.addEventListener("DOMContentLoaded", () => {
  if (!window.location.pathname.includes("/work/")) {
    return;
  }

  makeCollapsible("h2");
});

function makeCollapsible(selector) {
  const headings = Array.from(
    document.querySelectorAll("main " + selector + ", .page " + selector + ", .course-content " + selector)
  );

  headings.forEach((heading) => {
    if (heading.dataset.collapsibleProcessed === "true") {
      return;
    }
    heading.dataset.collapsibleProcessed = "true";

    const content = document.createElement("div");
    content.className = "collapsible-content";

    let sibling = heading.nextElementSibling;
    while (sibling && !isSameOrHigherHeading(sibling, selector)) {
      const next = sibling.nextElementSibling;
      content.appendChild(sibling);
      sibling = next;
    }

    if (!content.children.length) {
      return;
    }

    heading.classList.add("collapsible-heading");
    heading.parentNode.insertBefore(content, heading.nextSibling);

    heading.addEventListener("click", () => {
      heading.classList.toggle("is-collapsed");
      content.classList.toggle("is-collapsed");
    });
  });
}

function isSameOrHigherHeading(element, selector) {
  const level = parseInt(selector.substring(1), 10);

  if (!/^H[1-6]$/.test(element.tagName)) {
    return false;
  }

  const siblingLevel = parseInt(element.tagName.substring(1), 10);
  return siblingLevel <= level;
}
