// ============================================================
// INFO DIALOGS — shared by the map and the species catalog
// ------------------------------------------------------------
// Any element with data-info="risk" or data-info="projects" opens the
// matching explainer. The text lives only here, so every entry point
// (legend "?", popup badges, filter menus, catalog headings) stays in sync.
// ============================================================
(function () {
  const RISK_GUIDANCE_URL = 'https://bibliotheque.cecile-rouleau.gouv.qc.ca/documents/archives/pgq/E5E862_E86_2026.pdf';

  const QC_LIST_URL = 'https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/gestion-faune-habitats-fauniques/gestion-especes-exotiques-envahissantes-animales/liste-especes';

  const DIALOGS = {
    presence: {
      title: 'What does the Québec status mean?',
      body:
        '<p>The status comes from the Québec government\'s list of main invasive species ' +
          '(Ministère de l\'Environnement). It describes the species across <strong>all of Québec</strong>, ' +
          'not just Montréal or this map:</p>' +
        '<ul class="info-list">' +
          '<li><strong>Established</strong> (<em>Établie</em>): the species is observed in Québec and there is evidence, ' +
            'or good reason to believe, that it survives there.</li>' +
          '<li><strong>Occasional observation</strong> (<em>Observation ponctuelle</em>): the species has been observed in Québec ' +
            'on some occasions, but there is no evidence that it survives.</li>' +
          '<li><strong>Absent</strong> (<em>Absente</em>): the species has never been observed in Québec.</li>' +
        '</ul>' +
        '<p class="risk-info-note">The official list can lag behind recent sightings, so a species listed as Absent or Occasional ' +
          'may still have points on this map, for example a garden planting or a new arrival.</p>' +
        '<p class="risk-info-note">Source: <a href="' + QC_LIST_URL + '" target="_blank" rel="noopener noreferrer">' +
          'Liste des principales espèces exotiques envahissantes</a>, Gouvernement du Québec (list updated September 29, 2026).</p>'
    },
    risk: {
      title: 'What do the risk levels mean?',
      body:
        '<p>Québec classifies harmful invasive plant species by their known risk to biodiversity and the environment:</p>' +
        '<ul class="risk-info-list">' +
          '<li><span class="swatch" style="background:#e63946;border-color:#8b0000"></span><div><strong>High risk:</strong> a major threat to biodiversity and the proper functioning of ecosystems.</div></li>' +
          '<li><span class="swatch" style="background:#f4a261;border-color:#a15c00"></span><div><strong>Moderate risk:</strong> may harm some native species or disrupt some ecosystems, but without causing severe impacts.</div></li>' +
          '<li><span class="swatch" style="background:#ffd166;border-color:#7a6000"></span><div><strong>Low risk:</strong> impacts on biodiversity and ecosystems are limited.</div></li>' +
          '<li><span class="swatch" style="background:#adb5bd;border-color:#444"></span><div><strong>Undetermined — watch</strong> (“Unclassified” on the map): impacts and risk in Québec are not yet sufficiently understood.</div></li>' +
        '</ul>' +
        '<p class="risk-info-note">Priority for control is a separate classification: a species can be a priority even if its risk level is moderate or low.</p>' +
        '<p class="risk-info-note">Source: Québec\'s <a href="' + RISK_GUIDANCE_URL + '" target="_blank" rel="noopener noreferrer">risk criteria and control guidance</a>.</p>'
    },
    projects: {
      title: 'What are projects & initiatives?',
      body:
        '<p>The blue markers show local efforts to control invasive plants in the Montréal area, ' +
          'led by the Ville de Montréal, individual boroughs and cities, and community and environmental organizations.</p>' +
        '<ul class="info-list">' +
          '<li><strong>What they include:</strong> control work such as cutting invasive plants or covering them with tarps to smother them, ' +
            'often followed by planting native species, as well as pilot projects, monitoring, and volunteer activities.</li>' +
          '<li><strong>Click a marker</strong> to see who runs the project, when, its target species, the sites and methods involved, and links to the original sources.</li>' +
          '<li><strong>Locations are approximate:</strong> a marker may show the park where work happens or the organization\'s address, ' +
            'not the exact treatment site. Projects in the same park or island are grouped together.</li>' +
          '<li><strong>Not a complete list:</strong> these are selected projects that were checked by hand (last in October 2026). ' +
            'Areas without a marker may still have control work happening.</li>' +
        '</ul>' +
        '<p class="risk-info-note">Turn this layer on or off under <strong>Map layers</strong> on the map. In the species catalog, ' +
          'use “View projects &amp; initiatives” to see projects for a specific species.</p>'
    }
  };

  // ---- Build one overlay that is reused for every dialog ----
  const overlay = document.createElement('div');
  overlay.className = 'risk-info-overlay';
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="risk-info" role="dialog" aria-modal="true" aria-labelledby="info-dialog-title">' +
      '<div class="risk-info-head">' +
        '<h2 id="info-dialog-title"></h2>' +
        '<button class="risk-info-close" type="button" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="info-dialog-body"></div>' +
    '</div>';
  document.body.appendChild(overlay);

  const titleEl = overlay.querySelector('#info-dialog-title');
  const bodyEl  = overlay.querySelector('.info-dialog-body');
  const closeBtn = overlay.querySelector('.risk-info-close');
  const panel = overlay.querySelector('.risk-info');
  let returnFocus = null;

  function openInfo(name) {
    const d = DIALOGS[name];
    if (!d) return;
    returnFocus = document.activeElement;
    titleEl.textContent = d.title;
    bodyEl.innerHTML = d.body;
    panel.scrollTop = 0;
    overlay.hidden = false;
    closeBtn.focus();
  }

  function closeInfo() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    if (returnFocus && returnFocus.focus && document.contains(returnFocus)) returnFocus.focus();
  }

  closeBtn.addEventListener('click', closeInfo);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeInfo();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeInfo();
  });

  // Capture phase so it still fires inside Leaflet popups/controls,
  // which stop click propagation.
  document.addEventListener('click', function (e) {
    const trigger = e.target.closest && e.target.closest('[data-info]');
    if (!trigger) return;
    e.preventDefault();
    e.stopPropagation();
    openInfo(trigger.getAttribute('data-info'));
  }, true);

  window.openInfoDialog = openInfo;
})();
