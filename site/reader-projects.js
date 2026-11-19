// ============================================================
// READER PROJECTS — shared Firebase connection
// ------------------------------------------------------------
// Used by the map (site/submit-project.js) and the projects page
// (site/projects.js). Same pinned SDK, config and anonymous sign-in
// as the GEOG 464 memory.js kit's shared route.
//
// Only suggestions with status "approved" can be read (see
// firestore.rules); approving happens in the Firebase console.
// ============================================================
window.ReaderProjects = (function () {
  const SDK = 'https://www.gstatic.com/firebasejs/12.18.0/';   // pinned version (same as the kit)
  const COLLECTION = 'project_submissions';
  const CONFIG = {
    apiKey: 'AIzaSyCPKGOuv_lThk1KVaV6VgSxpvwXp-hifdY',
    authDomain: 'invasive-plants-montreal.firebaseapp.com',
    projectId: 'invasive-plants-montreal',
    appId: '1:709970743488:web:faaf0ec6407a6431459d25'
  };

  // Reading needs no sign-in
  let opening = null;
  function openDb() {
    if (opening) return opening;
    opening = (async function () {
      const app = await import(SDK + 'firebase-app.js');
      const fs = await import(SDK + 'firebase-firestore.js');
      const fapp = app.initializeApp(CONFIG);
      return { fapp: fapp, fs: fs, db: fs.getFirestore(fapp) };
    })().catch(function (err) {
      console.error(err);
      opening = null;   // allow a retry
      return null;
    });
    return opening;
  }

  // Sending needs a (random, anonymous) sign-in
  let connecting = null;
  function connect() {
    if (connecting) return connecting;
    connecting = (async function () {
      const base = await openDb();
      if (!base) return null;
      const au = await import(SDK + 'firebase-auth.js');
      const auth = au.getAuth(base.fapp);
      await au.signInAnonymously(auth);
      return { fs: base.fs, db: base.db, uid: auth.currentUser.uid };
    })().catch(function (err) {
      console.error(err);
      connecting = null;
      return null;
    });
    return connecting;
  }

  // A Firestore suggestion -> the same GeoJSON shape as data/projects.geojson.
  // Species are stored as "Common name|Latin name".
  function toFeature(id, d) {
    const species = (Array.isArray(d.species) ? d.species : [])
      .filter(function (s) { return typeof s === 'string' && s; })
      .map(function (s) {
        const parts = s.split('|');
        const sci = (parts[1] || parts[0]).trim();
        return { common: (parts[0] || sci).trim(), scientific: sci };
      });
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

  // Calls onChange(features) now and whenever an approval changes
  async function watchApproved(onChange) {
    const conn = await openDb();
    if (!conn) return;   // no database: the site's own projects still show
    const q = conn.fs.query(conn.fs.collection(conn.db, COLLECTION),
      conn.fs.where('status', '==', 'approved'), conn.fs.limit(200));
    conn.fs.onSnapshot(q, function (snap) {
      onChange(snap.docs.map(function (doc) { return toFeature(doc.id, doc.data()); })
        .filter(function (f) { return isFinite(f.geometry.coordinates[0]) && isFinite(f.geometry.coordinates[1]); }));
    }, function (err) { console.error('Approved suggestions could not be loaded:', err); });
  }

  return { COLLECTION: COLLECTION, connect: connect, watchApproved: watchApproved };
})();
