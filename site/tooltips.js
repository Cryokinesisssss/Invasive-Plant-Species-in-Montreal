// ============================================================
// INSTANT TOOLTIPS — shared by every page
// ------------------------------------------------------------
// Browsers wait about a second before showing a native `title`
// tooltip. This replaces them with one that appears right away.
// Any element with a title="..." gets it automatically: on hover the
// title moves to data-tip (so the native tooltip never shows too).
// Use a newline (\n) in the title for a multi-line tooltip.
// ============================================================
(function () {
  // Touch screens have no hover; leave their behaviour alone.
  if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;

  const tip = document.createElement('div');
  tip.className = 'site-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);

  let current = null;

  function targetFrom(node) {
    while (node && node !== document.body) {
      if (node.nodeType === 1 && (node.hasAttribute('title') || node.hasAttribute('data-tip'))) return node;
      node = node.parentNode;
    }
    return null;
  }

  function show(el) {
    // Move title → data-tip so the slow native tooltip doesn't also appear
    if (el.hasAttribute('title')) {
      const t = el.getAttribute('title');
      el.removeAttribute('title');
      if (!t) return;
      el.setAttribute('data-tip', t);
      if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t);
    }
    const text = el.getAttribute('data-tip');
    if (!text) return;

    current = el;
    tip.textContent = text;
    tip.hidden = false;

    // Above the element, centred; below it if there's no room; kept on screen
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const gap = 8;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));
    let top = r.top - th - gap;
    if (top < 6) top = r.bottom + gap;
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }

  function hide() {
    current = null;
    tip.hidden = true;
  }

  document.addEventListener('mouseover', function (e) {
    const el = targetFrom(e.target);
    if (el === current) return;
    if (!el) { hide(); return; }
    show(el);
  }, true);

  document.addEventListener('mouseout', function (e) {
    if (!current) return;
    if (e.relatedTarget && current.contains(e.relatedTarget)) return;
    hide();
  }, true);

  ['mousedown', 'scroll', 'wheel', 'keydown'].forEach(function (type) {
    document.addEventListener(type, hide, true);
  });
  window.addEventListener('blur', hide);
})();
