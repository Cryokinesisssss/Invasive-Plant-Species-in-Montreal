// ============================================================
// PROJECTS PAGE — every project & initiative as a filterable list
// ------------------------------------------------------------
// Reads the same data as the map: data/projects.geojson plus approved
// reader suggestions (site/remember.js). Each project's borough
// or city comes from its point (Turf point-in-polygon).
// ============================================================
(function () {
  const listEl = document.getElementById('pj-list');
  const countEl = document.getElementById('pj-count');
  const searchEl = document.getElementById('pj-search');
  const boroughEl = document.getElementById('pj-borough');
  const speciesEl = document.getElementById('pj-species');
  const statusEl = document.getElementById('pj-status');

  const MARKER_LABEL = {
    site: 'Project site',
    area: 'Project area (approximate)',
    organization: 'Organization address'
  };
  const TYPE_LABEL = { 'Arrondissement': 'Borough', 'Ville liée': 'City' };
  const NAME_EN = { 'Montréal': 'Montreal', 'Montréal-Est': 'Montreal East', 'Montréal-Ouest': 'Montreal West', 'Mont-Royal': 'Mount Royal' };
  const THIS_YEAR = new Date().getFullYear();

  let baseProjects = [];
  let readerProjects = [];
  let boundaries = null;

  // ---------- helpers ----------
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
  function isWebLink(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }

  function latinBinomial(name) {
    const parts = String(name || '').toLowerCase().replace(/×/g, ' x ').split(/\s+/)
      .filter(function (w) { return w && w !== 'x'; });
    if (!parts.length) return '';
    if (!parts[1] || parts[1] === 'spp.' || parts[1] === 'sp.') return parts[0];
    return parts[0] + ' ' + parts[1];
  }

  // Ongoing if the years say active / present / seasonal, or the last year is this year or later
  function statusOf(year) {
    const y = String(year || '').toLowerCase();
    if (/active|present|ongoing|seasonal/.test(y)) return 'ongoing';
    const years = y.match(/\b(19|20)\d{2}\b/g);
    if (!years) return '';
    return Number(years[years.length - 1]) >= THIS_YEAR ? 'ongoing' : 'past';
  }

  // Borough or city the project's point falls in
  function placeOf(feature) {
    const g = feature.geometry;
    if (!boundaries || !window.turf || !g || g.type !== 'Point') return null;
    const pt = turf.point(g.coordinates);
    const b = boundaries.features.find(function (f) { return turf.booleanPointInPolygon(pt, f); });
    if (!b) return { name: 'Outside the agglomeration', type: '' };
    const nom = (b.properties.NOM || '').trim();
    return { name: NAME_EN[nom] || nom, type: TYPE_LABEL[(b.properties.TYPE || '').trim()] || '' };
  }

  function speciesKey(s) {
    if (!s) return '';
    if (s.unspecified || !s.scientific) return 'common:' + String(s.common || '').toLowerCase();
    return latinBinomial(s.scientific);
  }

  // ---------- data ----------
  function allProjects() {
    return baseProjects.concat(readerProjects).map(function (f) {
      if (!f._place) f._place = placeOf(f);
      return f;
    });
  }

  // ---------- filter options ----------
  function fillOptions() {
    const projects = allProjects();
    const keepBorough = boroughEl.value;
    const keepSpecies = speciesEl.value;

    const places = new Map();
    projects.forEach(function (f) {
      if (f._place) places.set(f._place.name, f._place.type);
    });
    boroughEl.length = 1;
    Array.from(places.keys()).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (name) {
      const type = places.get(name);
      boroughEl.add(new Option(name + (type ? ' (' + type + ')' : ''), name));
    });

    const species = new Map();
    projects.forEach(function (f) {
      ((f.properties && f.properties.species) || []).forEach(function (s) {
        const key = speciesKey(s);
        if (!key || species.has(key)) return;
        species.set(key, s.unspecified ? s.common + ' (species not specified)' : s.common);
      });
    });
    speciesEl.length = 1;
    Array.from(species.entries()).sort(function (a, b) { return a[1].localeCompare(b[1]); }).forEach(function (e) {
      speciesEl.add(new Option(e[1], e[0]));
    });

    boroughEl.value = keepBorough;
    speciesEl.value = keepSpecies;
  }

  // ---------- one card ----------
  function cardHtml(f) {
    const p = f.properties || {};
    const status = statusOf(p.year);
    let html = '<article class="project-card">';
    html += '<div class="project-card-head"><h2>' + escapeHtml(p.name || 'Untitled project') + '</h2>' +
      (status ? '<span class="project-status project-status-' + status + '">' + (status === 'ongoing' ? 'Ongoing' : 'Past') + '</span>' : '') +
      '</div>';
    html += '<div class="project-card-meta">' +
      escapeHtml(p.organization || 'Community project') + (p.year ? ' · ' + escapeHtml(p.year) : '') + '</div>';
    if (f._place) {
      html += '<div class="project-card-place">' + escapeHtml(f._place.name) +
        (f._place.type ? ' <span>(' + escapeHtml(f._place.type) + ')</span>' : '') + '</div>';
    }
    if (p.description) html += '<p class="project-card-desc">' + escapeHtml(p.description) + '</p>';

    const species = Array.isArray(p.species) ? p.species : [];
    html += '<div class="project-species"><strong>Associated species</strong>';
    if (!species.length) {
      html += '<div class="project-species-none">Not specified</div>';
    } else {
      html += '<ul>';
      species.forEach(function (s) {
        if (!s || !s.common) return;
        if (s.unspecified) {
          html += '<li class="project-species-other">' + escapeHtml(s.common) + ' <em>(species not specified)</em></li>';
        } else if (s.in_catalog === false || !s.scientific) {
          html += '<li class="project-species-other">' + escapeHtml(s.common) +
            (s.scientific ? ' <em>(' + escapeHtml(s.scientific) + ')</em>' : '') + '</li>';
        } else {
          html += '<li><a class="project-species-link" href="species.html?species=' + encodeURIComponent(s.scientific) + '">' +
            escapeHtml(s.common) + ' <em>(' + escapeHtml(s.scientific) + ')</em></a></li>';
        }
      });
      html += '</ul>';
    }
    html += '</div>';

    const actions = Array.isArray(p.actions) ? p.actions : [];
    if (p.project_area || actions.length) {
      html += '<details class="project-more"><summary>Project sites and restoration work</summary>';
      if (p.project_area) html += '<div class="project-detail"><strong>Sites:</strong> ' + escapeHtml(p.project_area) + '</div>';
      if (actions.length) {
        html += '<div class="project-detail"><strong>Work:</strong><ul>' +
          actions.map(function (a) { return '<li>' + escapeHtml(a) + '</li>'; }).join('') + '</ul></div>';
      }
      html += '</details>';
    }
    if (MARKER_LABEL[p.marker_type]) {
      html += '<div class="project-location-note"><strong>Marker:</strong> ' + MARKER_LABEL[p.marker_type] + '</div>';
    }
    if (p.reader_submitted) html += '<div class="project-reader-note">Suggested by a reader and reviewed</div>';

    html += '<div class="project-card-links">';
    if (f.geometry && f.geometry.type === 'Point') {
      html += '<a class="species-map-btn" href="../map.html?project=' + encodeURIComponent(p.name || '') + '">Show on map</a>';
    }
    if (isWebLink(p.project_url)) {
      html += '<a class="pp-link" href="' + escapeAttr(p.project_url) + '" target="_blank" rel="noopener noreferrer">Original project details ↗</a>';
    }
    if (isWebLink(p.source_url)) {
      html += '<a class="pp-link" href="' + escapeAttr(p.source_url) + '" target="_blank" rel="noopener noreferrer">Project update ↗</a>';
    }
    html += '</div></article>';
    return html;
  }

  // ---------- render ----------
  function render() {
    const q = searchEl.value.trim().toLowerCase();
    const borough = boroughEl.value;
    const species = speciesEl.value;
    const status = statusEl.value;
    const all = allProjects();

    const shown = all.filter(function (f) {
      const p = f.properties || {};
      if (borough && (!f._place || f._place.name !== borough)) return false;
      if (species && !(p.species || []).some(function (s) { return speciesKey(s) === species; })) return false;
      if (status && statusOf(p.year) !== status) return false;
      if (q) {
        const text = [p.name, p.organization, p.description, p.project_area,
          f._place && f._place.name].concat((p.species || []).map(function (s) { return s && (s.common + ' ' + (s.scientific || '')); }))
          .join(' ').toLowerCase();
        if (text.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      // Ongoing first, then by name
      const sa = statusOf(a.properties.year) === 'ongoing' ? 0 : 1;
      const sb = statusOf(b.properties.year) === 'ongoing' ? 0 : 1;
      return sa - sb || String(a.properties.name).localeCompare(String(b.properties.name));
    });

    countEl.textContent = shown.length === all.length
      ? all.length + ' projects'
      : shown.length + ' of ' + all.length + ' projects';
    listEl.innerHTML = shown.length
      ? shown.map(cardHtml).join('')
      : '<p class="projects-empty">No projects match these filters.</p>';
  }

  [boroughEl, speciesEl, statusEl].forEach(function (el) { el.addEventListener('change', render); });
  searchEl.addEventListener('input', render);
  document.getElementById('pj-reset').addEventListener('click', function () {
    searchEl.value = ''; boroughEl.value = ''; speciesEl.value = ''; statusEl.value = '';
    render();
  });

  function refresh() { fillOptions(); render(); }

  // ---------- load ----------
  listEl.innerHTML = '<p class="projects-empty">Loading projects…</p>';
  Promise.all([
    fetch('../data/projects.geojson').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' loading projects.geojson');
      return r.json();
    }),
    fetch('../data/limites-administratives-agglomeration.GEOjson')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
  ]).then(function (results) {
    baseProjects = (results[0].features || []).filter(function (f) { return f && f.properties; });
    boundaries = results[1];
    refresh();
  }).catch(function (err) {
    console.error(err);
    listEl.innerHTML = '<p class="projects-empty">Could not load the projects. Please try again later.</p>';
  });

  if (window.ReaderProjects) {
    window.ReaderProjects.watchApproved(function (features) {
      readerProjects = features;
      if (baseProjects.length) refresh();
    });
  }
})();
