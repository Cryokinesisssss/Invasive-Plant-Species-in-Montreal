// ============================================================
// city-guidance.js — each municipality's own page about invasive plants
// Used by the home page ("What you can do") and the map's borough / city
// panel. Only pages that are actually about invasive plants are listed;
// every link was opened and checked in November 2026.
//
// Keys are the municipality names exactly as in the boundary data
// (limites-administratives-agglomeration NOM). The 19 boroughs are all
// City of Montréal, so they share MONTREAL_GUIDANCE.
// ============================================================

const GUIDANCE_CHECKED = 'November 2026';

const MONTREAL_GUIDANCE = {
  name: 'Montréal (all 19 boroughs)',
  url: 'https://montreal.ca/en/articles/controlling-invasive-alien-plant-species-to-protect-native-plants-94413',
  offers: 'Main species, how the city controls them, current park projects, volunteering'
};

const CITY_GUIDANCE = {
  'Côte-Saint-Luc': {
    url: 'https://cotesaintluc.org/en/urban-greening/removing-invasive-species',
    offers: 'Identifying, removing and disposing of invasive plants; reporting them on public land'
  },
  'Dorval': {
    url: 'https://www.ville.dorval.qc.ca/en/environment-and-road-maintenance/environment/invasive-exotic-plants-iep',
    offers: 'Identifying garden invasives, removal methods and disposal'
  },
  'Pointe-Claire': {
    url: 'https://www.pointe-claire.ca/en/wildlife-flora-and-species/urban-flora/invasive-harmful-species',
    offers: 'Pages on buckthorn, wild parsnip, ragweed and poison ivy'
  },
  "Baie-D'Urfé": {
    url: 'https://www.baie-durfe.qc.ca/en/our-departments/page/invasive-species',
    offers: 'Identifying buckthorn, common reed and giant hogweed'
  }
};

// Linked cities with no dedicated page (checked November 2026)
const CITIES_WITHOUT_GUIDANCE = [
  'Beaconsfield', 'Dollard-des-Ormeaux', 'Hampstead', 'Kirkland', "L'Île-Dorval",
  'Mont-Royal', 'Montréal-Est', 'Montréal-Ouest', 'Sainte-Anne-de-Bellevue',
  'Senneville', 'Westmount'
];

const QUEBEC_GUIDANCE = {
  name: 'Gouvernement du Québec',
  url: 'https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/gestion-faune-habitats-fauniques/gestion-especes-exotiques-envahissantes/propos-especes',
  offers: 'About invasive species, the provincial list and rules (in French)'
};

// Guidance for one boundary feature's municipality, or null if it has none
function guidanceForPlace(nom, type) {
  if ((type || '').trim() === 'Arrondissement') return MONTREAL_GUIDANCE;
  const g = CITY_GUIDANCE[(nom || '').trim()];
  return g ? Object.assign({ name: (nom || '').trim() }, g) : null;
}

// ---- Home page: fill the "Your city's guidance" list ----
(function renderHomeGuidance() {
  const list = document.getElementById('city-guidance-list');
  if (!list) return;
  const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const rows = [MONTREAL_GUIDANCE].concat(Object.keys(CITY_GUIDANCE).sort(function (a, b) { return a.localeCompare(b, 'fr'); })
    .map(function (k) { return Object.assign({ name: k }, CITY_GUIDANCE[k]); }), [QUEBEC_GUIDANCE]);
  list.innerHTML = rows.map(function (g) {
    return '<li><a href="' + esc(g.url) + '" target="_blank" rel="noopener">' + esc(g.name) + '</a>' +
      '<span>' + esc(g.offers) + '</span></li>';
  }).join('');
  const none = document.getElementById('city-guidance-none');
  if (none) {
    none.textContent = CITIES_WITHOUT_GUIDANCE.join(', ') + ' don’t have a page on invasive plants yet; ' +
      'their environment or public works department can help. Links checked ' + GUIDANCE_CHECKED + '.';
  }
})();
