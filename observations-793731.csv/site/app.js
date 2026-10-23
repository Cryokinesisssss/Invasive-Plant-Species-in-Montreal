// ============================================================
// app.js — Montreal invasive species map
//
// Section index (use this to find things fast at the demo):
//   1.  Map setup                       → starting view / maxBounds
//   2.  Risk → style mapping            → dot colours (RISK_STYLE)
//   3.  Filter state                    → what the filters change
//   4.  Species index                   → species list for the popover
//   5.  Observation filter              → passesFilters() for iNat dots
//   5b. Sentinelle filter               → passesSentinelFilters()
//   6.  Render observations             → buildObsLayer() + popup HTML
//   7.  Initial load                    → fetch places.geojson
//   8.  Popover open/close              → dropdown behaviour
//   9.  Summary badges                  → "All" / "N selected" labels
//   10. Species list (popover)          → search + checkboxes
//   11. Risk checkboxes                 → risk filter UI
//   11b.Year filter                     → year filter UI
//   12. Borough list (popover)          → borough filter UI
//   13. Simple toggles                  → sensitive / photo / iNat / Sentinelle
//   14. Reset                           → Reset button
//   15. Legend                          → bottom-right legend
//   16. Names / highlights              → borough outline highlight
//   17. Borough stats panel             → click a borough → panel
//   18. Load boundaries                 → fetch boundaries + click handler
//   19. Lightbox                        → click thumbnail → full image
//   20. Story overlay                   → "About this map" modal
//   21. Sentinelle layer                → toggleable second dataset
// ============================================================


// ============================================================
// 1. MAP SETUP — starting view, bounds, base tiles
// ============================================================
const map = L.map('map', {
  maxBounds: [[45.30, -74.10], [45.75, -73.30]],
  minZoom: 10.4,
  maxBoundsViscosity: 1.0
}).setView([45.51, -73.58], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


// ============================================================
// 2. RISK → STYLE MAPPING — dot colours and labels
//    Change a colour here to recolour every dot of that tier.
// ============================================================
const RISK_STYLE = {
  high:     { color: '#8b0000', fillColor: '#e63946', label: 'High risk' },
  moderate: { color: '#a15c00', fillColor: '#f4a261', label: 'Moderate risk' },
  low:      { color: '#7a6000', fillColor: '#ffd166', label: 'Low risk' },
  unknown:  { color: '#444',    fillColor: '#adb5bd', label: 'Unclassified' }
};

function styleFor(props) {
  return RISK_STYLE[props.risk] || RISK_STYLE.unknown;
}


// ============================================================
// 3. FILTER STATE — the single source of truth for filters
//    filterState.risk starts with all four tiers ON.
// ============================================================
const filterState = {
  risk: new Set(['high', 'moderate', 'low', 'unknown']),
  boroughs: new Set(),
  species: new Set(),
  years: new Set(),        // empty = all years
  sensitive: false,
  photo: false
};

// ---- 3a. Layer + data state ----
let obsLayer = null;
let allFeatures = [];
let boroughData = null;
let boroughsUnion = null;
let speciesCatalog = [];

// ---- 3b. Sentinelle layer state ----
let sentinelLayer = null;
let sentinelFeatures = [];
let sentinelVisible = false;

// ---- 3c. iNat visibility (analogous to sentinelVisible) ----
let inatVisible = true;

// ---- 3d. Region click-selection (separate from the filter) ----
let selectedBorough = null;
let selectedBoroughName = null;
let selectedIsUnion = false;


// ============================================================
// 3e. SHARED "WHAT'S ON THE MAP" SUMMARY BLOCK
//     Updates the badge in the top-right corner.
// ============================================================
function updateStatusSummary(filtered) {
  const el = document.getElementById('status');
  if (!el) return;

  const total = allFeatures.length;
  const shown = filtered.length;

  const speciesSet = new Set();
  filtered.forEach(function (f) {
    const p = f.properties;
    const common = (p.common_name || '').trim();
    const sci = (p.scientific_name || '').trim();
    if (!common && !sci) return;
    speciesSet.add((common || sci) + '|' + sci);
  });

  let boroughCount = 0;
  let cityCount = 0;
  if (boroughData && window.turf && shown > 0) {
    const pts = filtered.map(function (f) {
      return turf.point([f.geometry.coordinates[0], f.geometry.coordinates[1]]);
    });
    boroughData.features.forEach(function (b) {
      const hasPoint = pts.some(function (pt) {
        return turf.booleanPointInPolygon(pt, b);
      });
      if (!hasPoint) return;
      const t = ((b.properties.TYPE || '').trim());
      if (t === 'Arrondissement') boroughCount++;
      else if (t === 'Ville liée') cityCount++;
    });
  }

  let html = '<div class="status-line status-line-main">' +
               shown.toLocaleString() + ' observation' + (shown === 1 ? '' : 's') +
               (shown !== total ? ' <span class="status-sub">of ' + total.toLocaleString() + '</span>' : '') +
             '</div>' +
             '<div class="status-line">' +
               speciesSet.size.toLocaleString() + ' species' +
             '</div>';

  if (boroughData) {
    html += '<div class="status-line">' +
              boroughCount + ' borough' + (boroughCount === 1 ? '' : 's') +
              (cityCount ? ' · ' + cityCount + ' cit' + (cityCount === 1 ? 'y' : 'ies') : '') +
            '</div>';
  }

  el.innerHTML = html;
  el.classList.toggle('is-filtered', shown !== total);
}


// ============================================================
// 4. SPECIES INDEX — builds the species list used in the popover
// ============================================================
function buildSpeciesCatalog() {
  const byKey = new Map();
  allFeatures.forEach(function (f) {
    const p = f.properties;
    const common = (p.common_name || '').trim();
    const sci = (p.scientific_name || '').trim();
    if (!common && !sci) return;
    const key = (common || sci) + '|' + sci;
    if (!byKey.has(key)) {
      byKey.set(key, { key: key, common: common || sci, sci: sci });
    }
  });
  speciesCatalog = Array.from(byKey.values()).sort(function (a, b) {
    return a.common.localeCompare(b.common);
  });
}


// ============================================================
// 5. OBSERVATION FILTER — decides which iNat dots are visible
//    This is the core action's filtering logic.
// ============================================================
function passesFilters(f) {
  if (f.geometry === null) return false;
  const p = f.properties;

  const tier = p.risk || 'unknown';
  if (!filterState.risk.has(tier)) return false;

  // Year filter
  if (filterState.years.size > 0) {
    const y = (p.observed_on || '').slice(0, 4);
    if (!filterState.years.has(y)) return false;
  }

  if (filterState.sensitive) {
    const isSens = p.coordinates_obscured || (p.taxon_geoprivacy && p.taxon_geoprivacy !== '');
    if (!isSens) return false;
  }

  if (filterState.photo && !p.image_url) return false;

  if (filterState.species.size > 0) {
    const key = (p.common_name || p.scientific_name || '') + '|' + (p.scientific_name || '');
    if (!filterState.species.has(key)) return false;
  }

  if (filterState.boroughs.size > 0 && boroughData && window.turf) {
    const pt = turf.point([f.geometry.coordinates[0], f.geometry.coordinates[1]]);
    let inside = false;

    if (filterState.boroughs.has('__boroughs__') && boroughsUnion) {
      if (turf.booleanPointInPolygon(pt, boroughsUnion)) inside = true;
    }

    if (!inside) {
      inside = boroughData.features.some(function (b) {
        if (!filterState.boroughs.has(nameEn(b))) return false;
        return turf.booleanPointInPolygon(pt, b);
      });
    }

    if (!inside) return false;
  }

  return true;
}


// ============================================================
// 5b. SENTINELLE FILTER — same filters, Sentinelle column names
// ============================================================
function passesSentinelFilters(f) {
  if (f.geometry === null) return false;
  const p = f.properties;

  const tier = p.risk || 'unknown';
  if (!filterState.risk.has(tier)) return false;

  // Year filter
  if (filterState.years.size > 0) {
    const y = (p['Date_observation'] || '').slice(0, 4);
    if (!filterState.years.has(y)) return false;
  }

  if (filterState.photo && !p['Lien_photo']) return false;

  if (filterState.species.size > 0) {
    const en    = (p.common_name_en || '').trim();
    const latin = (p.scientific_name || p['Nom_espece_latin'] || '').trim();
    const keys = [
      (en || latin) + '|' + latin,
      latin + '|' + latin
    ];
    if (!keys.some(function (k) { return filterState.species.has(k); })) return false;
  }

  // Borough filter: Sentinelle points should respect the same geographic filter
  if (filterState.boroughs.size > 0 && boroughData && window.turf) {
    const pt = turf.point([f.geometry.coordinates[0], f.geometry.coordinates[1]]);
    let inside = false;

    if (filterState.boroughs.has('__boroughs__') && boroughsUnion) {
      if (turf.booleanPointInPolygon(pt, boroughsUnion)) inside = true;
    }
    if (!inside) {
      inside = boroughData.features.some(function (b) {
        if (!filterState.boroughs.has(nameEn(b))) return false;
        return turf.booleanPointInPolygon(pt, b);
      });
    }
    if (!inside) return false;
  }

  return true;
}


// ============================================================
// 6. RENDER OBSERVATIONS — builds the iNat dot layer + popups
//    pointToLayer = the dot itself; onEachFeature = the popup.
// ============================================================
function buildObsLayer() {
  if (obsLayer) { map.removeLayer(obsLayer); obsLayer = null; }
  if (!inatVisible) return;

  const filtered = allFeatures.filter(passesFilters);

  obsLayer = L.geoJSON(
    { type: 'FeatureCollection', features: filtered },
    {
      // ---- 6a. The dot itself ----
      pointToLayer: function (feature, latlng) {
        const p = feature.properties;
        const s = styleFor(p);
        const sensitive = p.coordinates_obscured || (p.taxon_geoprivacy && p.taxon_geoprivacy !== '');
        return L.circleMarker(latlng, {
          radius: sensitive ? 7 : 6,
          weight: sensitive ? 2 : 1.5,
          dashArray: sensitive ? '3,3' : null,
          color: s.color,
          fillColor: s.fillColor,
          fillOpacity: sensitive ? 0.55 : 0.9
        });
      },
      // ---- 6b. The popup HTML ----
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const s = styleFor(p);

        const badgeColors = {
          high:     { bg: '#fde2e4', fg: '#8b0000', border: '#e63946' },
          moderate: { bg: '#fdead2', fg: '#7a4500', border: '#f4a261' },
          low:      { bg: '#fff4c2', fg: '#5c4700', border: '#ffd166' },
          unknown:  { bg: '#e9ecef', fg: '#333',    border: '#adb5bd' }
        };
        const badge = badgeColors[p.risk] || badgeColors.unknown;

        const title = p.common_name || p.scientific_name || p.species_guess || ('Observation ' + p.id);
        const latin = p.scientific_name && p.scientific_name !== title ? p.scientific_name : '';
        const sensitive = p.coordinates_obscured || (p.taxon_geoprivacy && p.taxon_geoprivacy !== '');

        let html = '<div class="popup-head">';
        if (p.image_url) {
          html += '<img class="popup-thumb" src="' + p.image_url + '" data-full="' + p.image_url + '" alt="">';
        } else {
          html += '<div class="popup-thumb popup-thumb-empty"><span>No photo</span></div>';
        }
        html += '<div class="popup-headtext">';
        html += '<div class="popup-title">' + title + '</div>';
        if (latin) html += '<div class="popup-latin"><em>' + latin + '</em></div>';
        html += '<div class="popup-badge" style="background:' + badge.bg + ';color:' + badge.fg + ';border:1px solid ' + badge.border + ';">' + s.label + '</div>';
        html += '</div></div>';

        html += '<div class="popup-grid">';
        if (p.observed_on) html += '<div><span class="lbl">Observed</span>' + p.observed_on + '</div>';
        if (p.user_login)  html += '<div><span class="lbl">By</span>' + p.user_login + '</div>';
        if (p.place_guess) html += '<div class="popup-grid-wide"><span class="lbl">Place</span>' + p.place_guess + '</div>';
        if (p.presence) {
          let qc = p.presence;
          if (p.presence === 'Absent') qc += ' (not established)';
          if (p.banned) qc += ' · REFEE';
          html += '<div class="popup-grid-wide"><span class="lbl">Québec</span>' + qc + '</div>';
        }
        html += '</div>';

        if (sensitive) html += '<div class="popup-sensitive">⚠ Location fuzzed (<100 m)</div>';
        if (!p.image_url && p.license) html += '<div class="popup-photo-note">No photo — license ' + p.license + ' does not permit reuse.</div>';
        if (p.url) html += '<a class="popup-btn" href="' + p.url + '" target="_blank" rel="noopener noreferrer">View on iNaturalist →</a>';

        layer.bindPopup(html, { maxWidth: 300, minWidth: 260, maxHeight: 420 });
      }
    }
  ).addTo(map);

  updateStatusSummary(filtered);
}


// ============================================================
// 7. INITIAL LOAD — fetch places.geojson and draw the map
//    This is where the map first fits to the data bounds.
// ============================================================
fetch('data/places.geojson')
  .then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' loading places.geojson');
    return response.json();
  })
  .then(function (data) {
    allFeatures = data.features;
    buildSpeciesCatalog();
    buildYearList();
    populateSpeciesList();
    buildObsLayer();

    const allLayer = L.geoJSON(data, { filter: function (f) { return f.geometry !== null; } });
    const bounds = allLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.1));
  })
  .catch(function (err) {
    document.getElementById('status').textContent =
      'Could not load places.geojson. Open the console (F12) for details.';
    console.error(err);
  });


// ============================================================
// 8. POPOVER OPEN/CLOSE — dropdown behaviour for the filter bar
// ============================================================
function closeAllPopovers() {
  document.querySelectorAll('.fp-panel').forEach(function (p) { p.hidden = true; });
  document.querySelectorAll('.fp-btn').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  hideSpSuggest();
}

document.querySelectorAll('.fp').forEach(function (wrap) {
  const btn = wrap.querySelector('.fp-btn');
  const panel = wrap.querySelector('.fp-panel');
  if (!btn || !panel) return;
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    const wasOpen = !panel.hidden;
    closeAllPopovers();
    if (!wasOpen) { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
  });
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
});

document.addEventListener('click', closeAllPopovers);
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeAllPopovers();
});


// ============================================================
// 9. SUMMARY BADGES — the "All" / "N selected" labels on each button
// ============================================================
function updateSummaries() {
  const spCount = filterState.species.size;
  const spSum = document.getElementById('fp-species-summary');
  if (spSum) {
    spSum.textContent = spCount === 0 ? 'All' : spCount + ' selected';
    spSum.classList.toggle('is-set', spCount > 0);
  }

  const rSum = document.getElementById('fp-risk-summary');
  if (rSum) {
    const n = filterState.risk.size;
    const total = 4;
    rSum.textContent = n === total ? 'All' : (n === 0 ? 'None' : n + ' selected');
    rSum.classList.toggle('is-set', n !== total);
  }

  const bSum = document.getElementById('fp-borough-summary');
  if (bSum) {
    const bCount = filterState.boroughs.size;
    if (bCount === 0) { bSum.textContent = 'All'; bSum.classList.remove('is-set'); }
    else if (filterState.boroughs.has('__boroughs__') && bCount === 1) {
      bSum.textContent = 'Boroughs of Montreal'; bSum.classList.add('is-set');
    } else if (filterState.boroughs.has('__boroughs__')) {
      bSum.textContent = 'Boroughs + ' + (bCount - 1) + ' more'; bSum.classList.add('is-set');
    } else {
      bSum.textContent = bCount + ' selected'; bSum.classList.add('is-set');
    }
  }

  const ySum = document.getElementById('fp-year-summary');
  if (ySum) {
    const n = filterState.years.size;
    ySum.textContent = n === 0 ? 'All' : (n === 1 ? Array.from(filterState.years)[0] : n + ' selected');
    ySum.classList.toggle('is-set', n > 0);
  }
}


// ============================================================
// 10. SPECIES LIST (POPOVER) — search + checkboxes for species
// ============================================================
function populateSpeciesList() {
  const listEl = document.getElementById('f-species-list');
  if (!listEl) return;
  renderSpeciesList('');
}

function renderSpeciesList(query) {
  const listEl = document.getElementById('f-species-list');
  if (!listEl) return;
  const q = (query || '').toLowerCase().trim();

  const matches = speciesCatalog.filter(function (s) {
    if (!q) return true;
    return (s.common + ' ' + s.sci).toLowerCase().indexOf(q) !== -1;
  });

  if (!matches.length) {
    listEl.innerHTML = '<div class="fp-empty">No matches</div>';
    return;
  }

  listEl.innerHTML = matches.map(function (s) {
    const checked = filterState.species.has(s.key) ? ' checked' : '';
    return '<label class="fp-check">' +
             '<input type="checkbox" data-sp-key="' + escapeAttr(s.key) + '"' + checked + '>' +
             '<span>' + escapeHtml(s.common) +
               (s.sci ? ' <em style="color:#888">(' + escapeHtml(s.sci) + ')</em>' : '') +
             '</span>' +
           '</label>';
  }).join('');

  listEl.querySelectorAll('input[data-sp-key]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const key = cb.getAttribute('data-sp-key');
      if (cb.checked) filterState.species.add(key);
      else filterState.species.delete(key);
      syncSpeciesAllCheckbox();
      updateSummaries();
      buildObsLayer();
      buildSentinelLayer();
    });
  });
}

// ---- 10a. HTML escaping helpers ----
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }


// ---- 10b. Species search with live suggestions ----
const spSearchInput = document.getElementById('f-species-search');
const spSuggestBox  = document.getElementById('f-species-suggest');
let spSuggestIndex = -1;

function hideSpSuggest() {
  if (spSuggestBox) spSuggestBox.hidden = true;
  spSuggestIndex = -1;
}

function showSpSuggest(query) {
  if (!spSuggestBox) return;
  const q = (query || '').toLowerCase().trim();
  if (!q) { hideSpSuggest(); return; }

  const matches = speciesCatalog.filter(function (s) {
    return (s.common + ' ' + s.sci).toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);

  if (!matches.length) {
    spSuggestBox.innerHTML = '<div class="ss-empty">No matches</div>';
    spSuggestBox.hidden = false;
    return;
  }

  spSuggestBox.innerHTML = matches.map(function (s, i) {
    const checked = filterState.species.has(s.key);
    return '<button type="button" class="ss-item' + (i === spSuggestIndex ? ' active' : '') + (checked ? ' is-checked' : '') + '" ' +
             'data-sp-key="' + escapeAttr(s.key) + '">' +
             '<span class="ss-common">' + escapeHtml(s.common) + '</span>' +
             '<span class="ss-sci"><em>' + escapeHtml(s.sci) + '</em></span>' +
             (checked ? '<span class="ss-tier tier-watch">✓</span>' : '') +
           '</button>';
  }).join('');
  spSuggestBox.hidden = false;

  spSuggestBox.querySelectorAll('.ss-item').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const key = btn.getAttribute('data-sp-key');
      if (filterState.species.has(key)) filterState.species.delete(key);
      else filterState.species.add(key);
      syncSpeciesAllCheckbox();
      updateSummaries();
      buildObsLayer();
      buildSentinelLayer();
      renderSpeciesList(spSearchInput ? spSearchInput.value : '');
      showSpSuggest(spSearchInput ? spSearchInput.value : '');
    });
  });
}

if (spSearchInput) {
  spSearchInput.addEventListener('input', function (e) {
    renderSpeciesList(e.target.value);
    showSpSuggest(e.target.value);
  });
  spSearchInput.addEventListener('focus', function () {
    if (spSearchInput.value.trim()) showSpSuggest(spSearchInput.value);
  });
  spSearchInput.addEventListener('keydown', function (e) {
    if (spSuggestBox && !spSuggestBox.hidden) {
      const items = spSuggestBox.querySelectorAll('.ss-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        spSuggestIndex = Math.min(spSuggestIndex + 1, items.length - 1);
        items.forEach(function (it, i) { it.classList.toggle('active', i === spSuggestIndex); });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        spSuggestIndex = Math.max(spSuggestIndex - 1, 0);
        items.forEach(function (it, i) { it.classList.toggle('active', i === spSuggestIndex); });
      } else if (e.key === 'Enter' && spSuggestIndex >= 0 && items[spSuggestIndex]) {
        e.preventDefault();
        items[spSuggestIndex].click();
      } else if (e.key === 'Escape') {
        hideSpSuggest();
      }
    }
  });
}

document.addEventListener('click', function (e) {
  if (spSuggestBox && !spSuggestBox.hidden) {
    if (!spSuggestBox.contains(e.target) && e.target !== spSearchInput) hideSpSuggest();
  }
});

// ---- 10c. "All species" checkbox ----
document.getElementById('f-species-all').addEventListener('change', function (e) {
  if (e.target.checked) {
    filterState.species.clear();
    speciesCatalog.forEach(function (s) { filterState.species.add(s.key); });
  } else {
    filterState.species.clear();
  }
  renderSpeciesList(spSearchInput ? spSearchInput.value : '');
  updateSummaries();
  buildObsLayer();
  buildSentinelLayer();
});

function syncSpeciesAllCheckbox() {
  const all = document.getElementById('f-species-all');
  if (!all) return;
  all.checked = speciesCatalog.length > 0 && filterState.species.size === speciesCatalog.length;
}


// ============================================================
// 11. RISK CHECKBOXES — the Risk filter popover
// ============================================================
document.querySelectorAll('input[data-risk]').forEach(function (cb) {
  cb.addEventListener('change', function () {
    const risk = cb.getAttribute('data-risk');
    if (cb.checked) filterState.risk.add(risk);
    else filterState.risk.delete(risk);
    syncRiskAllCheckbox();
    updateSummaries();
    buildObsLayer();
    buildSentinelLayer();
  });
});

document.getElementById('f-risk-all').addEventListener('change', function (e) {
  const all = ['high', 'moderate', 'low', 'unknown'];
  filterState.risk.clear();
  if (e.target.checked) all.forEach(function (r) { filterState.risk.add(r); });
  document.querySelectorAll('input[data-risk]').forEach(function (cb) {
    cb.checked = e.target.checked;
  });
  updateSummaries();
  buildObsLayer();
  buildSentinelLayer();
});

function syncRiskAllCheckbox() {
  const all = document.getElementById('f-risk-all');
  if (!all) return;
  all.checked = filterState.risk.size === 4;
}


// ============================================================
// 11b. YEAR FILTER — the Year filter popover
// ============================================================
function buildYearList() {
  const listEl = document.getElementById('f-year-list');
  if (!listEl) return;

  const years = new Set();
  allFeatures.forEach(function (f) {
    const y = (f.properties.observed_on || '').slice(0, 4);
    if (/^\d{4}$/.test(y)) years.add(y);
  });
  sentinelFeatures.forEach(function (f) {
    const y = (f.properties['Date_observation'] || '').slice(0, 4);
    if (/^\d{4}$/.test(y)) years.add(y);
  });

  const sorted = Array.from(years).sort().reverse();
  listEl.innerHTML = sorted.map(function (y) {
    const checked = filterState.years.has(y) ? ' checked' : '';
    return '<label class="fp-check">' +
             '<input type="checkbox" data-year="' + y + '"' + checked + '>' +
             '<span>' + y + '</span>' +
           '</label>';
  }).join('');

  listEl.querySelectorAll('input[data-year]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const y = cb.getAttribute('data-year');
      if (cb.checked) filterState.years.add(y);
      else filterState.years.delete(y);
      syncYearAllCheckbox();
      updateSummaries();
      buildObsLayer();
      buildSentinelLayer();
    });
  });

  syncYearAllCheckbox();
}

function syncYearAllCheckbox() {
  const all = document.getElementById('f-year-all');
  if (!all) return;
  all.checked = filterState.years.size === 0;
}

const yearAllEl = document.getElementById('f-year-all');
if (yearAllEl) {
  yearAllEl.addEventListener('change', function () {
    filterState.years.clear();
    document.querySelectorAll('#f-year-list input[data-year]').forEach(function (cb) {
      cb.checked = false;
    });
    syncYearAllCheckbox();
    updateSummaries();
    buildObsLayer();
    buildSentinelLayer();
  });
}


// ============================================================
// 12. BOROUGH LIST (POPOVER) — the Borough / City filter popover
// ============================================================
function buildBoroughList() {
  if (!boroughData) return;
  const listEl = document.getElementById('f-borough-list');
  if (!listEl) return;

  const boroughs = [];
  const cities   = [];
  const seen = new Set();

  boroughData.features.forEach(function (f) {
    const t = ((f.properties.TYPE || '').trim());
    const n = nameEn(f);
    if (!n || seen.has(n)) return;
    seen.add(n);
    if (t === 'Arrondissement') boroughs.push(n);
    else if (t === 'Ville liée') cities.push(n);
  });

  boroughs.sort(function (a, b) { return a.localeCompare(b); });
  cities.sort(function (a, b) { return a.localeCompare(b); });

  let html = '';
  if (boroughs.length) {
    html += '<div class="fp-group-label">Boroughs</div>';
    boroughs.forEach(function (n) {
      html += '<label class="fp-check">' +
                '<input type="checkbox" data-boro="' + escapeAttr(n) + '">' +
                '<span>' + escapeHtml(n) + '</span>' +
              '</label>';
    });
  }
  if (cities.length) {
    html += '<div class="fp-group-label">Linked cities</div>';
    cities.forEach(function (n) {
      html += '<label class="fp-check">' +
                '<input type="checkbox" data-boro="' + escapeAttr(n) + '">' +
                '<span>' + escapeHtml(n) + '</span>' +
              '</label>';
    });
  }
  listEl.innerHTML = html;

  listEl.querySelectorAll('input[data-boro]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const name = cb.getAttribute('data-boro');
      if (cb.checked) filterState.boroughs.add(name);
      else filterState.boroughs.delete(name);
      syncBoroughMeta();
      updateSummaries();
      buildObsLayer();
      buildSentinelLayer();
      applyBoroughHighlightFromFilter();
      renderSelectionPanel();
    });
  });
}

function syncBoroughMeta() {
  const all = document.getElementById('f-borough-all');
  const metro = document.getElementById('f-borough-metro');

  const allBoxes = Array.from(document.querySelectorAll('#f-borough-list input[data-boro]'));
  const total = allBoxes.length;
  const checked = allBoxes.filter(function (b) { return b.checked; }).length;

  if (all) all.checked = total > 0 && checked === total && !filterState.boroughs.has('__boroughs__');
  if (metro) metro.checked = filterState.boroughs.has('__boroughs__');
}

document.getElementById('f-borough-all').addEventListener('change', function (e) {
  const on = e.target.checked;
  filterState.boroughs.clear();
  document.querySelectorAll('#f-borough-list input[data-boro]').forEach(function (cb) {
    cb.checked = on;
    if (on) filterState.boroughs.add(cb.getAttribute('data-boro'));
  });
  const metro = document.getElementById('f-borough-metro');
  if (metro) metro.checked = false;
  updateSummaries();
  buildObsLayer();
  buildSentinelLayer();
  applyBoroughHighlightFromFilter();
  renderSelectionPanel();
});

document.getElementById('f-borough-metro').addEventListener('change', function (e) {
  const on = e.target.checked;
  if (on) {
    filterState.boroughs.add('__boroughs__');
  } else {
    filterState.boroughs.delete('__boroughs__');
  }
  updateSummaries();
  buildObsLayer();
  buildSentinelLayer();
  applyBoroughHighlightFromFilter();
  renderSelectionPanel();
});


// ============================================================
// 13. SIMPLE TOGGLES — sensitive / photo / iNat / Sentinelle
// ============================================================
document.getElementById('f-sensitive').addEventListener('change', function (e) {
  filterState.sensitive = e.target.checked;
  buildObsLayer();
});
document.getElementById('f-photo').addEventListener('change', function (e) {
  filterState.photo = e.target.checked;
  buildObsLayer();
  buildSentinelLayer();
});

// Sentinelle toggle
document.getElementById('f-sentinel').addEventListener('change', function (e) {
  sentinelVisible = e.target.checked;
  buildSentinelLayer();
});

// iNat toggle (same idea as Sentinelle toggle)
const inatToggleEl = document.getElementById('f-inat');
if (inatToggleEl) {
  inatToggleEl.addEventListener('change', function (e) {
    inatVisible = e.target.checked;
    buildObsLayer();
  });
}


// ============================================================
// 14. RESET — the Reset button clears every filter
// ============================================================
document.getElementById('f-reset').addEventListener('click', function () {
  filterState.risk = new Set(['high', 'moderate', 'low', 'unknown']);
  filterState.boroughs.clear();
  filterState.species.clear();
  filterState.years.clear();
  filterState.sensitive = false;
  filterState.photo = false;

  selectedBorough = null;
  selectedBoroughName = null;
  selectedIsUnion = false;

  document.querySelectorAll('input[data-risk]').forEach(function (cb) { cb.checked = true; });
  document.getElementById('f-risk-all').checked = true;

  document.querySelectorAll('#f-borough-list input[data-boro]').forEach(function (cb) { cb.checked = false; });
  document.getElementById('f-borough-all').checked = false;
  document.getElementById('f-borough-metro').checked = false;

  document.querySelectorAll('#f-species-list input[data-sp-key]').forEach(function (cb) { cb.checked = false; });
  document.getElementById('f-species-all').checked = false;
  if (spSearchInput) spSearchInput.value = '';
  hideSpSuggest();

  document.querySelectorAll('#f-year-list input[data-year]').forEach(function (cb) { cb.checked = false; });
  const yearAllElReset = document.getElementById('f-year-all');
  if (yearAllElReset) yearAllElReset.checked = true;

  document.getElementById('f-sensitive').checked = false;
  document.getElementById('f-photo').checked = false;

  sentinelVisible = false;
  const sentinelCb = document.getElementById('f-sentinel');
  if (sentinelCb) sentinelCb.checked = false;
  buildSentinelLayer();

  inatVisible = true;
  const inatCb = document.getElementById('f-inat');
  if (inatCb) inatCb.checked = true;

  updateSummaries();
  buildObsLayer();
  clearHighlight();
  renderSelectionPanel();
});


// ============================================================
// 15. LEGEND — bottom-right risk legend
// ============================================================
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML =
    '<div class="legend-title">Risk</div>' +
    '<div class="legend-risk-strip">' +
      '<span class="legend-risk-item"><span class="swatch" style="background:#e63946;border-color:#8b0000"></span>High</span>' +
      '<span class="legend-risk-item"><span class="swatch" style="background:#f4a261;border-color:#a15c00"></span>Mod.</span>' +
      '<span class="legend-risk-item"><span class="swatch" style="background:#ffd166;border-color:#7a6000"></span>Low</span>' +
    '</div>' +
    '<div class="legend-divider"></div>' +
    '<div class="legend-row"><span class="swatch swatch-solid"></span>Exact</div>' +
    '<div class="legend-row"><span class="swatch swatch-dashed"></span>Fuzzed <small>(<100 m)</small></div>' +
    '<div class="legend-divider"></div>' +
    '<div class="legend-row"><span class="swatch swatch-inat"></span>iNaturalist <small>(circle)</small></div>' +
    '<div class="legend-row"><span class="swatch swatch-sentinel"></span>Sentinelle <small>(square)</small></div>';
  return div;
};
legend.addTo(map);


// ============================================================
// 16. NAMES / HIGHLIGHTS — borough outline highlight
// ============================================================
const TYPE_LABEL = { 'Arrondissement': 'Borough', 'Ville liée': 'City' };
const NAME_EN = {
  'Montréal':       'Montreal',
  'Montréal-Est':   'Montreal East',
  'Montréal-Ouest': 'Montreal West',
  'Mont-Royal':     'Mount Royal'
};

function nameEn(feature) {
  const nom = (feature.properties.NOM || '').trim();
  return NAME_EN[nom] || nom;
}
function typeEn(feature) {
  const type = (feature.properties.TYPE || '').trim();
  return TYPE_LABEL[type] || type;
}

map.createPane('boroughHighlightPane');
map.getPane('boroughHighlightPane').style.zIndex = 650;
map.getPane('boroughHighlightPane').style.pointerEvents = 'none';

let highlightLayer = null;

function clearHighlight() {
  if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }
}

function highlightFeatureCollection(fc) {
  clearHighlight();
  if (!fc) return;
  highlightLayer = L.geoJSON(fc, {
    pane: 'boroughHighlightPane',
    interactive: false,
    style: { color: '#2D6A4F', weight: 4, opacity: 1, fill: false, fillColor: '#2D6A4F', fillOpacity: 0, lineJoin: 'round', lineCap: 'round' }
  }).addTo(map);
  highlightLayer.eachLayer(function (sub) {
    if (sub.setStyle) sub.setStyle({ fill: false, fillOpacity: 0 });
    if (sub._path) sub._path.setAttribute('fill', 'none');
    if (sub._fillPath) sub._fillPath.setAttribute('fill', 'none');
  });
}

function highlightBorough(feature) { highlightFeatureCollection(feature); }

function applyBoroughHighlightFromFilter() {
  if (filterState.boroughs.size === 0) { clearHighlight(); return; }
  if (!boroughData) return;

  const features = [];

  if (filterState.boroughs.has('__boroughs__') && boroughsUnion) {
    features.push(boroughsUnion);
  }

  const individuals = boroughData.features.filter(function (b) {
    return filterState.boroughs.has(nameEn(b));
  });
  individuals.forEach(function (f) { features.push(f); });

  if (!features.length) { clearHighlight(); return; }
  highlightFeatureCollection({ type: 'FeatureCollection', features: features });
}


// ============================================================
// 17. BOROUGH STATS PANEL — click a borough → side panel
// ============================================================
const BOROUGH_PANEL = document.getElementById('borough-panel');
const BP_TITLE      = document.getElementById('bp-title');
const BP_BODY       = document.getElementById('bp-body');
const BP_CLOSE      = document.getElementById('bp-close');
const openTiers = new Set();

if (BP_CLOSE) BP_CLOSE.addEventListener('click', closeBoroughPanel);
function closeBoroughPanel() {
  if (BOROUGH_PANEL) BOROUGH_PANEL.hidden = true;
  openTiers.clear();
}

const TIER_INFO = {
  high:     { label: 'High risk',     fill: '#e63946', border: '#8b0000' },
  moderate: { label: 'Moderate risk', fill: '#f4a261', border: '#a15c00' },
  low:      { label: 'Low risk',      fill: '#ffd166', border: '#7a6000' },
  unknown:  { label: 'Unclassified',  fill: '#adb5bd', border: '#444'    }
};

// ---- 17a. Which observations are in the current selection? ----
function observationsInSelection() {
  if (!window.turf || !allFeatures.length) return [];

  // --- 1. A borough was clicked: show only that polygon's observations ---
  if (selectedBorough) {
    return allFeatures.filter(function (f) {
      if (f.geometry === null) return false;
      const pt = turf.point([f.geometry.coordinates[0], f.geometry.coordinates[1]]);
      return turf.booleanPointInPolygon(pt, selectedBorough);
    });
  }

  // --- 2. No click; fall back to the borough filter ---
  if (!boroughData) return allFeatures;
  if (filterState.boroughs.size === 0) return allFeatures;

  const wantUnion = filterState.boroughs.has('__boroughs__');
  const named = new Set();
  filterState.boroughs.forEach(function (v) {
    if (v !== '__boroughs__') named.add(v);
  });

  const polys = [];
  if (wantUnion && boroughsUnion) polys.push(boroughsUnion);
  boroughData.features.forEach(function (b) {
    if (named.has(nameEn(b))) polys.push(b);
  });
  if (!polys.length) return allFeatures;

  return allFeatures.filter(function (f) {
    if (f.geometry === null) return false;
    const pt = turf.point([f.geometry.coordinates[0], f.geometry.coordinates[1]]);
    return polys.some(function (p) {
      return turf.booleanPointInPolygon(pt, p);
    });
  });
}

// ---- 17b. Labels for the selection ----
function selectionFullList() {
  // Click-selection wins if present
  if (selectedIsUnion) return ['Boroughs of Montreal (19)'];
  if (selectedBoroughName) return [selectedBoroughName];

  // Otherwise fall back to filter state
  const b = filterState.boroughs;
  const parts = [];
  if (b.has('__boroughs__')) parts.push('Boroughs of Montreal (19)');
  const names = [];
  b.forEach(function (v) {
    if (v !== '__boroughs__') names.push(v);
  });
  names.sort(function (a, c) { return a.localeCompare(c); });
  names.forEach(function (n) { parts.push(n); });
  return parts;
}

function selectionLabel() {
  const parts = selectionFullList();
  if (!parts.length) return 'All observations';
  if (parts.length === 1) return parts[0];
  if (parts.length <= 3) return parts.join(' + ');
  return parts[0] + ' + ' + (parts.length - 1) + ' more';
}

// ---- 17c. Count by tier + by species ----
function statsFor(obsList) {
  const byTier = { high: 0, moderate: 0, low: 0, unknown: 0 };
  const speciesByTier = { high: {}, moderate: {}, low: {}, unknown: {} };
  obsList.forEach(function (f) {
    const p = f.properties;
    const tier = p.risk || 'unknown';
    byTier[tier] = (byTier[tier] || 0) + 1;
    const name = p.common_name || p.scientific_name || p.species_guess || '(unnamed)';
    const sci  = p.scientific_name && p.scientific_name !== name ? p.scientific_name : '';
    const key  = name + '|' + sci;
    if (!speciesByTier[tier][key]) speciesByTier[tier][key] = { name: name, sci: sci, count: 0 };
    speciesByTier[tier][key].count += 1;
  });
  return { byTier: byTier, speciesByTier: speciesByTier };
}

function renderSpeciesListRows(byKey) {
  const rows = Object.values(byKey).sort(function (a, b) { return b.count - a.count; });
  let html = '<div class="bp-species">';
  rows.forEach(function (r) {
    html += '<div class="bp-species-row">' +
              '<div class="sp-name">' + r.name + (r.sci ? '<span class="sci">' + r.sci + '</span>' : '') + '</div>' +
              '<div class="sp-count">' + r.count + '</div>' +
            '</div>';
  });
  html += '</div>';
  return html;
}

// ---- 17d. Render the panel ----
function renderSelectionPanel() {
  if (!BOROUGH_PANEL) return;

  const obs = observationsInSelection();
  const stats = statsFor(obs);
  const full = selectionFullList();
  const label = selectionLabel();

  BP_TITLE.textContent = label;

  if (full.length > 3) {
    BP_TITLE.title = full.join('\n');
    BP_TITLE.classList.add('has-overflow');
  } else {
    BP_TITLE.removeAttribute('title');
    BP_TITLE.classList.remove('has-overflow');
  }

  let html = '<div class="bp-total">' + obs.length + ' observation' + (obs.length === 1 ? '' : 's') + '</div>';

  ['high', 'moderate', 'low', 'unknown'].forEach(function (tier) {
    const info = TIER_INFO[tier];
    const cnt = stats.byTier[tier] || 0;
    if (cnt === 0 && tier === 'unknown') return;
    const isOpen = openTiers.has(tier);
    html += '<button class="bp-tier' + (isOpen ? ' open' : '') + '" data-tier="' + tier + '">' +
              '<span class="swatch" style="background:' + info.fill + ';border-color:' + info.border + '"></span>' +
              '<span>' + info.label + '</span>' +
              '<span class="bp-count">' + cnt + '</span>' +
              '<span class="bp-caret">' + (isOpen ? '▾' : '▸') + '</span>' +
            '</button>';
    if (isOpen) html += renderSpeciesListRows(stats.speciesByTier[tier]);
  });

  BP_BODY.innerHTML = html;
  BOROUGH_PANEL.hidden = false;

  BP_BODY.querySelectorAll('.bp-tier').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const tier = btn.getAttribute('data-tier');
      if (openTiers.has(tier)) openTiers.delete(tier);
      else openTiers.add(tier);
      renderSelectionPanel();
    });
  });
}


// ============================================================
// 18. LOAD BOUNDARIES — fetch boroughs + the click handler
//     (this is the stopPropagation / panel-close interaction)
// ============================================================
fetch('data/limites-administratives-agglomeration.geojson')
  .then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' loading boundaries');
    return response.json();
  })
  .then(function (boundaryData) {
    boroughData = boundaryData;

    // ---- 18a. Build the union of all 19 boroughs (for the metro filter) ----
    try {
      const boroughFeatures = boundaryData.features.filter(function (b) {
        return ((b.properties.TYPE || '').trim()) === 'Arrondissement';
      });
      if (boroughFeatures.length && window.turf) {
        boroughsUnion = turf.union(turf.featureCollection(boroughFeatures));
      }
    } catch (e) {
      console.warn('Could not build borough union:', e);
    }

    buildBoroughList();

    // ---- 18b. Draw union outline FIRST (bottom), then boroughs on top ----
    if (boroughsUnion) {
      L.geoJSON(boroughsUnion, {
        style: {
          color: '#1B4332',
          weight: 3,
          opacity: 0.35,
          dashArray: '8,6',
          fill: false,
          interactive: false
        }
      }).addTo(map);
    }

    // ---- 18c. Draw boroughs (interactive) + click handler ----
    L.geoJSON(boundaryData, {
      style: function () {
        return { color: '#666', weight: 1, opacity: 0.6, fillColor: '#1F2D5A', fillOpacity: 0.05 };
      },
      onEachFeature: function (feature, layer) {
        const name = nameEn(feature);
        const type = typeEn(feature);
        layer.bindTooltip(name + (type ? ' (' + type + ')' : ''), { sticky: true });
        layer.on('click', function (e) {
          // Prevent the map-level click handler from also firing and closing the panel.
          L.DomEvent.stopPropagation(e);
          const same = selectedBorough === feature;
          if (same) {
            selectedBorough = null;
            selectedBoroughName = null;
            selectedIsUnion = false;
            clearHighlight();
            closeBoroughPanel();
            return;
          }
          selectedBorough = feature;
          selectedBoroughName = nameEn(feature);
          selectedIsUnion = false;
          highlightBorough(feature);
          openTiers.clear();
          renderSelectionPanel();
        });
        layer.on('mouseover', function () { layer.setStyle({ weight: 2, opacity: 1 }); });
        layer.on('mouseout', function () { layer.setStyle({ weight: 1, opacity: 0.6 }); });
      }
    }).addTo(map);

    // ---- 18d. Click empty map → clear selection ----
    map.on('click', function () {
      selectedBorough = null;
      selectedBoroughName = null;
      selectedIsUnion = false;
      clearHighlight();
      closeBoroughPanel();
    });

    applyBoroughHighlightFromFilter();

    buildObsLayer();
    renderSelectionPanel();
  })
  .catch(function (err) { console.error('Could not load boundaries:', err); });


// ============================================================
// 19. LIGHTBOX — click a popup thumbnail → full-size image
// ============================================================
document.addEventListener('click', function (e) {
  const img = e.target.closest('.popup-thumb[data-full]');
  if (!img) return;
  const full = img.getAttribute('data-full');
  if (!full) return;
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML =
    '<div class="lightbox-content"><img src="' + full + '" alt="">' +
    '<button class="lightbox-close" aria-label="Close">×</button></div>';
  overlay.addEventListener('click', function (ev) {
    if (ev.target === overlay || ev.target.classList.contains('lightbox-close')) overlay.remove();
  });
  const onKey = function (ev) {
    if (ev.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
});


// ============================================================
// 20. STORY OVERLAY — "About this map" modal
// ============================================================
(function () {
  const openBtn  = document.getElementById('story-open');
  const overlay  = document.getElementById('story-overlay');
  const closeBtn = document.getElementById('story-close');
  if (!openBtn || !overlay || !closeBtn) return;
  function openStory() {
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function closeStory() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    openBtn.focus();
  }
  openBtn.addEventListener('click', openStory);
  closeBtn.addEventListener('click', closeStory);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeStory(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !overlay.hidden) closeStory();
  });
})();


// ============================================================
// 21. SENTINELLE LAYER (toggleable) — second dataset
// ============================================================
map.createPane('sentinelPane');
map.getPane('sentinelPane').style.zIndex = 640;

function buildSentinelLayer() {
  if (sentinelLayer) {
    map.removeLayer(sentinelLayer);
    sentinelLayer = null;
  }
  if (!sentinelVisible || sentinelFeatures.length === 0) return;

  const filtered = sentinelFeatures.filter(passesSentinelFilters);

  sentinelLayer = L.geoJSON(
    { type: 'FeatureCollection', features: filtered },
    {
      // ---- 21a. Square marker instead of a circle ----
      pointToLayer: function (feature, latlng) {
        const p = feature.properties;
        const fill = ({
          high:     '#e63946',
          moderate: '#f4a261',
          low:      '#ffd166',
          unknown:  '#adb5bd'
        })[p.risk] || '#adb5bd';

        const sq = L.divIcon({
          className: 'sentinel-square',
          html: '<div style="width:11px;height:11px;background:' + fill + ';border:2px solid #fbf8f8;box-sizing:border-box;"></div>',
          iconSize: [13, 13],
          iconAnchor: [5, 5]
        });
        return L.marker(latlng, { icon: sq, pane: 'sentinelPane' });
      },
      // ---- 21b. Popup — French → English translation tables ----
      onEachFeature: function (feature, layer) {
        const p = feature.properties;

        const CATEGORY_EN = {
          'Plante envahissante': 'Invasive plant',
          'Plante exotique envahissante': 'Invasive exotic plant',
          'Insecte': 'Insect',
          'Poisson': 'Fish',
          'Oiseau': 'Bird',
          'Mammifère': 'Mammal',
          'Amphibien': 'Amphibian',
          'Reptile': 'Reptile',
          'Mollusque': 'Mollusc',
          'Crustacé': 'Crustacean'
        };

        const REGION_EN = {
          'Abitibi-Témiscamingue': 'Abitibi-Témiscamingue',
          'Bas-Saint-Laurent': 'Bas-Saint-Laurent',
          'Capitale-Nationale': 'Capitale-Nationale',
          'Centre-du-Québec': 'Centre-du-Québec',
          'Chaudière-Appalaches': 'Chaudière-Appalaches',
          'Côte-Nord': 'Côte-Nord',
          'Estrie': 'Estrie',
          'Gaspésie–Îles-de-la-Madeleine': 'Gaspésie–Îles-de-la-Madeleine',
          'Lanaudière': 'Lanaudière',
          'Laurentides': 'Laurentides',
          'Laval': 'Laval',
          'Mauricie': 'Mauricie',
          'Montérégie': 'Montérégie',
          'Montréal': 'Montreal',
          'Nord-du-Québec': 'Nord-du-Québec',
          'Outaouais': 'Outaouais',
          'Saguenay–Lac-Saint-Jean': 'Saguenay–Lac-Saint-Jean'
        };

        const PRESENCE_EN = {
          'Établie': 'Established',
          'Absente': 'Absent',
          'Observation unique': 'Single observation',
          'Non détectée': 'Not detected'
        };

        const enName  = (p.common_name_en || '').trim();
        const latin   = (p.scientific_name || p['Nom_espece_latin'] || '').trim();
        const frName  = (p['Nom_espece_français'] || '').trim();
        const title   = enName || latin || frName || 'Unknown';
        const latinLine = latin && latin !== title ? latin : '';

        const date    = p['Date_observation'] || '';
        const regionFr = (p['Nom_region_administrative'] || '').trim();
        const region  = REGION_EN[regionFr] || regionFr;
        const catFr   = (p['Categorie'] || '').trim();
        const category = CATEGORY_EN[catFr] || catFr;
        const presenceFr = (p['Presence'] || '').trim();
        const presence   = PRESENCE_EN[presenceFr] || presenceFr;
        const photo   = p['Lien_photo'] || '';

        const RISK_LABEL = { high: 'High risk', moderate: 'Moderate risk', low: 'Low risk', unknown: 'Unclassified' };
        const BADGE = {
          high:     { bg: '#fde2e4', fg: '#8b0000', border: '#e63946' },
          moderate: { bg: '#fdead2', fg: '#7a4500', border: '#f4a261' },
          low:      { bg: '#fff4c2', fg: '#5c4700', border: '#ffd166' },
          unknown:  { bg: '#e9ecef', fg: '#333',    border: '#adb5bd' }
        };
        const b = BADGE[p.risk] || BADGE.unknown;

        let html = '<div class="popup-head">';
        if (photo) {
          html += '<img class="popup-thumb" src="' + photo + '" data-full="' + photo + '" alt="">';
        } else {
          html += '<div class="popup-thumb popup-thumb-empty"><span>No photo</span></div>';
        }
        html += '<div class="popup-headtext">';
        html += '<div class="popup-title">' + title + '</div>';
        if (latinLine) html += '<div class="popup-latin"><em>' + latinLine + '</em></div>';
        html += '<div class="popup-badge" style="background:#d8f3dc;color:#1b4332;border:1px solid #40916c;margin-right:4px;">Sentinelle</div>';
        html += '<div class="popup-badge" style="background:' + b.bg + ';color:' + b.fg + ';border:1px solid ' + b.border + ';">' + (RISK_LABEL[p.risk] || 'Unclassified') + '</div>';
        html += '</div></div>';

        html += '<div class="popup-grid">';
        if (date)     html += '<div><span class="lbl">Observed</span>' + date + '</div>';
        if (region)   html += '<div><span class="lbl">Region</span>' + region + '</div>';
        if (presence) html += '<div><span class="lbl">Presence</span>' + presence + '</div>';
        if (category) html += '<div class="popup-grid-wide"><span class="lbl">Category</span>' + category + '</div>';
        html += '</div>';

        layer.bindPopup(html, { maxWidth: 300, minWidth: 260, maxHeight: 420 });
      }
    }
  ).addTo(map);
}

// ---- 21c. Fetch Sentinelle data and draw if visible ----
fetch('data/sentinel_wgs84.geojson')
  .then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' loading sentinel_wgs84.geojson');
    return r.json();
  })
  .then(function (data) {
    sentinelFeatures = data.features;
    console.log('Sentinelle features loaded:', sentinelFeatures.length);
    buildYearList();   // pick up years only present in Sentinelle data
    if (sentinelVisible) buildSentinelLayer();
  })
  .catch(function (err) { console.error('Could not load Sentinelle data:', err); });