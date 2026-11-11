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
//    6.  Render observations             → clustered iNaturalist popups
//   7.  Initial load                    → fetch places.geojson
//   8.  Popover open/close              → dropdown behaviour
//   9.  Summary badges                  → "All" / "N selected" labels
//   10. Species list (popover)          → search + checkboxes
//   11. Risk checkboxes                 → risk filter UI
//   11b.Year filter                     → year filter UI
//   12. Borough list (popover)          → borough filter UI
//   13. Simple toggles                  → precision / photo / iNat / Sentinelle
//   14. Reset                           → Reset button
//   15. Legend                          → bottom-right legend
//   16. Names / highlights              → borough outline highlight
//   17. Borough stats panel             → click a borough → panel
//   18. Load boundaries                 → fetch boundaries + click handler
//   19. Lightbox                        → click thumbnail → full image
//   20. Story overlay                   → "About this map" modal
//    21. Sentinelle layer                → toggleable clustered second dataset
// ============================================================


// ============================================================
// 1. MAP SETUP — starting view, bounds, base tiles
// ============================================================
const map = L.map('map', {
  maxBounds: [[45.05, -74.35], [46.00, -73.05]],
  minZoom: 10.4,
  maxBoundsViscosity: 1.0
}).setView([45.51, -73.58], 12);

const POPUP_VIEWPORT_PADDING = 40;
let activeMapPopup = null;

function popupMaxHeight() {
  return Math.min(360, Math.max(100, map.getSize().y - 80));
}

function popupOptions(options) {
  return Object.assign({
    autoPan: true,
    autoPanPaddingTopLeft: [POPUP_VIEWPORT_PADDING, POPUP_VIEWPORT_PADDING],
    autoPanPaddingBottomRight: [POPUP_VIEWPORT_PADDING, POPUP_VIEWPORT_PADDING],
    maxHeight: popupMaxHeight()
  }, options);
}

function keepPopupVisible(popup) {
  popup.options.maxHeight = popupMaxHeight();
  popup.update();

  requestAnimationFrame(function () {
    if (activeMapPopup !== popup || !popup.isOpen()) return;
    const popupElement = popup.getElement();
    if (!popupElement) return;

    const popupBounds = popupElement.getBoundingClientRect();
    const mapBounds = map.getContainer().getBoundingClientRect();
    let offsetX = 0;
    let offsetY = 0;

    if (popupBounds.left < mapBounds.left + POPUP_VIEWPORT_PADDING) {
      offsetX = popupBounds.left - mapBounds.left - POPUP_VIEWPORT_PADDING;
    } else if (popupBounds.right > mapBounds.right - POPUP_VIEWPORT_PADDING) {
      offsetX = popupBounds.right - mapBounds.right + POPUP_VIEWPORT_PADDING;
    }

    if (popupBounds.top < mapBounds.top + POPUP_VIEWPORT_PADDING) {
      offsetY = popupBounds.top - mapBounds.top - POPUP_VIEWPORT_PADDING;
    } else if (popupBounds.bottom > mapBounds.bottom - POPUP_VIEWPORT_PADDING) {
      offsetY = popupBounds.bottom - mapBounds.bottom + POPUP_VIEWPORT_PADDING;
    }

    if (offsetX || offsetY) {
      map.panBy([offsetX, offsetY], { animate: true, duration: 0.2 });
    }
  });
}

map.on('popupopen', function (event) {
  activeMapPopup = event.popup;
  keepPopupVisible(activeMapPopup);
});

map.on('popupclose', function (event) {
  if (activeMapPopup === event.popup) activeMapPopup = null;
});

map.on('resize', function () {
  if (activeMapPopup) keepPopupVisible(activeMapPopup);
});

function showDataLoadError(message, err) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.innerHTML =
      '<div class="status-line status-line-main">Data unavailable</div>' +
      '<div class="status-line">' + message + '</div>';
    statusEl.classList.add('is-error');
    statusEl.classList.remove('is-filtered');
  }

  const mapEl = document.getElementById('map');
  if (mapEl) {
    let errorPanel = mapEl.querySelector('.map-data-error');
    if (!errorPanel) {
      errorPanel = document.createElement('div');
      errorPanel.className = 'map-data-error';
      mapEl.appendChild(errorPanel);
    }
    errorPanel.textContent = message;
  }

  if (err) console.error(message, err);
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
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
  approximateLocation: false,
  preciseLocation: false,
  photo: false,
  presence: new Set(),
  priorityOnly: false
};

const PHOTO_LICENSE_URLS = {
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC-BY': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-NC': 'https://creativecommons.org/licenses/by-nc/4.0/'
};

function normalizePriorityName(name) {
  return String(name || '').toLowerCase().trim()
    .replace(/×/g, 'x')
    .replace(/\s+subsp\.\s+/g, ' ')
    .replace(/\s+/g, ' ');
}

const normalizedPrioritySpecies = new Set(
  Array.from(PRIORITY_SPECIES, normalizePriorityName)
);

function isPrioritySpecies(name) {
  return normalizedPrioritySpecies.has(normalizePriorityName(name));
}

function hasReusableObservationLicense(properties) {
  const license = String(properties.license || '').trim().toLowerCase();
  return license !== '' && license !== 'arr' && license !== 'all rights reserved';
}

// ---- 3a. Layer + data state ----
let obsLayer = null;
let allFeatures = [];
let observationDataLoaded = false;
let boroughData = null;
let boroughsUnion = null;
let speciesCatalog = [];
let observationDensityLayer = null;
let mapMode = 'risk';
let thematicUpdatePending = false;

// ---- 3b. Sentinelle layer state ----
let sentinelLayer = null;
let sentinelFeatures = [];
let sentinelVisible = false;
let clustersEnabled = false;

// ---- 3c. Community projects layer ----
let projectLayer = null;
let projectFeatures = [];
let projectsVisible = true;
let projectsLoaded = false;
let projectsLoadFailed = false;
let projectsSourcesLastChecked = null;
let observationDataUpdatedAt = null;
let newObservationsLastRefresh = null;
let statusFeatures = [];

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
  statusFeatures = filtered;

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
  html += '<div class="status-line status-line-updated">iNaturalist data updated: ' +
    (observationDataUpdatedAt
      ? new Date(observationDataUpdatedAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
      : 'no successful refresh yet') +
    '</div>';
  if (newObservationsLastRefresh !== null) {
    html += '<div class="status-line status-line-updated">' +
      newObservationsLastRefresh.toLocaleString() +
      ' new qualifying observation' + (newObservationsLastRefresh === 1 ? '' : 's') +
      ' since previous refresh' +
      '</div>';
  }

  if (boroughData) {
    html += '<div class="status-line">' +
              boroughCount + ' borough' + (boroughCount === 1 ? '' : 's') +
              (cityCount ? ' · ' + cityCount + ' cit' + (cityCount === 1 ? 'y' : 'ies') : '') +
            '</div>';
  }

  el.innerHTML = html;
  el.classList.toggle('is-filtered', shown !== total);
}

fetch('data/refresh_metadata.json', { cache: 'no-store' })
  .then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' loading refresh metadata');
    return response.json();
  })
  .then(function (metadata) {
    if (!metadata ||
        (metadata.last_updated !== null &&
          (typeof metadata.last_updated !== 'string' || Number.isNaN(Date.parse(metadata.last_updated)))) ||
        (metadata.new_observations !== null &&
          (!Number.isInteger(metadata.new_observations) || metadata.new_observations < 0))) {
      throw new Error('refresh_metadata.json contains invalid refresh metadata');
    }
    observationDataUpdatedAt = metadata.last_updated;
    newObservationsLastRefresh = metadata.new_observations;
    updateStatusSummary(statusFeatures);
  })
  .catch(function (error) {
    console.error('Could not load iNaturalist refresh metadata:', error);
  });


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


// ---- 4a. Open the map pre-filtered from the species catalog (?species=Latin name) ----
// Names are compared on genus + species so "Phragmites australis subsp. australis"
// (catalog) matches "Phragmites australis australis" (iNaturalist), and a genus
// entry ("Rhamnus spp.") matches every species in that genus.
function latinBinomial(name) {
  const parts = String(name || '').toLowerCase()
    .replace(/×/g, ' x ')
    .replace(/\b(var|subsp|ssp|f|forma)\.\s*/g, ' ')
    .split(/\s+/)
    .filter(function (w) { return w && w !== 'x'; });
  if (!parts.length) return '';
  if (!parts[1] || parts[1] === 'spp.' || parts[1] === 'sp.') return parts[0];
  return parts[0] + ' ' + parts[1];
}

let requestedSpeciesApplied = false;
function applyRequestedSpecies() {
  const requested = new URLSearchParams(window.location.search).get('species');
  if (!requested) return false;
  const target = latinBinomial(requested);
  if (!target) return false;
  const genusOnly = target.indexOf(' ') === -1;
  const matches = speciesCatalog.filter(function (s) {
    const b = latinBinomial(s.sci);
    return genusOnly ? b.split(' ')[0] === target : b === target;
  });
  if (!matches.length) return false;
  filterState.species.clear();
  matches.forEach(function (s) { filterState.species.add(s.key); });
  requestedSpeciesApplied = true;
  return true;
}


// ============================================================
// 5. OBSERVATION FILTER — decides which iNat dots are visible
//    This is the core action's filtering logic.
// ============================================================
function isObscured(properties) {
  const v = properties.coordinates_obscured;
  return v === true || v === 'true' || v === 'True';
}

// Location precision: every iNaturalist record is downloaded with accuracy
// under 100 m. Records with a stated accuracy above 10 m are "approximate"
// (dashed outline); 10 m or better (or no accuracy value, e.g. Sentinelle)
// counts as precise.
const PRECISE_ACCURACY_M = 10;
function isApproximateLocation(properties) {
  const raw = properties.public_positional_accuracy;
  if (raw === null || raw === undefined || raw === '') return false;
  const accuracy = Number(raw);
  return Number.isFinite(accuracy) && accuracy > PRECISE_ACCURACY_M;
}

function passesFilters(f, ignoreSelectedYears, ignoreSelectedBoroughs) {
  if (f.geometry === null) return false;
  const p = f.properties;
  const ignoreYearFilter = ignoreSelectedYears === true;

  const tier = p.risk || 'unknown';
  if (!filterState.risk.has(tier)) return false;

  // Year filter
  if (!ignoreYearFilter && filterState.years.size > 0) {
    const y = (p.observed_on || '').slice(0, 4);
    if (!filterState.years.has(y)) return false;
  }

  const approximateLocation = isApproximateLocation(p);
  if (filterState.approximateLocation && !approximateLocation) return false;
  if (filterState.preciseLocation && approximateLocation) return false;

  if (filterState.photo && !p.image_url) return false;
  if (filterState.presence.size > 0 && !filterState.presence.has(p.presence)) return false;
  if (filterState.priorityOnly && !isPrioritySpecies(p.scientific_name)) return false;

  if (filterState.species.size > 0) {
    const key = (p.common_name || p.scientific_name || '') + '|' + (p.scientific_name || '');
    if (!filterState.species.has(key)) return false;
  }

  if (!ignoreSelectedBoroughs && !inSelectedBoroughs(f)) return false;

  return true;
}

// True when no borough filter is set, or the point lies in a selected borough/city
function inSelectedBoroughs(f) {
  if (filterState.boroughs.size === 0 || !boroughData || !window.turf) return true;
  if (f.geometry === null) return false;
  const pt = turf.point([f.geometry.coordinates[0], f.geometry.coordinates[1]]);
  if (filterState.boroughs.has('__boroughs__') && boroughsUnion &&
      turf.booleanPointInPolygon(pt, boroughsUnion)) return true;
  return boroughData.features.some(function (b) {
    if (!filterState.boroughs.has(nameEn(b))) return false;
    return turf.booleanPointInPolygon(pt, b);
  });
}

// ---- 5a. Species present in the selected boroughs (cached per borough selection) ----
let boroughSpeciesCacheKey = null;
let boroughSpeciesCounts = null;   // null = no borough filter → every species available
function speciesCountsInSelectedBoroughs() {
  const key = Array.from(filterState.boroughs).sort().join('||') + '#' + (boroughData ? 1 : 0);
  if (key === boroughSpeciesCacheKey) return boroughSpeciesCounts;
  boroughSpeciesCacheKey = key;
  if (filterState.boroughs.size === 0 || !boroughData || !window.turf) {
    boroughSpeciesCounts = null;
    return null;
  }
  const counts = new Map();
  allFeatures.forEach(function (f) {
    if (!inSelectedBoroughs(f)) return;
    const p = f.properties;
    const k = (p.common_name || p.scientific_name || '') + '|' + (p.scientific_name || '');
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  boroughSpeciesCounts = counts;
  return counts;
}

// Catalog entries to offer in the Species filter: only those observed in the
// selected boroughs (plus any already checked, so they can be unchecked).
function availableSpecies() {
  const counts = speciesCountsInSelectedBoroughs();
  if (!counts) return speciesCatalog;
  return speciesCatalog.filter(function (s) {
    return counts.has(s.key) || filterState.species.has(s.key);
  });
}


// ============================================================
// 5b. SENTINELLE FILTER — same filters, Sentinelle column names
// ============================================================
function passesSentinelFilters(f, ignoreSelectedYears, ignoreSelectedBoroughs) {
  if (f.geometry === null) return false;
  const p = f.properties;
  const ignoreYearFilter = ignoreSelectedYears === true;

  const tier = p.risk || 'unknown';
  if (!filterState.risk.has(tier)) return false;

  // Year filter
  if (!ignoreYearFilter && filterState.years.size > 0) {
    const y = (p['Date_observation'] || '').slice(0, 4);
    if (!filterState.years.has(y)) return false;
  }

  if (filterState.photo && !p['Lien_photo']) return false;

  if (filterState.presence.size > 0 && !filterState.presence.has(p.Presence)) return false;
  if (filterState.priorityOnly &&
      !isPrioritySpecies(p.scientific_name || p['Nom_espece_latin'])) return false;

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
  if (!ignoreSelectedBoroughs && filterState.boroughs.size > 0 && boroughData && window.turf) {
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

function observationYear(feature, source) {
  const props = feature.properties || {};
  const raw = source === 'sentinel' ? props.Date_observation : props.observed_on;
  const year = String(raw || '').slice(0, 4);
  return /^\d{4}$/.test(year) ? year : '';
}

function renderObservationTrendChart() {
  const chart = document.getElementById('trend-chart');
  if (!chart || chart.closest('.trend-panel').hidden) return;

  const years = new Set();
  const countsByYear = Object.create(null);

  function countFeature(feature, source, passesFilter, countKey) {
    const year = observationYear(feature, source);
    if (!year) return;
    years.add(year);
    if (!passesFilter(feature, true)) return;
    if (!countsByYear[year]) countsByYear[year] = { inat: 0, sentinel: 0 };
    countsByYear[year][countKey]++;
  }

  allFeatures.forEach(function (feature) {
    countFeature(feature, 'inat', passesFilters, 'inat');
  });
  sentinelFeatures.forEach(function (feature) {
    countFeature(feature, 'sentinel', passesSentinelFilters, 'sentinel');
  });

  const orderedYears = Array.from(years).sort();
  const buckets = [];
  const earlyYears = orderedYears.filter(function (year) { return Number(year) < 2013; });
  if (earlyYears.length) buckets.push({ label: 'Before 2013', years: earlyYears });
  orderedYears.filter(function (year) { return Number(year) >= 2013; }).forEach(function (year) {
    buckets.push({ label: year, years: [year] });
  });

  const counts = buckets.map(function (bucket) {
    const yearly = bucket.years.reduce(function (total, year) {
      const current = countsByYear[year] || { inat: 0, sentinel: 0 };
      total.inat += current.inat;
      total.sentinel += current.sentinel;
      return total;
    }, { inat: 0, sentinel: 0 });
    const inat = yearly.inat;
    const sentinel = yearly.sentinel;
    return { bucket: bucket, inat: inat, sentinel: sentinel, total: inat + sentinel };
  });
  const maxCount = Math.max.apply(null, counts.map(function (entry) { return entry.total; }).concat([1]));

  if (!counts.length) {
    chart.innerHTML = '<p class="trend-empty">No dated observation records are available.</p>';
    return;
  }

  chart.innerHTML = counts.map(function (entry) {
    const selectedCount = entry.bucket.years.filter(function (year) {
      return filterState.years.has(year);
    }).length;
    const selected = selectedCount === entry.bucket.years.length &&
      filterState.years.size > 0;
    const partial = selectedCount > 0 && !selected;
    const inatWidth = (entry.inat / maxCount) * 100;
    const sentinelWidth = (entry.sentinel / maxCount) * 100;
    const yearLabel = entry.bucket.years.join(',');
    const label = entry.bucket.label + ': ' + entry.inat.toLocaleString() +
      ' iNaturalist and ' + entry.sentinel.toLocaleString() +
      ' Sentinelle records. Click to filter the map.';
    return '<button type="button" class="trend-row' +
      (selected ? ' is-selected' : '') + (partial ? ' is-partial' : '') +
      '" data-years="' + yearLabel + '" aria-pressed="' + selected +
      '" aria-label="' + escapeAttr(label) + '" title="' + escapeAttr(label) + '">' +
      '<span class="trend-year">' + entry.bucket.label + '</span>' +
      '<span class="trend-track" aria-hidden="true">' +
      '<span class="trend-bar-inat" style="width:' + inatWidth + '%"></span>' +
      '<span class="trend-bar-sentinel" style="width:' + sentinelWidth + '%"></span>' +
      '</span><span class="trend-total">' + entry.total.toLocaleString() + '</span></button>';
  }).join('');

  chart.querySelectorAll('.trend-row').forEach(function (row) {
    row.addEventListener('click', function () {
      const selectedYears = row.getAttribute('data-years').split(',');
      const allSelected = selectedYears.every(function (year) {
        return filterState.years.has(year);
      });

      if (filterState.years.size === 0) {
        filterState.years = new Set(selectedYears);
      } else if (allSelected) {
        selectedYears.forEach(function (year) { filterState.years.delete(year); });
      } else {
        selectedYears.forEach(function (year) { filterState.years.add(year); });
      }

      document.querySelectorAll('#f-year-list input[data-year]').forEach(function (checkbox) {
        checkbox.checked = filterState.years.has(checkbox.getAttribute('data-year'));
      });
      syncYearAllCheckbox();
      updateSummaries();
      buildObsLayer();
      buildSentinelLayer();
    });
  });
}

const trendOpen = document.getElementById('trend-open');
const trendClose = document.getElementById('trend-close');
const trendPanel = document.getElementById('trend-panel');

if (trendOpen && trendClose && trendPanel) {
  trendOpen.addEventListener('click', function () {
    trendPanel.hidden = false;
    trendOpen.setAttribute('aria-expanded', 'true');
    renderObservationTrendChart();
    trendClose.focus();
  });

  function closeTrendPanel() {
    trendPanel.hidden = true;
    trendOpen.setAttribute('aria-expanded', 'false');
    trendOpen.focus();
  }

  trendClose.addEventListener('click', closeTrendPanel);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !trendPanel.hidden) closeTrendPanel();
  });
}

function observationsForMap(ignoreBoroughFilter) {
  const features = [];
  if (inatVisible) {
    features.push.apply(features, allFeatures.filter(function (feature) {
      return passesFilters(feature, false, ignoreBoroughFilter);
    }));
  }
  if (sentinelVisible) {
    features.push.apply(features, sentinelFeatures.filter(function (feature) {
      return passesSentinelFilters(feature, false, ignoreBoroughFilter);
    }));
  }
  return features;
}

function updateThematicMapLayers() {
  if (observationDensityLayer) {
    map.removeLayer(observationDensityLayer);
    observationDensityLayer = null;
  }
  if (mapMode === 'density') {
    const heatPoints = observationsForMap(false).filter(function (feature) {
      return feature.geometry && feature.geometry.type === 'Point' &&
        Array.isArray(feature.geometry.coordinates);
    }).map(function (feature) {
      return [feature.geometry.coordinates[1], feature.geometry.coordinates[0], 1];
    });
    if (heatPoints.length) {
      observationDensityLayer = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 20,
        minOpacity: 0.18,
        maxZoom: 16,
        gradient: { 0.2: '#2c7bb6', 0.45: '#abd9e9', 0.65: '#ffffbf', 0.82: '#fdae61', 1: '#d7191c' }
      }).addTo(map);
    }
    return;
  }
}

function scheduleThematicMapLayerUpdate() {
  if (thematicUpdatePending) return;
  thematicUpdatePending = true;
  requestAnimationFrame(function () {
    thematicUpdatePending = false;
    updateThematicMapLayers();
  });
}


// ============================================================
// 6. RENDER OBSERVATIONS — builds the clustered iNat layer + popups
//    pointToLayer = the dot itself; onEachFeature = the popup.
// ============================================================
function buildObsLayer() {
  if (obsLayer) { map.removeLayer(obsLayer); obsLayer = null; }
  renderObservationTrendChart();
  // Wrap the call: Array.filter would pass (index, array) into the "ignore" flags
  const filtered = allFeatures.filter(function (f) { return passesFilters(f); });
  if (mapMode !== 'risk' || !inatVisible) {
    if (inatVisible) updateStatusSummary(filtered);
    scheduleThematicMapLayerUpdate();
    return;
  }

  const observationMarkers = L.geoJSON(
    { type: 'FeatureCollection', features: filtered },
    {
      // ---- 6a. The dot itself ----
      pointToLayer: function (feature, latlng) {
        const p = feature.properties;
        const s = styleFor(p);
        const approximateLocation = isApproximateLocation(p);
        if (!clustersEnabled) {
          return L.circleMarker(latlng, {
            radius: approximateLocation ? 7 : 6,
            weight: approximateLocation ? 2 : 1.5,
            dashArray: approximateLocation ? '3,3' : null,
            color: s.color,
            fillColor: s.fillColor,
            fillOpacity: approximateLocation ? 0.55 : 0.9
          });
        }

        const markerSize = approximateLocation ? 16 : 14;
        const marker = L.divIcon({
          className: '',
          html: '<span class="inat-observation-marker' + (approximateLocation ? ' is-approximate' : '') +
            '" style="--marker-stroke:' + s.color + ';--marker-fill:' + s.fillColor +
            ';--marker-opacity:' + (approximateLocation ? '0.55' : '0.9') + ';"></span>',
          iconSize: [markerSize, markerSize],
          iconAnchor: [markerSize / 2, markerSize / 2]
        });
        return L.marker(latlng, { icon: marker });
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
        const approximateLocation = isApproximateLocation(p);

        let html = '<div class="popup-head">';
        if (p.image_url) {
          html += '<img class="popup-thumb" src="' + p.image_url + '" data-full="' + p.image_url + '" alt="">';
        } else {
          html += '<div class="popup-thumb popup-thumb-empty"><span>No photo</span></div>';
        }
        html += '<div class="popup-headtext">';
        html += '<div class="popup-title">' + title + '</div>';
        // Latin name links to this species' entry in the catalog
        const latinName = p.scientific_name || '';
        if (latinName) {
          const catalogUrl = 'site/species.html?species=' + encodeURIComponent(latinName);
          html += '<div class="popup-latin"><a class="popup-latin-link" href="' + escapeAttr(catalogUrl) +
            '" title="Open in species catalog"><em>' + escapeHtml(latinName) + '</em></a></div>';
        }
        html += '<button type="button" class="popup-badge popup-badge-info" data-info="risk" title="What does this risk level mean?" style="background:' + badge.bg + ';color:' + badge.fg + ';border:1px solid ' + badge.border + ';">' + s.label + '</button>';
        html += '</div></div>';
        if (p.image_url && p.photo_attribution && PHOTO_LICENSE_URLS[p.photo_license]) {
          html += '<div class="popup-photo-attribution">Photo credit: ' +
            escapeHtml(p.photo_attribution) + ' · <a href="' +
            PHOTO_LICENSE_URLS[p.photo_license] +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(p.photo_license) + '</a></div>';
        }

        html += '<div class="popup-grid">';
        if (p.observed_on) html += '<div><span class="lbl">Observed</span>' + p.observed_on + '</div>';
        if (p.user_login)  html += '<div><span class="lbl">By</span>' + p.user_login + '</div>';
        if (p.place_guess) html += '<div class="popup-grid-wide"><span class="lbl">Place</span>' + p.place_guess + '</div>';
        if (p.presence) {
          const statusLabel = p.presence === 'Single observation' ? 'Occasional observation' : p.presence;
          html += '<div class="popup-grid-wide"><span class="lbl">Québec status</span>' +
            '<button type="button" class="popup-status-link" data-info="presence" title="What does the Québec status mean?">' +
            escapeHtml(statusLabel) + '</button>' +
            (p.banned ? ' · REFEE' : '') + '</div>';
        }
        html += '</div>';

        if (approximateLocation) html += '<div class="popup-approximate">Approximate location (10–100 m)</div>';
        if (p.photo_present && !p.image_url) {
          const photoLicense = p.photo_license || 'All rights reserved';
          const photoNote = !p.photo_license_verified
            ? 'Photo omitted — its license could not be verified.'
            : 'Photo omitted — photo license ' + photoLicense + ' does not permit reuse.';
          html += '<div class="popup-photo-note">' + escapeHtml(photoNote) + '</div>';
        }
        if (p.url) html += '<a class="popup-btn" href="' + p.url + '" target="_blank" rel="noopener noreferrer">View on iNaturalist →</a>';
        const license = p.license ? String(p.license).replace(/^CC-/, 'CC ') : 'All rights reserved';
        html += '<div class="popup-license"><span class="popup-license-label">Observation license:</span> ' + escapeHtml(license) + '</div>';

        layer.bindPopup(html, popupOptions({ maxWidth: 300, minWidth: 260 }));
      }
    }
  );

  if (!clustersEnabled) {
    obsLayer = observationMarkers.addTo(map);
    updateStatusSummary(filtered);
    scheduleThematicMapLayerUpdate();
    return;
  }

  obsLayer = L.markerClusterGroup({
    maxClusterRadius: 50,
    disableClusteringAtZoom: 16,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      const sizeClass = count < 100 ? 'small' : (count < 1000 ? 'medium' : 'large');
      const size = count < 100 ? 36 : (count < 1000 ? 44 : 52);
      return L.divIcon({
        html: '<div class="observation-cluster observation-cluster-' + sizeClass +
          '" title="Click to zoom in and explore observations">' +
          count.toLocaleString() + '</div>',
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    }
  });
  obsLayer.addLayer(observationMarkers);
  map.addLayer(obsLayer);

  updateStatusSummary(filtered);
  scheduleThematicMapLayerUpdate();
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
    allFeatures = data.features.filter(function (feature) {
      const p = feature.properties || {};
      // Obscured coordinates are randomized within ~27 km — too imprecise to map
      if (isObscured(p)) return false;
      return hasReusableObservationLicense(p);
    });
    observationDataLoaded = true;
    buildSpeciesCatalog();
    applyRequestedSpecies();
    buildYearList();
    populateSpeciesList();
    if (requestedSpeciesApplied) {
      syncSpeciesAllCheckbox();
      updateSummaries();
    }
    buildObsLayer();
    if (boroughData) renderSelectionPanel();

    // Zoom to the requested species if one came from the catalog, else to everything
    const fitFeatures = requestedSpeciesApplied
      ? allFeatures.filter(function (f) {
          const p = f.properties;
          return filterState.species.has((p.common_name || p.scientific_name || '') + '|' + (p.scientific_name || ''));
        })
      : allFeatures;
    const allLayer = L.geoJSON(
      { type: 'FeatureCollection', features: fitFeatures },
      { filter: function (f) { return f.geometry !== null; } }
    );
    const bounds = allLayer.getBounds();
    // maxZoom keeps a single observation from zooming in to street level
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.1), { maxZoom: requestedSpeciesApplied ? 14 : 18 });
  })
  .catch(function (err) {
    showDataLoadError('Could not load the observation data (places.geojson). The map is blank until the request succeeds.', err);
  });


// ============================================================
// 8. POPOVER OPEN/CLOSE — dropdown behaviour for the filter bar
// ============================================================
function closeAllPopovers() {
  document.querySelectorAll('.fp-panel').forEach(function (p) {
    p.hidden = true;
    p.style.removeProperty('left');
    p.style.removeProperty('top');
  });
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
    if (!wasOpen) {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      if (window.matchMedia('(max-width: 700px)').matches) {
        const buttonBounds = btn.getBoundingClientRect();
        const panelBounds = panel.getBoundingClientRect();
        const margin = 8;
        panel.style.left = Math.max(
          margin,
          Math.min(buttonBounds.left, window.innerWidth - panelBounds.width - margin)
        ) + 'px';
        panel.style.top = Math.max(
          margin,
          Math.min(buttonBounds.bottom + 6, window.innerHeight - panelBounds.height - margin)
        ) + 'px';
      }
    }
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
let speciesListBoroughKey = '';
function refreshSpeciesListForBoroughs() {
  const key = Array.from(filterState.boroughs).sort().join('||') + '#' + (boroughData ? 1 : 0);
  if (key === speciesListBoroughKey) return;
  speciesListBoroughKey = key;
  if (observationDataLoaded) {
    renderSpeciesList('');
    syncSpeciesAllCheckbox();
  }
}

function updateSummaries() {
  refreshSpeciesListForBoroughs();
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

  const observationOptions = [
    filterState.approximateLocation,
    filterState.preciseLocation,
    filterState.photo,
    filterState.presence.size > 0,
    filterState.priorityOnly
  ].filter(Boolean).length;
  const observationOptionsSummary = document.getElementById('fp-observation-options-summary');
  if (observationOptionsSummary) {
    observationOptionsSummary.textContent = observationOptions === 0 ? 'All' : observationOptions + ' on';
    observationOptionsSummary.classList.toggle('is-set', observationOptions > 0);
  }

  const mapLayers = [
    inatVisible,
    sentinelVisible,
    projectsVisible
  ].filter(Boolean).length;
  const mapLayersSummary = document.getElementById('fp-map-layers-summary');
  if (mapLayersSummary) {
    mapLayersSummary.textContent = mapLayers + ' on';
    mapLayersSummary.classList.toggle('is-set', mapLayers !== 2);
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

  const counts = speciesCountsInSelectedBoroughs();
  const matches = availableSpecies().filter(function (s) {
    if (!q) return true;
    return (s.common + ' ' + s.sci).toLowerCase().indexOf(q) !== -1;
  });

  if (!matches.length) {
    listEl.innerHTML = '<div class="fp-empty">' +
      (counts ? 'No species observed in the selected area' : 'No matches') + '</div>';
    return;
  }

  listEl.innerHTML = matches.map(function (s) {
    const checked = filterState.species.has(s.key) ? ' checked' : '';
    return '<label class="fp-check">' +
             '<input type="checkbox" data-sp-key="' + escapeAttr(s.key) + '"' + checked + '>' +
             '<span>' + escapeHtml(s.common) +
               (s.sci ? ' <em style="color:#888">(' + escapeHtml(s.sci) + ')</em>' : '') +
               (counts ? ' <span class="fp-count">' + (counts.get(s.key) || 0) + '</span>' : '') +
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

  const matches = availableSpecies().filter(function (s) {
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
// 13. SIMPLE TOGGLES — location precision / photo / iNat / Sentinelle
// ============================================================
document.getElementById('f-approximate-location').addEventListener('change', function (e) {
  filterState.approximateLocation = e.target.checked;
  if (filterState.approximateLocation) {
    filterState.preciseLocation = false;
    document.getElementById('f-exact-location').checked = false;
  }
  updateSummaries();
  buildObsLayer();
});
document.getElementById('f-exact-location').addEventListener('change', function (e) {
  filterState.preciseLocation = e.target.checked;
  if (filterState.preciseLocation) {
    filterState.approximateLocation = false;
    document.getElementById('f-approximate-location').checked = false;
  }
  updateSummaries();
  buildObsLayer();
});
document.getElementById('f-photo').addEventListener('change', function (e) {
  filterState.photo = e.target.checked;
  updateSummaries();
  buildObsLayer();
  buildSentinelLayer();
});
document.querySelectorAll('#f-presence-list input[data-presence]').forEach(function (checkbox) {
  checkbox.addEventListener('change', function () {
    filterState.presence = new Set(
      Array.from(document.querySelectorAll('#f-presence-list input[data-presence]:checked'))
        .map(function (checked) { return checked.dataset.presence; })
    );
    updateSummaries();
    buildObsLayer();
    buildSentinelLayer();
  });
});
document.getElementById('f-priority').addEventListener('change', function (e) {
  filterState.priorityOnly = e.target.checked;
  updateSummaries();
  buildObsLayer();
  buildSentinelLayer();
});

// Sentinelle toggle
document.getElementById('f-sentinel').addEventListener('change', function (e) {
  sentinelVisible = e.target.checked;
  updateSummaries();
  buildSentinelLayer();
});

document.getElementById('f-clusters').addEventListener('change', function (e) {
  clustersEnabled = e.target.checked;
  buildObsLayer();
  buildSentinelLayer();
});

document.getElementById('f-projects').addEventListener('change', function (e) {
  projectsVisible = e.target.checked;
  updateSummaries();
  buildProjectLayer();
});

document.getElementById('f-map-mode').addEventListener('change', function (e) {
  mapMode = e.target.value;
  updateMapLegend();
  buildObsLayer();
  buildSentinelLayer();
});

// iNat toggle (same idea as Sentinelle toggle)
const inatToggleEl = document.getElementById('f-inat');
if (inatToggleEl) {
  inatToggleEl.addEventListener('change', function (e) {
    inatVisible = e.target.checked;
  updateSummaries();
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
  filterState.approximateLocation = false;
  filterState.preciseLocation = false;
  filterState.photo = false;
  filterState.presence.clear();
  filterState.priorityOnly = false;

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

  document.getElementById('f-approximate-location').checked = false;
  document.getElementById('f-exact-location').checked = false;
  document.getElementById('f-photo').checked = false;
  document.querySelectorAll('#f-presence-list input[data-presence]').forEach(function (cb) { cb.checked = false; });
  document.getElementById('f-priority').checked = false;
  clustersEnabled = false;
  document.getElementById('f-clusters').checked = false;
  mapMode = 'risk';
  document.getElementById('f-map-mode').value = mapMode;
  updateMapLegend();

  sentinelVisible = false;
  const sentinelCb = document.getElementById('f-sentinel');
  if (sentinelCb) sentinelCb.checked = false;
  buildSentinelLayer();

  projectsVisible = true;
  document.getElementById('f-projects').checked = true;
  buildProjectLayer();

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
let legendElement = null;
function updateMapLegend() {
  if (!legendElement) return;
  let html = '';
  if (mapMode === 'density') {
    html = '<div class="legend-title">Reported observation density</div>' +
      '<div class="legend-gradient density-gradient"></div>' +
      '<div class="legend-gradient-labels"><span>Fewer records</span><span>More records</span></div>' +
      '<div class="legend-mode-note">Uses the enabled iNaturalist and Sentinelle sources. This represents reporting patterns, not plant abundance.</div>';
  } else {
    html = '<div class="legend-title">Risk ' +
        '<button type="button" class="legend-help" data-info="risk" aria-label="What do the risk levels mean?" title="What do the risk levels mean?">?</button>' +
      '</div>' +
      '<div class="legend-risk-strip">' +
        '<span class="legend-risk-item"><span class="swatch" style="background:#e63946;border-color:#8b0000"></span>High</span>' +
        '<span class="legend-risk-item"><span class="swatch" style="background:#f4a261;border-color:#a15c00"></span>Mod.</span>' +
        '<span class="legend-risk-item"><span class="swatch" style="background:#ffd166;border-color:#7a6000"></span>Low</span>' +
      '</div>' +
      '<div class="legend-divider"></div>' +
      '<div class="legend-row"><span class="swatch swatch-solid"></span>Precise <small>(≤10 m)</small></div>' +
      '<div class="legend-row"><span class="swatch swatch-dashed"></span>Approx. <small>(10–100 m)</small></div>' +
      '<div class="legend-divider"></div>' +
      '<div class="legend-row"><span class="swatch swatch-inat"></span>iNaturalist <small>(circle)</small></div>' +
      '<div class="legend-row"><span class="swatch swatch-sentinel"></span>Sentinelle <small>(square)</small></div>';
  }
  html += '<div class="legend-divider"></div>' +
    '<div class="legend-row"><span class="swatch swatch-project"></span>Projects &amp; initiatives' +
      '<button type="button" class="legend-help" data-info="projects" aria-label="What are projects and initiatives?" title="What are projects and initiatives?">?</button>' +
    '</div>';
  legendElement.innerHTML = html;
  positionTrendButton();
}

legend.onAdd = function () {
  legendElement = L.DomUtil.create('div', 'legend');
  // Let touch/wheel scrolling inside the legend scroll it instead of panning the map
  L.DomEvent.disableScrollPropagation(legendElement);
  L.DomEvent.disableClickPropagation(legendElement);
  updateMapLegend();
  return legendElement;
};
legend.addTo(map);

// Keep the "Observation trends" button just above the legend (desktop layout;
// the phone layout in style.css places it in the bottom corner instead).
function positionTrendButton() {
  if (!legendElement) return;
  const rect = legendElement.getBoundingClientRect();
  if (!rect.height) return;   // not in the DOM yet
  const gap = 10;
  const bottom = Math.round(window.innerHeight - rect.top + gap);
  document.documentElement.style.setProperty('--trend-bottom', bottom + 'px');
}
positionTrendButton();
window.addEventListener('resize', positionTrendButton);

// Info dialogs (risk levels, projects) live in site/info-dialogs.js and open
// from any element with data-info="risk" / data-info="projects".


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
let projectOrganizationsOpen = false;

const BP_TOGGLE     = document.getElementById('bp-toggle');
const BP_HEAD       = BOROUGH_PANEL ? BOROUGH_PANEL.querySelector('.bp-head') : null;
const PHONE_QUERY   = window.matchMedia('(max-width: 700px)');

// On phones the panel starts minimized (header bar only) so it doesn't cover the map.
function setBoroughPanelCollapsed(collapsed) {
  if (!BOROUGH_PANEL) return;
  BOROUGH_PANEL.classList.toggle('is-collapsed', collapsed);
  if (BP_TOGGLE) {
    BP_TOGGLE.textContent = collapsed ? '▴' : '▾';
    BP_TOGGLE.setAttribute('aria-expanded', String(!collapsed));
    BP_TOGGLE.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Minimize panel');
  }
}
setBoroughPanelCollapsed(PHONE_QUERY.matches);
PHONE_QUERY.addEventListener('change', function (e) { setBoroughPanelCollapsed(e.matches); });

if (BP_HEAD) BP_HEAD.addEventListener('click', function (e) {
  if (BP_CLOSE && BP_CLOSE.contains(e.target)) return;
  setBoroughPanelCollapsed(!BOROUGH_PANEL.classList.contains('is-collapsed'));
});
if (BP_CLOSE) BP_CLOSE.addEventListener('click', closeBoroughPanel);
function closeBoroughPanel() {
  if (BOROUGH_PANEL) BOROUGH_PANEL.hidden = true;
  openTiers.clear();
  projectOrganizationsOpen = false;
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

function projectsInSelection() {
  if (!projectsLoaded) return null;

  const polygons = [];
  if (selectedBorough) {
    polygons.push(selectedBorough);
  } else {
    if (filterState.boroughs.has('__boroughs__') && boroughsUnion) {
      polygons.push(boroughsUnion);
    }
    if (boroughData) {
      boroughData.features.forEach(function (feature) {
        if (filterState.boroughs.has(nameEn(feature))) polygons.push(feature);
      });
    }
  }

  if (!polygons.length) return projectFeatures;
  if (!window.turf) return [];

  return projectFeatures.filter(function (feature) {
    const geometry = feature.geometry;
    if (!geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) return false;
    const point = turf.point(geometry.coordinates);
    return polygons.some(function (polygon) {
      return turf.booleanPointInPolygon(point, polygon);
    });
  });
}

function renderProjectOrganizationRows(projects) {
  const counts = new Map();
  projects.forEach(function (feature) {
    const organization = feature.properties && feature.properties.organization
      ? feature.properties.organization
      : 'Unspecified organization';
    counts.set(organization, (counts.get(organization) || 0) + 1);
  });

  const rows = Array.from(counts.entries()).sort(function (a, b) {
    return b[1] - a[1] || a[0].localeCompare(b[0]);
  });
  let html = '<div class="bp-project-organizations">' +
    '<div class="bp-project-organizations-note">Grouped by credited organization(s).</div>';
  rows.forEach(function (row) {
    html += '<div class="bp-project-organization-row">' +
      '<span>' + escapeHtml(row[0]) + '</span>' +
      '<strong>' + row[1] + '</strong>' +
      '</div>';
  });
  return html + '</div>';
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
  if (!BOROUGH_PANEL || !observationDataLoaded) return;

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

  const selectedProjects = projectsInSelection();
  const projectCount = selectedProjects === null ? null : selectedProjects.length;
  const projectCountText = projectCount === null
    ? (projectsLoadFailed ? 'Unavailable' : 'Loading…')
    : projectCount;
  const projectToggleDisabled = projectCount === null ? ' disabled' : '';
  const projectToggleOpen = projectOrganizationsOpen && projectCount !== null;
  html += '<button class="bp-tier bp-project-toggle' + (projectToggleOpen ? ' open' : '') +
    '" type="button" aria-expanded="' + projectToggleOpen + '"' + projectToggleDisabled + '>' +
    '<span>Projects &amp; initiatives</span>' +
    '<span class="bp-count bp-project-count-value">' + projectCountText + '</span>' +
    '<span class="bp-caret">' + (projectToggleOpen ? '▾' : '▸') + '</span>' +
    '</button>';
  if (projectToggleOpen) html += renderProjectOrganizationRows(selectedProjects);

  BP_BODY.innerHTML = html;
  BOROUGH_PANEL.hidden = false;

  BP_BODY.querySelectorAll('.bp-tier').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.classList.contains('bp-project-toggle')) {
        projectOrganizationsOpen = !projectOrganizationsOpen;
        renderSelectionPanel();
        return;
      }
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
fetch('data/limites-administratives-agglomeration.GEOjson')
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
          projectOrganizationsOpen = false;
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
  .catch(function (err) {
    showDataLoadError('Could not load the borough/city boundaries. The map still loads, but area filters and counts will be unavailable.', err);
  });


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
  renderObservationTrendChart();
  if (mapMode !== 'risk' || !sentinelVisible || sentinelFeatures.length === 0) {
    scheduleThematicMapLayerUpdate();
    return;
  }

  const filtered = sentinelFeatures.filter(function (f) { return passesSentinelFilters(f); });

  const sentinelMarkers = L.geoJSON(
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
        html += '<button type="button" class="popup-badge popup-badge-info" data-info="risk" title="What does this risk level mean?" style="background:' + b.bg + ';color:' + b.fg + ';border:1px solid ' + b.border + ';">' + (RISK_LABEL[p.risk] || 'Unclassified') + '</button>';
        html += '</div></div>';

        html += '<div class="popup-grid">';
        if (date)     html += '<div><span class="lbl">Observed</span>' + date + '</div>';
        if (region)   html += '<div><span class="lbl">Region</span>' + region + '</div>';
        if (presence) html += '<div><span class="lbl">Presence</span>' + presence + '</div>';
        if (category) html += '<div class="popup-grid-wide"><span class="lbl">Category</span>' + category + '</div>';
        html += '</div>';

        layer.bindPopup(html, popupOptions({ maxWidth: 300, minWidth: 260 }));
      }
    }
  );

  if (!clustersEnabled) {
    sentinelLayer = sentinelMarkers.addTo(map);
    scheduleThematicMapLayerUpdate();
    return;
  }

  sentinelLayer = L.markerClusterGroup({
    clusterPane: 'sentinelPane',
    maxClusterRadius: 50,
    disableClusteringAtZoom: 16,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      const sizeClass = count < 100 ? 'small' : (count < 1000 ? 'medium' : 'large');
      const size = count < 100 ? 36 : (count < 1000 ? 44 : 52);
      return L.divIcon({
        html: '<div class="observation-cluster sentinel-observation-cluster observation-cluster-' +
          sizeClass + '" title="Click to zoom in and explore Sentinelle observations">' +
          count.toLocaleString() + '</div>',
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    }
  });
  sentinelLayer.addLayer(sentinelMarkers);
  map.addLayer(sentinelLayer);
  scheduleThematicMapLayerUpdate();
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
  .catch(function (err) {
    showDataLoadError('Could not load the Sentinelle data layer. The map stays available, but that layer is disabled.', err);
  });


// ============================================================
// 22. COMMUNITY PROJECTS — maintained in data/projects.geojson
// ============================================================
map.createPane('projectPane');
map.getPane('projectPane').style.zIndex = 660;

function buildProjectLayer() {
  if (projectLayer) {
    map.removeLayer(projectLayer);
    projectLayer = null;
  }
  if (!projectsVisible || projectFeatures.length === 0) return;

  const projectLayerOptions = {
    pointToLayer: function (feature, latlng) {
      return L.marker(latlng, {
        pane: 'projectPane',
        icon: L.divIcon({
          className: 'project-marker-icon',
          html: '<span></span>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      });
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties || {};
      let html = '<div class="project-popup">';
      html += '<div class="popup-title">' + escapeHtml(p.name || 'Untitled project') + '</div>';
      html += '<div class="project-meta">' +
        (p.organization ? escapeHtml(p.organization) : 'Community project') +
        (p.year ? ' · ' + escapeHtml(p.year) : '') +
        '</div>';
      if (p.description) {
        html += '<p class="project-description">' + escapeHtml(p.description) + '</p>';
      }
      const hasSpecies = Array.isArray(p.species) && p.species.length;
      if (hasSpecies) {
        html += '<div class="project-species"><strong>Associated species</strong><ul>';
        p.species.forEach(function (species) {
          if (!species || !species.common) return;
          if (species.scientific) {
            const catalogUrl = 'site/species.html?species=' + encodeURIComponent(species.scientific);
            html += '<li><a class="project-species-link" href="' + escapeAttr(catalogUrl) + '" title="Open species catalog entry">';
          } else {
            html += '<li>';
          }
          html += escapeHtml(species.common);
          if (species.scientific) {
            html += ' <em>(' + escapeHtml(species.scientific) + ')</em>';
            html += '</a>';
          }
          html += '</li>';
        });
        html += '</ul></div>';
      }
      if (p.species_note && !hasSpecies) {
        html += '<div class="project-species"><strong>Associated species</strong><div>' +
          escapeHtml(p.species_note) + '</div></div>';
      } else if (p.species_note) {
        html += '<div class="project-species-note">' + escapeHtml(p.species_note) + '</div>';
      }
      const hasDetails = p.project_area || (Array.isArray(p.actions) && p.actions.length);
      if (hasDetails) {
        html += '<details class="project-more"><summary>Project sites and restoration work</summary>';
      }
      if (p.project_area) {
        html += '<div class="project-detail"><strong>Sites:</strong> ' + escapeHtml(p.project_area) + '</div>';
      }
      if (Array.isArray(p.actions) && p.actions.length) {
        html += '<div class="project-detail"><strong>Work:</strong><ul>';
        p.actions.forEach(function (action) {
          html += '<li>' + escapeHtml(action) + '</li>';
        });
        html += '</ul></div>';
      }
      if (hasDetails) html += '</details>';
      if (p.marker_location) {
        html += '<div class="project-location-note">' + escapeHtml(p.marker_location) + '</div>';
      }
      if (projectsSourcesLastChecked) {
        html += '<div class="project-source-checked">Project sources last checked: ' +
          escapeHtml(projectsSourcesLastChecked) + '</div>';
      }
      let hasSourceLink = false;
      if (p.project_url && /^https?:\/\//i.test(p.project_url)) {
        html += '<a class="popup-btn" href="' + escapeAttr(p.project_url) + '" target="_blank" rel="noopener noreferrer">Original project details →</a>';
        hasSourceLink = true;
      }
      if (p.source_url && /^https?:\/\//i.test(p.source_url)) {
        html += '<a class="popup-btn" href="' + escapeAttr(p.source_url) + '" target="_blank" rel="noopener noreferrer">Project update →</a>';
        hasSourceLink = true;
      }
      if (!hasSourceLink) {
        html += '<div class="project-source-missing">Source link not added yet.</div>';
      }
      html += '<button type="button" class="popup-info-link" data-info="projects">Learn more about projects</button>';
      html += '</div>';
      layer.bindPopup(html, popupOptions({ maxWidth: 360, minWidth: 240 }));
    }
  };

  const projectSiteGroups = new Map();
  projectFeatures.forEach(function (feature, index) {
    const properties = feature.properties || {};
    const siteGroup = typeof properties.cluster_group === 'string'
      ? properties.cluster_group.trim()
      : '';
    const area = properties.project_area;
    const siteKey = (siteGroup || (typeof area === 'string' ? area.trim() : ''))
      .toLocaleLowerCase() || 'project-' + index;
    if (!projectSiteGroups.has(siteKey)) projectSiteGroups.set(siteKey, []);
    projectSiteGroups.get(siteKey).push(feature);
  });

  projectLayer = L.featureGroup();
  projectSiteGroups.forEach(function (features) {
    const siteLayer = L.geoJSON(
      { type: 'FeatureCollection', features: features },
      projectLayerOptions
    );
    if (features.length === 1) {
      projectLayer.addLayer(siteLayer);
      return;
    }

    const siteCluster = L.markerClusterGroup({
      clusterPane: 'projectPane',
      maxClusterRadius: 50,
      maxClusterZoom: 20,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount();
        const sizeClass = count < 10 ? 'small' : 'large';
        const size = count < 10 ? 32 : 40;
        return L.divIcon({
          html: '<div class="project-cluster project-cluster-' + sizeClass +
            '" title="Click to zoom in or separate projects at this site">' +
            count.toLocaleString() + '</div>',
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        });
      }
    });
    siteCluster.addLayer(siteLayer);
    projectLayer.addLayer(siteCluster);
  });
  projectLayer.addTo(map);
}

fetch('data/projects.geojson')
  .then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' loading projects.geojson');
    return response.json();
  })
  .then(function (data) {
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('projects.geojson must be a GeoJSON FeatureCollection');
    }
    projectFeatures = data.features;
    projectsSourcesLastChecked = data.metadata && data.metadata.sources_last_checked
      ? data.metadata.sources_last_checked
      : null;
    projectsLoaded = true;
    buildProjectLayer();
    if (BOROUGH_PANEL && !BOROUGH_PANEL.hidden) renderSelectionPanel();
  })
  .catch(function (err) {
    projectsLoadFailed = true;
    showDataLoadError('Could not load the project data. Project points and initiative details are unavailable.', err);
    if (BOROUGH_PANEL && !BOROUGH_PANEL.hidden) renderSelectionPanel();
  });