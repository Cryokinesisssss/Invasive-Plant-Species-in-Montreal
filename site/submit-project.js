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
// Needs site/app.js loaded first (map, speciesCatalog, projectFeatures,
// setReaderProjects).
// ============================================================

// ===== SETTINGS =====
const SUBMIT = {
  collection: 'project_submissions',
  // Montréal agglomeration; the Firestore rules check the same box
  bounds: { south: 45.40, north: 45.71, west: -73.98, east: -73.47 },
  max: { name: 100, organization: 100, description: 400, speciesOther: 60, url: 300, species: 10 },
  firebaseConfig: {
    apiKey: 'AIzaSyCPKGOuv_lThk1KVaV6VgSxpvwXp-hifdY',
    authDomain: 'invasive-plants-montreal.firebaseapp.com',
    projectId: 'invasive-plants-montreal',
    appId: '1:709970743488:web:faaf0ec6407a6431459d25'
  }
};
const SUBMIT_SDK = 'https://www.gstatic.com/firebasejs/12.18.0/';   // pinned version (same as the kit)

(function () {
  if (typeof map === 'undefined') return;

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
  overlay.innerHTML =
    '<form class="risk-info suggest-form" role="dialog" aria-modal="true" aria-labelledby="suggest-title" novalidate>' +
      '<div class="risk-info-head">' +
        '<h2 id="suggest-title">Suggest a project</h2>' +
        '<button class="risk-info-close" type="button" data-s="close" aria-label="Close">×</button>' +
      '</div>' +
      '<p class="suggest-intro">Know of work to control invasive plants in Montréal? Tell us about it. ' +
        'Suggestions are reviewed before they appear on the map.</p>' +
      '<label class="suggest-field">Project name' +
        '<input name="name" required maxlength="' + SUBMIT.max.name + '"></label>' +
      '<label class="suggest-field">Organization' +
        '<input name="organization" required maxlength="' + SUBMIT.max.organization + '" list="suggest-orgs">' +
        '<datalist id="suggest-orgs"></datalist></label>' +
      '<div class="suggest-row">' +
        '<label class="suggest-field">Start year<input name="year_start" type="number" required min="1990" max="2100" inputmode="numeric"></label>' +
        '<label class="suggest-field">End year<input name="year_end" type="number" min="1990" max="2100" inputmode="numeric" placeholder="Ongoing"></label>' +
      '</div>' +
      '<label class="suggest-field">What was done' +
        '<textarea name="description" required rows="3" maxlength="' + SUBMIT.max.description + '"></textarea></label>' +
      '<fieldset class="suggest-field suggest-species"><legend>Species targeted</legend>' +
        '<div class="suggest-species-list" data-s="species"></div>' +
        '<input name="species_other" maxlength="' + SUBMIT.max.speciesOther + '" placeholder="Other plant, if not listed" aria-label="Other plant, if not listed">' +
      '</fieldset>' +
      '<fieldset class="suggest-field"><legend>The location you clicked is</legend>' +
        '<label class="suggest-radio"><input type="radio" name="marker_type" value="site" required> Where the work happens</label>' +
        '<label class="suggest-radio"><input type="radio" name="marker_type" value="area"> Somewhere in the project area</label>' +
        '<label class="suggest-radio"><input type="radio" name="marker_type" value="organization"> The organization’s office or meeting point</label>' +
      '</fieldset>' +
      '<label class="suggest-field">Source link' +
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

  function fillChoices() {
    // Species: the map's species list (common name + Latin name)
    const box = overlay.querySelector('[data-s="species"]');
    box.textContent = '';
    (typeof speciesCatalog !== 'undefined' ? speciesCatalog : []).forEach(function (s) {
      if (!s.sci) return;
      const label = document.createElement('label');
      label.className = 'suggest-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.name = 'species'; cb.value = s.sci;
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
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeForm(); });
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
      species_other: v('species_other').slice(0, SUBMIT.max.speciesOther),
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
      await connect();
      if (!fb) throw new Error('not-connected');
      data.uid = fb.uid;
      data.status = 'pending';
      data.ts = fb.fs.serverTimestamp();
      await fb.fs.addDoc(fb.fs.collection(fb.db, SUBMIT.collection), data);
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

  // ---------- Firebase (same steps as the kit's shared route) ----------
  // Reading approved projects needs no sign-in; sending one does.
  let opening = null;
  function openDb() {
    if (opening) return opening;
    opening = (async function () {
      const app = await import(SUBMIT_SDK + 'firebase-app.js');
      const fs = await import(SUBMIT_SDK + 'firebase-firestore.js');
      const fapp = app.initializeApp(SUBMIT.firebaseConfig);
      return { app: app, fapp: fapp, fs: fs, db: fs.getFirestore(fapp) };
    })().catch(function (err) {
      console.error(err);
      opening = null;   // allow a retry
      return null;
    });
    return opening;
  }

  let connecting = null;
  function connect() {
    if (connecting) return connecting;
    connecting = (async function () {
      const base = await openDb();
      if (!base) return null;
      const au = await import(SUBMIT_SDK + 'firebase-auth.js');
      const auth = au.getAuth(base.fapp);
      await au.signInAnonymously(auth);            // a random, anonymous id for this browser
      fb = { fs: base.fs, db: base.db, uid: auth.currentUser.uid };
      return fb;
    })().catch(function (err) {
      console.error(err);
      connecting = null;
      return null;
    });
    return connecting;
  }

  // ---------- show approved suggestions in the Projects layer ----------
  function toFeature(id, d) {
    const common = {};
    (typeof speciesCatalog !== 'undefined' ? speciesCatalog : []).forEach(function (s) { if (s.sci) common[s.sci] = s.common; });
    const species = (Array.isArray(d.species) ? d.species : []).filter(function (s) { return typeof s === 'string'; })
      .map(function (sci) { return { common: common[sci] || sci, scientific: sci }; });
    if (d.species_other) species.push({ common: String(d.species_other), in_catalog: false });
    const years = d.year_end == null ? d.year_start + '–present'
      : (d.year_end === d.year_start ? String(d.year_start) : d.year_start + '–' + d.year_end);
    return {
      type: 'Feature',
      properties: {
        id: 'reader-' + id,
        name: d.name,
        organization: d.organization,
        year: years,
        description: d.description,
        species: species,
        marker_type: d.marker_type,
        project_url: d.source_url,
        reader_submitted: true
      },
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] }
    };
  }

  let approvedDocs = [];
  function showApproved() {
    const features = approvedDocs.map(function (doc) { return toFeature(doc.id, doc.data()); })
      .filter(function (f) { return isFinite(f.geometry.coordinates[0]) && isFinite(f.geometry.coordinates[1]); });
    if (typeof setReaderProjects === 'function') setReaderProjects(features);
  }

  (async function loadApproved() {
    const conn = await openDb();
    if (!conn) return;   // no database: the map's own projects still show
    const q = conn.fs.query(conn.fs.collection(conn.db, SUBMIT.collection),
      conn.fs.where('status', '==', 'approved'), conn.fs.limit(200));
    conn.fs.onSnapshot(q, function (snap) {
      approvedDocs = snap.docs;
      showApproved();
    }, function (err) { console.error('Approved suggestions could not be loaded:', err); });
  })();

  // Common names come from the map's species list, which loads with the
  // observations; redraw once it's there.
  const waitForSpecies = setInterval(function () {
    if (typeof observationDataLoaded !== 'undefined' && observationDataLoaded) {
      clearInterval(waitForSpecies);
      if (approvedDocs.length) showApproved();
    }
  }, 500);
  setTimeout(function () { clearInterval(waitForSpecies); }, 60000);
})();
