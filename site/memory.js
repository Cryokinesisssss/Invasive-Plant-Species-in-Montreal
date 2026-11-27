// ============================================================
// READER-SUGGESTED PROJECTS (Firebase)
// ------------------------------------------------------------
// Adapted from the GEOG 464 memory.js kit (shared route):
// same pinned Firebase SDK, anonymous sign-in, "press the button,
// then click the map" capture, rules-checked writes, and reader text
// shown as plain text only.
//
// What is different from the kit:
//  - A submission is saved as status "pending" and nobody can see it.
//    The owner approves it in the Firebase console (Firestore > Data)
//    by changing status to "approved". Only approved ones are loaded.
//  - The form asks for project details, not a category + short note.
//  - Approved projects join the map's Projects layer (site/app.js).
//
// Needs site/remember.js (Firebase connection) and site/app.js
// (map, speciesCatalog, projectFeatures, setReaderProjects) loaded first.
// ============================================================

// ===== SETTINGS =====
const SUBMIT = {
  // Montréal agglomeration; the Firestore rules check the same box
  bounds: { south: 45.40, north: 45.71, west: -73.98, east: -73.47 },
  max: { name: 100, organization: 100, description: 400, speciesOther: 60, url: 300, species: 10 }
};

(function () {
  if (typeof map === 'undefined' || !window.ReaderProjects) return;
  const connect = window.ReaderProjects.connect;

  let fb = null;          // { fs, db, uid } once connected
  let adding = false;     // next map click picks the project location

  // ---------- small panel on the map ----------
  const Panel = L.Control.extend({
    onAdd: function () {
      const box = L.DomUtil.create('div', 'suggest-panel');
      box.innerHTML =
        '<button type="button" class="suggest-btn" data-s="add">Suggest a project</button>' +
        '<div class="suggest-status" data-s="status" role="status"></div>';
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.disableScrollPropagation(box);
      return box;
    }
  });
  const panel = new Panel({ position: 'topright' }).addTo(map).getContainer();
  const addBtn = panel.querySelector('[data-s="add"]');
  const statusEl = panel.querySelector('[data-s="status"]');
  function status(text) { statusEl.textContent = text || ''; statusEl.hidden = !text; }
  status('');

  // ---------- "Suggest a project": the next click on the map picks the spot ----------
  function setAdding(on) {
    adding = on;
    addBtn.textContent = on ? 'Click the map (or press to cancel)' : 'Suggest a project';
    addBtn.classList.toggle('is-active', on);
    map.getContainer().style.cursor = on ? 'crosshair' : '';
    // Fade the observations so streets and parks show; project pins stay
    map.getContainer().classList.toggle('is-choosing-spot', on);
    if (on) status('');
  }
  addBtn.addEventListener('click', function () { setAdding(!adding); });

  // Caught on the way in, before Leaflet, so the map's own click actions
  // (borough selection, popups) don't also run for this click.
  map.getContainer().addEventListener('click', function (ev) {
    if (!adding) return;
    if (ev.target.closest('.leaflet-control, .leaflet-popup')) return;
    ev.stopPropagation();
    setAdding(false);
    const ll = map.mouseEventToLatLng(ev);
    const b = SUBMIT.bounds;
    if (ll.lat < b.south || ll.lat > b.north || ll.lng < b.west || ll.lng > b.east) {
      status('That spot is outside the Montréal area.');
      return;
    }
    openForm(ll);
  }, true);

  // ---------- the form (a dialog, like the map's explainers) ----------
  const overlay = document.createElement('div');
  overlay.className = 'risk-info-overlay suggest-overlay';
  overlay.hidden = true;
  const REQ = '<span class="suggest-req" aria-hidden="true"> *</span>';
  overlay.innerHTML =
    '<form class="risk-info suggest-form" role="dialog" aria-modal="true" aria-labelledby="suggest-title" novalidate>' +
      '<div class="risk-info-head">' +
        '<h2 id="suggest-title">Suggest a project</h2>' +
        '<button class="risk-info-close" type="button" data-s="close" aria-label="Close">×</button>' +
      '</div>' +
      '<p class="suggest-intro">Know of work to control invasive plants in Montréal? Tell us about it. ' +
        'Suggestions are reviewed before they appear on the map. ' +
        '<span class="suggest-req-key"><span class="suggest-req">*</span> Required</span></p>' +
      '<label class="suggest-field">Project name' + REQ +
        '<input name="name" required maxlength="' + SUBMIT.max.name + '"></label>' +
      '<label class="suggest-field">Organization' + REQ +
        '<input name="organization" required maxlength="' + SUBMIT.max.organization + '" list="suggest-orgs">' +
        '<datalist id="suggest-orgs"></datalist></label>' +
      '<div class="suggest-row">' +
        '<label class="suggest-field">Start year' + REQ + '<input name="year_start" type="number" required min="1990" max="2100" inputmode="numeric"></label>' +
        '<label class="suggest-field">End year<input name="year_end" type="number" min="1990" max="2100" inputmode="numeric" placeholder="Ongoing"></label>' +
      '</div>' +
      '<label class="suggest-field">What was done' + REQ +
        '<textarea name="description" required rows="3" maxlength="' + SUBMIT.max.description + '"></textarea></label>' +
      '<fieldset class="suggest-field suggest-species"><legend>Species targeted' + REQ + '</legend>' +
        '<label class="suggest-check suggest-species-none"><input type="checkbox" name="species_none"> ' +
          'No specific species named <span class="suggest-hint">(the source talks about invasive plants in general)</span></label>' +
        '<div class="suggest-species-list" data-s="species"></div>' +
        '<label class="suggest-other-label" for="suggest-other">Other plant, if not listed: write its Latin name ' +
          '<span class="suggest-hint">(a species, subspecies, hybrid, genus, family…, e.g. Rhamnus cathartica)</span></label>' +
        '<div class="taxon-combo">' +
          '<input id="suggest-other" name="species_other" maxlength="' + SUBMIT.max.speciesOther + '" placeholder="Start typing a Latin name…" ' +
            'autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="taxon-options">' +
          '<ul class="taxon-options" id="taxon-options" role="listbox" hidden></ul>' +
        '</div>' +
      '</fieldset>' +
      '<fieldset class="suggest-field"><legend>The location you clicked is' + REQ + '</legend>' +
        '<label class="suggest-radio"><input type="radio" name="marker_type" value="site" required> Where the work happens</label>' +
        '<label class="suggest-radio"><input type="radio" name="marker_type" value="area"> Somewhere in the project area</label>' +
        '<label class="suggest-radio"><input type="radio" name="marker_type" value="organization"> The organization’s office or meeting point</label>' +
      '</fieldset>' +
      '<label class="suggest-field">Source link' + REQ +
        '<input name="source_url" type="url" required maxlength="' + SUBMIT.max.url + '" placeholder="https://"></label>' +
      '<p class="suggest-note">Please don’t include people’s names or home addresses.</p>' +
      '<p class="suggest-error" data-s="error" role="alert" hidden></p>' +
      '<div class="suggest-actions">' +
        '<button type="button" class="suggest-cancel" data-s="cancel">Cancel</button>' +
        '<button type="submit" class="suggest-send" data-s="send">Send for review</button>' +
      '</div>' +
    '</form>';
  document.body.appendChild(overlay);

  const form = overlay.querySelector('form');
  const errorEl = overlay.querySelector('[data-s="error"]');
  const sendBtn = overlay.querySelector('[data-s="send"]');
  let formLatLng = null;
  let returnFocus = null;

  // "No specific species named" and the species choices exclude each other:
  // ticking it clears the list; picking a species (or typing one) unticks it.
  const noneBox = form.elements.species_none;
  const otherInput = form.elements.species_other;
  overlay.querySelector('.suggest-species').addEventListener('input', function (e) {
    if (e.target === noneBox) {
      if (!noneBox.checked) return;
      form.querySelectorAll('input[name="species"]:checked').forEach(function (cb) { cb.checked = false; });
      otherInput.value = '';
    } else if (e.target.name === 'species' ? e.target.checked : e.target === otherInput && otherInput.value.trim()) {
      noneBox.checked = false;
    }
  });

  // ---------- "Other plant": Latin-name suggestions from iNaturalist ----------
  // Plants only (taxon 47126 = Plantae), anything from family down to form:
  // tribes, genera, sections, complexes, species, hybrids, subspecies,
  // varieties... Typing freely still works if nothing matches or iNaturalist
  // can't be reached.
  const TAXON_URL = 'https://api.inaturalist.org/v1/taxa/autocomplete?taxon_id=47126&min_rank=form&max_rank=family&per_page=10&locale=en&q=';
  // How a rank reads in the list, when iNaturalist's own word isn't plain enough
  const RANK_LABEL = { genushybrid: 'genus hybrid', infrahybrid: 'hybrid' };
  // Botanical abbreviations for names below species (iNaturalist leaves them out)
  const INFRA = { subspecies: 'subsp.', variety: 'var.', subvariety: 'subvar.', form: 'f.' };
  function rankLabel(rank) { return RANK_LABEL[rank] || rank; }
  function botanicalName(t) {
    const abbr = INFRA[t.rank];
    const parts = t.name.split(' ');
    return abbr && parts.length > 2 ? parts.slice(0, -1).join(' ') + ' ' + abbr + ' ' + parts[parts.length - 1] : t.name;
  }
  const optionsEl = overlay.querySelector('#taxon-options');
  let taxonTimer = null;
  let taxonAbort = null;
  let taxonResults = [];
  let taxonActive = -1;

  function taxonValue(t) {
    // Species, hybrids and names below species are clear on their own
    // ("Reynoutria × bohemica", "Phragmites australis subsp. australis");
    // anything broader says what it is ("Rhamnus (genus)", "Rubus (complex)").
    if (t.rank_level <= 10) return botanicalName(t);
    return t.name + ' (' + rankLabel(t.rank) + ')';
  }
  function hideTaxa() {
    optionsEl.hidden = true;
    optionsEl.textContent = '';
    otherInput.setAttribute('aria-expanded', 'false');
    otherInput.removeAttribute('aria-activedescendant');
    taxonResults = [];
    taxonActive = -1;
  }
  function highlightTaxon(i) {
    taxonActive = i;
    Array.from(optionsEl.children).forEach(function (li, j) { li.classList.toggle('is-active', j === i); });
    if (i >= 0) otherInput.setAttribute('aria-activedescendant', 'taxon-opt-' + i);
    else otherInput.removeAttribute('aria-activedescendant');
  }
  function showTaxa(results) {
    hideTaxa();
    taxonResults = results;
    if (!results.length) return;
    results.forEach(function (t, i) {
      const li = document.createElement('li');
      li.id = 'taxon-opt-' + i;
      li.setAttribute('role', 'option');
      const em = document.createElement('em');
      em.textContent = botanicalName(t);
      const rank = document.createElement('span');
      rank.className = 'taxon-rank';
      rank.textContent = ' (' + rankLabel(t.rank) + ')';
      li.append(em, rank);
      if (t.preferred_common_name) {
        const common = document.createElement('span');
        common.className = 'taxon-common';
        common.textContent = t.preferred_common_name;
        li.append(common);
      }
      // mousedown, not click, so the input doesn't lose focus and close the list first
      li.addEventListener('mousedown', function (e) { e.preventDefault(); pickTaxon(t); });
      optionsEl.append(li);
    });
    optionsEl.hidden = false;
    otherInput.setAttribute('aria-expanded', 'true');
  }
  function pickTaxon(t) {
    hideTaxa();
    // Already on the checklist? Tick it there instead of writing it out.
    const listed = t.rank === 'species' && Array.from(form.querySelectorAll('input[name="species"]'))
      .find(function (cb) { return cb.value.split('|')[1] === t.name; });
    if (listed) {
      listed.checked = true;
      otherInput.value = '';
    } else {
      otherInput.value = taxonValue(t).slice(0, SUBMIT.max.speciesOther);
    }
    noneBox.checked = false;
  }
  function lookUpTaxa(q) {
    if (taxonAbort) taxonAbort.abort();
    taxonAbort = new AbortController();
    fetch(TAXON_URL + encodeURIComponent(q), { signal: taxonAbort.signal })
      .then(function (r) { return r.ok ? r.json() : { results: [] }; })
      .then(function (data) {
        if (document.activeElement !== otherInput || otherInput.value.trim() !== q) return;
        showTaxa((data.results || []).filter(function (t) { return t.name && t.rank && typeof t.rank_level === 'number'; }));
      })
      .catch(function () { /* offline or aborted: free typing still works */ });
  }

  otherInput.addEventListener('input', function () {
    clearTimeout(taxonTimer);
    const q = otherInput.value.trim();
    if (q.length < 3) { hideTaxa(); return; }
    taxonTimer = setTimeout(function () { lookUpTaxa(q); }, 300);   // wait for a pause in typing
  });
  otherInput.addEventListener('keydown', function (e) {
    if (optionsEl.hidden) return;
    const n = taxonResults.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlightTaxon((taxonActive + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlightTaxon((taxonActive - 1 + n) % n); }
    else if (e.key === 'Enter' && taxonActive >= 0) { e.preventDefault(); pickTaxon(taxonResults[taxonActive]); }
    else if (e.key === 'Escape') { e.stopPropagation(); hideTaxa(); }   // close the list, not the form
  });
  otherInput.addEventListener('blur', function () { clearTimeout(taxonTimer); hideTaxa(); });

  // Hybrids use "×", which most keyboards can't type. A lone x between words
  // ("Reynoutria x bohemica", "x Festulolium") becomes ×; an x inside a word
  // ("Xanthium") is left alone. The search itself already matches either.
  function hybridSign(text) { return text.replace(/(^|\s)[xX](?=\s)/g, '$1×'); }
  otherInput.addEventListener('change', function () { otherInput.value = hybridSign(otherInput.value); });

  function fillChoices() {
    // Species: the map's species list (common name + Latin name)
    const box = overlay.querySelector('[data-s="species"]');
    box.textContent = '';
    (typeof speciesCatalog !== 'undefined' ? speciesCatalog : []).forEach(function (s) {
      if (!s.sci) return;
      const label = document.createElement('label');
      label.className = 'suggest-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.name = 'species'; cb.value = s.common + '|' + s.sci;
      const em = document.createElement('em');
      em.textContent = s.sci;
      label.append(cb, document.createTextNode(' ' + s.common + ' '), em);
      box.append(label);
    });
    // Organizations already on the map, to keep names consistent
    const list = overlay.querySelector('#suggest-orgs');
    list.textContent = '';
    const orgs = new Set();
    (typeof projectFeatures !== 'undefined' ? projectFeatures : []).forEach(function (f) {
      const o = f.properties && f.properties.organization;
      if (o) orgs.add(o);
    });
    Array.from(orgs).sort().forEach(function (o) {
      const opt = document.createElement('option'); opt.value = o; list.append(opt);
    });
  }

  function openForm(latlng) {
    formLatLng = latlng;
    returnFocus = document.activeElement;
    form.reset();
    fillChoices();
    showError('');
    sendBtn.disabled = false;
    overlay.hidden = false;
    form.querySelector('[name="name"]').focus();
    connect();   // sign in while they type, so sending is quick
  }
  function closeForm() {
    overlay.hidden = true;
    if (returnFocus && returnFocus.focus && document.contains(returnFocus)) returnFocus.focus();
  }
  function showError(text) { errorEl.textContent = text; errorEl.hidden = !text; }

  overlay.querySelector('[data-s="close"]').addEventListener('click', closeForm);
  overlay.querySelector('[data-s="cancel"]').addEventListener('click', closeForm);
  // No click-outside-to-close: selecting text and releasing the mouse past the
  // form's edge counts as a click on the backdrop and would lose what was typed.
  // Close only with ×, Cancel or Esc.
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) closeForm(); });

  // ---------- read + check the form (the Firestore rules check the same things) ----------
  function readForm() {
    const v = function (name) { return (form.elements[name].value || '').trim(); };
    const yearStart = parseInt(v('year_start'), 10);
    const yearEndRaw = v('year_end');
    const yearEnd = yearEndRaw ? parseInt(yearEndRaw, 10) : null;
    const species = Array.from(form.querySelectorAll('input[name="species"]:checked')).map(function (cb) { return cb.value; });
    const markerEl = form.querySelector('input[name="marker_type"]:checked');
    const data = {
      name: v('name').slice(0, SUBMIT.max.name),
      organization: v('organization').slice(0, SUBMIT.max.organization),
      year_start: yearStart,
      year_end: yearEnd,
      description: v('description').slice(0, SUBMIT.max.description),
      species: species,
      species_other: hybridSign(v('species_other')).slice(0, SUBMIT.max.speciesOther),
      marker_type: markerEl ? markerEl.value : '',
      source_url: v('source_url').slice(0, SUBMIT.max.url),
      lat: Math.round(formLatLng.lat * 1e5) / 1e5,   // about 1 m
      lng: Math.round(formLatLng.lng * 1e5) / 1e5
    };
    if (!data.name) return 'Add the project name.';
    if (!data.organization) return 'Add the organization.';
    if (!(yearStart >= 1990 && yearStart <= 2100)) return 'Add a start year (1990 or later).';
    if (yearEnd !== null && !(yearEnd >= yearStart && yearEnd <= 2100)) return 'The end year must be the start year or later.';
    if (!data.description) return 'Say briefly what was done.';
    if (!data.species.length && !data.species_other && !form.elements.species_none.checked) {
      return 'Choose the species targeted, add one under “Other plant”, or tick “No specific species named”.';
    }
    if (data.species.length > SUBMIT.max.species) return 'Choose at most ' + SUBMIT.max.species + ' species.';
    if (!data.marker_type) return 'Say what the location you clicked is.';
    if (!/^https:\/\/\S+\.\S+/.test(data.source_url)) return 'Add a source link starting with https://';
    return data;
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const data = readForm();
    if (typeof data === 'string') { showError(data); return; }
    showError('');
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    try {
      fb = await connect();
      if (!fb) throw new Error('not-connected');
      data.uid = fb.uid;
      data.status = 'pending';
      data.ts = fb.fs.serverTimestamp();
      await fb.fs.addDoc(fb.fs.collection(fb.db, window.ReaderProjects.COLLECTION), data);
      closeForm();
      status('Thanks! Your suggestion will appear once it has been reviewed.');
    } catch (err) {
      console.error(err);
      showError(err && err.code === 'permission-denied'
        ? 'That could not be saved. Check the details and try again.'
        : 'Could not reach the database. Check your connection and try again.');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send for review';
    }
  });

  // ---------- approved suggestions join the Projects layer ----------
  window.ReaderProjects.watchApproved(function (features) {
    if (typeof setReaderProjects === 'function') setReaderProjects(features);
  });
})();
