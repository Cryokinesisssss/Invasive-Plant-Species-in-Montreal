// ============================================================
// species.js — Species Catalog page
//
// Section index (use this to find things fast at the demo):
//   A. SPECIES data                    → the species array (high/mod/low/watch)
//   B. Observation counts              → fetch places.geojson + sentinel
//   C. Tier metadata + projects        → TIER_META, PROJECTS
//   D. DOM handles                     → listEl, taxPanel, projPanel
//   E. Filter state                    → catFilters (tier/presence/rank/search)
//   F. Helpers                         → initialsFor, escapeHtml, renderPhoto, renderCounts, rankOf
//   G. render()                        → the main render loop (what "rebuilds cards")
//   H. renderCard(s)                   → one card's HTML
//   I. Taxonomy panel                  → showTaxonomy()
//   J. Projects panel                  → showProjects()
//   K. Card active highlight           → markActiveCard()
//   L. Panel close buttons
//   M. Filter UI popovers               → open/close behaviour
//   N. Popover checkboxes               → tier / presence / rank
//   O. Summaries                       → "All" / "N selected" labels
//   P. Live search suggestions          → keyboard + click
//   Q. Reset                            → Reset button
//   R. Initial render
// ============================================================


// ============================================================
// A. SPECIES DATA — the hard-coded species list
//    tier: 'high' | 'moderate' | 'low' | 'watch'
// ============================================================
const SPECIES = [
  // ---------------- HIGH RISK ----------------
  { tier: 'high', common: 'Garlic mustard', sci: 'Alliaria petiolata',
    presence: 'Established', ban: true,
    wiki: 'Alliaria_petiolata',
    desc: '<em>Alliaria petiolata</em> is a biennial flowering plant in the Mustard family, Brassicaceae. It is native to Europe, western and central Asia, and northwestern Africa, from Morocco, Iberia and the British Isles, north to northern Scandinavia, and east to northern Pakistan and western China (Xinjiang).',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/510499131/large.jpg', photoCredit: 'LaSalle, QC<br>iNaturalist / patrice_dupont', photoCreditUrl: 'https://www.inaturalist.org/observations/284080201',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Brassicales',
           family: 'Brassicaceae', genus: 'Alliaria', species: 'A. petiolata' } },
  { tier: 'high', common: 'Water chestnut', sci: 'Trapa natans',
    presence: 'Established', ban: true,
    wiki: 'Trapa_natans',
    desc: 'The water caltrop is any of three extant species of the genus <em>Trapa</em>: <em>Trapa natans</em>, <em>Trapa bicornis</em> and the endangered <em>Trapa rossica</em>. It is also known as water chestnut, buffalo nut, bat nut, devil pod, ling nut, lin kok, ling kio nut, or singhara. In India it is called singada.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/720862362/large.jpg', photoCredit: 'L\'Île-Bizard-Sainte-Geneviève, QC<br>iNaturalist / sara-charlotte', photoCreditUrl: 'https://www.inaturalist.org/observations/393294088',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Myrtales',
           family: 'Lythraceae', genus: 'Trapa', species: 'T. natans' } },
  { tier: 'high', common: 'Norway maple', sci: 'Acer platanoides',
    presence: 'Established', ban: false,
    wiki: 'Acer_platanoides',
    desc: '<em>Acer platanoides</em> (Norway maple) is a species of maple native to eastern and central Europe and western Asia, from France east to Russia, north to southern Scandinavia and southeast to northern Iran. It is a member of the soapberry and lychee family.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/697205189/large.jpg', photoCredit: 'Lachine, QC<br>iNaturalist / amagregz', photoCreditUrl: 'https://www.inaturalist.org/observations/381056940',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Sapindales',
           family: 'Sapindaceae', genus: 'Acer', species: 'A. platanoides' } },
  { tier: 'high', common: 'Eurasian watermilfoil', sci: 'Myriophyllum spicatum',
    presence: 'Established', ban: true,
    wiki: 'Myriophyllum_spicatum',
    desc: '<em>Myriophyllum spicatum</em> (Eurasian watermilfoil or spiked water-milfoil) is native to Europe, Asia, and north Africa. It is a submerged aquatic plant, and grows in still or slow-moving water.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/480274547/original.jpeg', photoCredit: 'Île-Bizard, QC<br>iNaturalist / weilival', photoCreditUrl: 'https://www.inaturalist.org/observations/267269703',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Core eudicots', order: 'Saxifragales',
           family: 'Haloragaceae', genus: 'Myriophyllum', species: 'M. spicatum' } },
  { tier: 'high', common: 'Glossy buckthorn', sci: 'Frangula alnus',
    presence: 'Established', ban: true,
    wiki: 'Frangula_alnus',
    desc: '<em>Frangula alnus</em>, commonly known as alder buckthorn, glossy buckthorn, or breaking buckthorn, is a tall deciduous shrub in the family Rhamnaceae. Unlike other "buckthorns", alder buckthorn does not have thorns.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/707460724/large.jpg', photoCredit: 'Verdun, QC<br>iNaturalist / therapsid74', photoCreditUrl: 'https://www.inaturalist.org/observations/386393144',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Rosales',
           family: 'Rhamnaceae', genus: 'Frangula', species: 'F. alnus' } },
  { tier: 'high', common: 'Common buckthorn', sci: 'Rhamnus cathartica',
    presence: 'Established', ban: true,
    wiki: 'Rhamnus_cathartica',
    desc: '<em>Rhamnus cathartica</em>, the buckthorn, common buckthorn or purging buckthorn, is a species of small tree in the flowering plant family Rhamnaceae. It is native to Europe, northwest Africa and western Asia, from the central British Isles south to Morocco, and east to Kyrgyzstan.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/692443733/original.jpg', photoCredit: 'Montréal, QC<br>iNaturalist / jimclark', photoCreditUrl: 'https://www.inaturalist.org/observations/378597574',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Rosales',
           family: 'Rhamnaceae', genus: 'Rhamnus', species: 'R. cathartica' } },
  { tier: 'high', common: 'Bohemian knotweed', sci: 'Reynoutria × bohemica',
    presence: 'Established', ban: true,
    wiki: 'Reynoutria_%C3%97_bohemica',
    desc: 'Bohemian knotweed is a nothospecies that is a cross between Japanese knotweed and giant knotweed. It has been documented as occurring in the wild in Japan. The scientific name is accepted to be <em>Reynoutria × bohemica</em>, but it may also be referred to as <em>Fallopia × bohemica</em> and <em>Polygonum × bohemicum</em>.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/436507937/original.jpg', photoCredit: 'Outremont, QC<br>iNaturalist / blakesito', photoCreditUrl: 'https://www.inaturalist.org/observations/244692667',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Core eudicots', order: 'Caryophyllales',
           family: 'Polygonaceae', genus: 'Reynoutria', species: 'R. × bohemica' } },
  { tier: 'high', common: 'Giant knotweed', sci: 'Reynoutria sachalinensis',
    presence: 'Established', ban: true,
    wiki: 'Reynoutria_sachalinensis',
    desc: '<em>Reynoutria sachalinensis</em> (giant knotweed or Sakhalin knotweed) is a species of <em>Fallopia</em> native to northeastern Asia in northern Japan (Hokkaidō, Honshū) and the far east of Russia.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/89049947/large.jpg', photoCredit: 'Outremont, QC<br>iNaturalist / tangaras', photoCreditUrl: 'https://www.inaturalist.org/observations/55905246',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Core eudicots', order: 'Caryophyllales',
           family: 'Polygonaceae', genus: 'Reynoutria', species: 'R. sachalinensis' } },
  { tier: 'high', common: 'Japanese knotweed', sci: 'Reynoutria japonica',
    presence: 'Established', ban: true,
    wiki: 'Reynoutria_japonica',
    desc: '<em>Reynoutria japonica</em>, synonyms <em>Fallopia japonica</em> and <em>Polygonum cuspidatum</em>, is a large species of herbaceous perennial plant of the knotweed and buckwheat family Polygonaceae. It is commonly known as Asian knotweed or Japanese knotweed. It is native to East Asia in Japan, China and Korea.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/558319579/large.jpg', photoCredit: 'Montréal-Est, QC<br>iNaturalist / marcolivierbeausoleil', photoCreditUrl: 'https://www.inaturalist.org/observations/309403251',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Core eudicots', order: 'Caryophyllales',
           family: 'Polygonaceae', genus: 'Reynoutria', species: 'R. japonica' } },
  { tier: 'high', common: 'Common reed', sci: 'Phragmites australis subsp. australis',
    presence: 'Established', ban: true,
    wiki: 'Phragmites_australis',
    desc: '<em>Phragmites australis</em>, known as the common reed, is a species of flowering plant in the grass family Poaceae. It is a wetland grass that can grow up to 20 feet (6 metres) tall and has a cosmopolitan distribution worldwide.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/736222024/original.jpg', photoCredit: 'Montréal, QC<br>iNaturalist / patrice_dupont', photoCreditUrl: 'https://www.inaturalist.org/observations/401134459',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Commelinids', order: 'Poales',
           family: 'Poaceae', genus: 'Phragmites', species: 'P. australis' } },
  { tier: 'high', common: 'Water soldier', sci: 'Stratiotes aloides',
    presence: 'Established', ban: true,
    wiki: 'Stratiotes_aloides',
    desc: '<em>Stratiotes aloides</em>, commonly known as water soldiers or water pineapple, is a submerged aquatic plant native to Europe and northwestern Asia. In Britain it was once common in East Anglia and still is in many places, particularly wet ditches and healthy ponds.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Monocots', order: 'Alismatales',
           family: 'Hydrocharitaceae', genus: 'Stratiotes', species: 'S. aloides' } },

  // ---------------- MODERATE RISK ----------------
  { tier: 'moderate', common: 'Reed canary grass', sci: 'Phalaris arundinacea',
    presence: 'Established', ban: false,
    wiki: 'Phalaris_arundinacea',
    desc: '<em>Phalaris arundinacea</em>, sometimes known as reed canary grass, is a tall, perennial bunchgrass that commonly forms extensive single-species stands along the margins of lakes and streams and in wet open areas, with a wide distribution in Europe, Asia, northern Africa and North America.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/389902549/large.jpeg', photoCredit: 'Verdun, QC<br>iNaturalist / therapsid74', photoCreditUrl: 'https://www.inaturalist.org/observations/220234447',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Commelinids', order: 'Poales',
           family: 'Poaceae', genus: 'Phalaris', species: 'P. arundinacea' } },
  { tier: 'moderate', common: 'Giant hogweed', sci: 'Heracleum mantegazzianum',
    presence: 'Established', ban: true,
    wiki: 'Heracleum_mantegazzianum',
    desc: '<em>Heracleum mantegazzianum</em>, commonly known as giant hogweed, cartwheel-flower, giant cow parsnip, hogsbane or giant cow parsley, is a plant in the family Apiaceae. It typically grows to heights of 2 to 5 metres.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/663935629/large.jpg', photoCredit: 'Pierrefonds-Roxboro, QC<br>iNaturalist / meldesbois', photoCreditUrl: 'https://www.inaturalist.org/observations/363710135',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Apiales',
           family: 'Apiaceae', genus: 'Heracleum', species: 'H. mantegazzianum' } },
  { tier: 'moderate', common: 'Carolina fanwort', sci: 'Cabomba caroliniana',
    presence: 'Absent', ban: true,
    wiki: 'Cabomba_caroliniana',
    desc: '<em>Cabomba caroliniana</em> is an aquatic perennial herbaceous plant native to North and South America. It is a weed of national significance in Australia and on the list of invasive alien species of union concern in the EU.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           order: 'Nymphaeales', family: 'Cabombaceae',
           genus: 'Cabomba', species: 'C. caroliniana' } },
  { tier: 'moderate', common: 'Oriental bittersweet', sci: 'Celastrus orbiculatus',
    presence: 'Established', ban: true,
    wiki: 'Celastrus_orbiculatus',
    desc: '<em>Celastrus orbiculatus</em> is a woody vine of the Celastraceae family. It is commonly called Oriental bittersweet. Other common names include Chinese bittersweet, Asian bittersweet, round-leaved bittersweet, and Asiatic bittersweet.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/167928990/large.jpg', photoCredit: 'Mont-Royal, QC<br>iNaturalist / air48', photoCreditUrl: 'https://www.inaturalist.org/observations/100602142',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Celastrales',
           family: 'Celastraceae', genus: 'Celastrus', species: 'C. orbiculatus' } },
  { tier: 'moderate', common: 'Amur honeysuckle', sci: 'Lonicera maackii',
    presence: 'Absent', ban: true,
    wiki: 'Lonicera_maackii',
    desc: '<em>Lonicera maackii</em>, the Amur honeysuckle, is a species of honeysuckle in the family Caprifoliaceae that is native to temperate western Asia, specifically in northern and western China south to Yunnan, Mongolia, Primorsky Krai in southeastern Russia, Korea, and, albeit rare there, central and northern Japan.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Dipsacales',
           family: 'Caprifoliaceae', genus: 'Lonicera', species: 'L. maackii' } },
  { tier: 'moderate', common: 'European swallow-wort', sci: 'Vincetoxicum rossicum',
    presence: 'Established', ban: true,
    wiki: 'Vincetoxicum_rossicum',
    desc: '<em>Vincetoxicum rossicum</em> is a flowering plant of the milkweed family. It is a perennial herb native to southern Europe and is a highly invasive plant growing in all of the Eastern United States, in the midwest, and southern Ontario and Quebec in Canada.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/135047105/large.jpeg', photoCredit: 'Rosemont-La Petite-Patrie, QC<br>iNaturalist / elbourret', photoCreditUrl: 'https://www.inaturalist.org/observations/82290076',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Gentianales',
           family: 'Apocynaceae', genus: 'Vincetoxicum', species: 'V. rossicum' } },
  { tier: 'moderate', common: 'Black swallow-wort', sci: 'Vincetoxicum nigrum',
    presence: 'Established', ban: true,
    wiki: 'Vincetoxicum_nigrum',
    desc: '<em>Cynanchum louiseae</em>, a species in the milkweed family, is also known as black swallow-wort, Louise\'s swallow-wort, or black dog-strangling vine. It is native to Europe and is found primarily in Italy, France, Portugal, and Spain.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/135048297/large.jpeg', photoCredit: 'Rosemont-La Petite-Patrie, QC<br>iNaturalist / elbourret', photoCreditUrl: 'https://www.inaturalist.org/observations/82290632',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Gentianales',
           family: 'Apocynaceae', genus: 'Vincetoxicum', species: 'V. nigrum' } },
  { tier: 'moderate', common: 'Ground elder', sci: 'Aegopodium podagraria',
    presence: 'Established', ban: true,
    wiki: 'Aegopodium_podagraria',
    desc: '<em>Aegopodium podagraria</em> L., commonly called ground elder, herb gerard, bishop\'s weed, goutweed, gout wort, and snow-in-the-mountain, and sometimes called English masterwort and wild masterwort, is a perennial plant in the carrot family (Apiaceae) that grows in shady places.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/722767015/large.jpg', photoCredit: 'Rosemont-La Petite-Patrie, QC<br>iNaturalist / marcolivierbeausoleil', photoCreditUrl: 'https://www.inaturalist.org/observations/394262007',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Apiales',
           family: 'Apiaceae', genus: 'Aegopodium', species: 'A. podagraria' } },
  { tier: 'moderate', common: 'Brazilian waterweed', sci: 'Egeria densa',
    presence: 'Absent', ban: true,
    wiki: 'Egeria_densa',
    desc: '<em>Elodea densa</em>, the large-flowered waterweed or Brazilian waterweed, is a species of <em>Elodea</em> native to warm temperate South America in southeastern Brazil, Argentina, Chile and Uruguay.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Monocots', order: 'Alismatales',
           family: 'Hydrocharitaceae', genus: 'Egeria', species: 'E. densa' } },
  { tier: 'moderate', common: 'Japanese barberry', sci: 'Berberis thunbergii',
    presence: 'Established', ban: true,
    wiki: 'Berberis_thunbergii',
    desc: '<em>Berberis thunbergii</em>, the Japanese barberry, Thunberg\'s barberry, or red barberry, is a species of flowering plant in the barberry family, Berberidaceae, native to Japan and eastern Asia, though widely naturalized in China and in North America.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/456674096/large.jpeg', photoCredit: 'Ville-Marie, QC<br>iNaturalist / frontyardscientist', photoCreditUrl: 'https://www.inaturalist.org/observations/254895784',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', order: 'Ranunculales',
           family: 'Berberidaceae', genus: 'Berberis', species: 'B. thunbergii' } },
  { tier: 'moderate', common: 'Butterbur', sci: 'Petasites hybridus',
    presence: 'Established', ban: false,
    wiki: 'Petasites_hybridus',
    desc: '<em>Petasites hybridus</em>, the butterbur, is a herbaceous perennial flowering plant in the daisy family Asteraceae, native to Europe and northern Asia.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/458323351/large.jpeg', photoCredit: 'Dorval, QC<br>iNaturalist / chriscgr', photoCreditUrl: 'https://www.inaturalist.org/observations/255717067',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Asterales',
           family: 'Asteraceae', genus: 'Petasites', species: 'P. hybridus' } },
  { tier: 'moderate', common: 'Hydrilla', sci: 'Hydrilla verticillata',
    presence: 'Absent', ban: true,
    wiki: 'Hydrilla',
    desc: '<em>Hydrilla</em> (waterthyme) is a genus of aquatic plant, usually treated as containing just one species, <em>Hydrilla verticillata</em>, though some botanists divide it into several species.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Monocots', order: 'Alismatales',
           family: 'Hydrocharitaceae', genus: 'Hydrilla', species: 'H. verticillata' } },
  { tier: 'moderate', common: 'European frog-bit', sci: 'Hydrocharis morsus-ranae',
    presence: 'Established', ban: true,
    wiki: 'Hydrocharis_morsus-ranae',
    desc: '<em>Hydrocharis morsus-ranae</em>, frogbit, is a flowering plant belonging to the genus <em>Hydrocharis</em> in the family Hydrocharitaceae. In North America, it is referred to as common frogbit or European frog\'s-bit to distinguish it from the related American frogbit (<em>Limnobium spongia</em>).',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/690802056/large.jpg', photoCredit: 'L\'Île-Bizard-Sainte-Geneviève, QC<br>iNaturalist / gmlise', photoCreditUrl: 'https://www.inaturalist.org/observations/377747628',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Monocots', order: 'Alismatales',
           family: 'Hydrocharitaceae', genus: 'Hydrocharis', species: 'H. morsus-ranae' } },
  { tier: 'moderate', common: 'Himalayan balsam', sci: 'Impatiens glandulifera',
    presence: 'Established', ban: true,
    wiki: 'Impatiens_glandulifera',
    desc: '<em>Impatiens glandulifera</em> is a large annual plant native to the Himalayas. Via human introduction it is now present across much of the Northern Hemisphere and is considered an invasive species in some areas.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/731937916/large.jpg', photoCredit: 'Le Sud-Ouest, QC<br>iNaturalist / thistrblmkr', photoCreditUrl: 'https://www.inaturalist.org/observations/398967269',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Ericales',
           family: 'Balsaminaceae', genus: 'Impatiens', species: 'I. glandulifera' } },
  { tier: 'moderate', common: 'Japanese stiltgrass', sci: 'Microstegium vimineum',
    presence: 'Absent', ban: true,
    wiki: 'Microstegium_vimineum',
    desc: '<em>Microstegium vimineum</em>, commonly known as Japanese stiltgrass, packing grass, or Nepalese browntop, is an annual grass that is common in a wide variety of habitats and is well adapted to low light levels.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Commelinids', order: 'Poales',
           family: 'Poaceae', genus: 'Microstegium', species: 'M. vimineum' } },
  { tier: 'moderate', common: 'Parrot feather', sci: 'Myriophyllum aquaticum',
    presence: 'Absent', ban: true,
    wiki: 'Myriophyllum_aquaticum',
    desc: '<em>Myriophyllum aquaticum</em> is a flowering plant, a vascular dicot, commonly called parrot\'s-feather and parrot feather watermilfoil.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Core eudicots', order: 'Saxifragales',
           family: 'Haloragaceae', genus: 'Myriophyllum', species: 'M. aquaticum' } },
  { tier: 'moderate', common: 'Starry stonewort', sci: 'Nitellopsis obtusa',
    presence: 'Established', ban: false,
    wiki: 'Nitellopsis_obtusa',
    desc: '<em>Nitellopsis obtusa</em> is a large freshwater alga. It is also known by the common name starry stonewort.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/148164691/large.jpeg', photoCredit: 'Verdun, QC<br>iNaturalist / vincauc', photoCreditUrl: 'https://www.inaturalist.org/observations/89705805',
    photoLicense: 'CC-BY-NC',   // observation isn't on the map, so its license isn't in photo_licenses.json
    tax: { kingdom: 'Plantae', clade: 'Charophytes', class: 'Charophyceae',
           order: 'Charales', family: 'Characeae',
           genus: 'Nitellopsis', species: 'N. obtusa' } },
  { tier: 'moderate', common: 'Autumn olive', sci: 'Elaeagnus umbellata',
    presence: 'Absent', ban: true,
    wiki: 'Elaeagnus_umbellata',
    desc: '<em>Elaeagnus umbellata</em> is known as Japanese silverberry, umbellata oleaster, autumn olive, autumn elaeagnus, or spreading oleaster. The species is indigenous to eastern Asia and ranges from the Himalayas eastwards to Japan.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Rosales',
           family: 'Elaeagnaceae', genus: 'Elaeagnus', species: 'E. umbellata' } },
  { tier: 'moderate', common: 'Giant butterbur', sci: 'Petasites japonicus',
    presence: 'Established', ban: false,
    wiki: 'Petasites_japonicus',
    desc: '<em>Petasites japonicus</em>, also known as butterbur, giant butterbur, great butterbur and sweet-coltsfoot, is an herbaceous perennial plant in the family Asteraceae. It exists in China, Japan, Korea and Sakhalin, and is especially common around the Swiss Alps.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/497403429/large.jpeg', photoCredit: 'Le Plateau-Mont-Royal, QC<br>iNaturalist / frontyardscientist', photoCreditUrl: 'https://www.inaturalist.org/observations/277003495',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Asterales',
           family: 'Asteraceae', genus: 'Petasites', species: 'P. japonicus' } },
  { tier: 'moderate', common: 'Brittle naiad', sci: 'Najas minor',
    presence: 'Established', ban: true,
    wiki: 'Najas_minor',
    desc: '<em>Najas minor</em>, known as brittle naiad or brittle waternymph, is an annual aquatic plant, a submersed herb. It is native to Europe, Asia and North Africa from the Netherlands to Morocco east to Japan and the Philippines.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Monocots', order: 'Alismatales',
           family: 'Hydrocharitaceae', genus: 'Najas', species: 'N. minor' } },
  { tier: 'moderate', common: 'Curly-leaf pondweed', sci: 'Potamogeton crispus',
    presence: 'Established', ban: true,
    wiki: 'Potamogeton_crispus',
    desc: '<em>Potamogeton crispus</em>, the curled pondweed or curly-leaf pondweed, is a species of aquatic plant native to Eurasia but an introduced species and often a noxious weed in North America.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/678691682/large.jpg', photoCredit: 'Pierrefonds-Roxboro, QC<br>iNaturalist / marc_aurele', photoCreditUrl: 'https://www.inaturalist.org/observations/371462351',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Monocots', order: 'Alismatales',
           family: 'Potamogetonaceae', genus: 'Potamogeton', species: 'P. crispus' } },
  { tier: 'moderate', common: 'Lesser celandine', sci: 'Ficaria verna',
    presence: 'Established', ban: true,
    wiki: 'Ficaria_verna',
    desc: '<em>Ficaria verna</em> (formerly <em>Ranunculus ficaria</em> L.), commonly known as lesser celandine or pilewort, is a low-growing, hairless perennial flowering plant in the buttercup family Ranunculaceae native to Europe and west Asia.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/278308506/large.jpg', photoCredit: 'Rosemont-La Petite-Patrie, QC<br>iNaturalist / elacroix-carignan', photoCreditUrl: 'https://www.inaturalist.org/observations/161027896',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', order: 'Ranunculales',
           family: 'Ranunculaceae', genus: 'Ficaria', species: 'F. verna' } },

  // ---------------- LOW RISK ----------------
  { tier: 'low', common: 'Tree of heaven', sci: 'Ailanthus altissima',
    presence: 'Established', ban: false,
    wiki: 'Ailanthus_altissima',
    desc: '<em>Ailanthus altissima</em>, commonly known as tree of heaven or ailanthus tree, is a deciduous tree in the quassia family. It is native to northeast and central China, and Taiwan.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/667144065/large.jpg', photoCredit: 'Le Plateau-Mont-Royal, QC<br>iNaturalist / joseedoyon', photoCreditUrl: 'https://www.inaturalist.org/observations/365405624',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Sapindales',
           family: 'Simaroubaceae', genus: 'Ailanthus', species: 'A. altissima' } },
  { tier: 'low', common: 'Cow parsley', sci: 'Anthriscus sylvestris',
    presence: 'Established', ban: false,
    wiki: 'Anthriscus_sylvestris',
    desc: '<em>Anthriscus sylvestris</em>, known as cow parsley, wild chervil, wild beaked parsley, or keck, is a herbaceous biennial or short-lived perennial plant in the family Apiaceae (Umbelliferae), genus <em>Anthriscus</em>.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/640374360/large.jpg', photoCredit: 'Lachine, QC<br>iNaturalist / lapalma', photoCreditUrl: 'https://www.inaturalist.org/observations/350943979',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Apiales',
           family: 'Apiaceae', genus: 'Anthriscus', species: 'A. sylvestris' } },
  { tier: 'low', common: 'Black alder', sci: 'Alnus glutinosa',
    presence: 'Established', ban: false,
    wiki: 'Alnus_glutinosa',
    desc: '<em>Alnus glutinosa</em>, the common alder, black alder, European alder or just alder, is a species of tree in the family Betulaceae, native to most of Europe, southwest Asia and northern Africa.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/307373903/large.jpg', photoCredit: 'Ahuntsic-Cartierville, QC<br>iNaturalist / marieblain', photoCreditUrl: 'https://www.inaturalist.org/observations/176774257',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Fagales',
           family: 'Betulaceae', genus: 'Alnus', species: 'A. glutinosa' } },
  { tier: 'low', common: 'Hogweed', sci: 'Heracleum sphondylium',
    presence: 'Established', ban: true,
    wiki: 'Heracleum_sphondylium',
    desc: '<em>Heracleum sphondylium</em>, commonly known as hogweed, common hogweed or cow parsnip, is a herbaceous perennial or biennial plant in the umbelliferous family Apiaceae that includes fennel, cow parsley, ground elder and giant hogweed. It is native to Europe and Asia.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Apiales',
           family: 'Apiaceae', genus: 'Heracleum', species: 'H. sphondylium' } },
  { tier: 'low', common: 'Flowering rush', sci: 'Butomus umbellatus',
    presence: 'Established', ban: false,
    wiki: 'Butomus_umbellatus',
    desc: '<em>Butomus umbellatus</em> is the Old World Palearctic and Asian plant species in the family Butomaceae. Common names include flowering rush or grass rush.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/426961745/medium.jpeg',
    photoCredit: 'RDP-PAT, QC<br>weilival / iNaturalist',
    photoCreditUrl: 'https://www.inaturalist.org/observations/239708197',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Monocots', order: 'Alismatales',
           family: 'Butomaceae', genus: 'Butomus', species: 'B. umbellatus' } },
  { tier: 'low', common: 'Morrow honeysuckle', sci: 'Lonicera morrowii',
    presence: 'Established', ban: false,
    wiki: 'Lonicera_morrowii',
    desc: '<em>Lonicera morrowii</em>, the Morrow\'s honeysuckle, is a deciduous honeysuckle in the family Caprifoliaceae, native to Japan, Korea, and Northeast China. It is a shrub, reaching a height of 2–2.5 m, with oblong leaves 4–6 cm long.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/198753164/large.jpeg', photoCredit: 'Anjou, QC<br>iNaturalist / renard_frak', photoCreditUrl: 'https://www.inaturalist.org/observations/117672074',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Dipsacales',
           family: 'Caprifoliaceae', genus: 'Lonicera', species: 'L. morrowii' } },
  { tier: 'low', common: 'Tatarian honeysuckle', sci: 'Lonicera tatarica',
    presence: 'Established', ban: false,
    wiki: 'Lonicera_tatarica',
    desc: '<em>Lonicera tatarica</em> is a species of honeysuckle known by the common name Tartarian honeysuckle. It is native to Siberia and other parts of eastern Asia, but it is probably better known in North America, where it is a widespread introduced species and noxious weed.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/670198837/large.jpg', photoCredit: 'Ville-Marie, QC<br>iNaturalist / shihongli2016', photoCreditUrl: 'https://www.inaturalist.org/observations/367007773',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Dipsacales',
           family: 'Caprifoliaceae', genus: 'Lonicera', species: 'L. tatarica' } },
  { tier: 'low', common: 'Showy honeysuckle', sci: 'Lonicera × bella',
    presence: 'Established', ban: false,
    wiki: 'Lonicera_%C3%97_bella',
    desc: '<em>Lonicera × bella</em>, known as Bell\'s honeysuckle and showy fly honeysuckle, is a hybrid species of flowering plant in the family Caprifoliaceae. It was first described by Hermann Zabel in 1889.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/384066518/large.jpg', photoCredit: 'Mercier-Hochelaga-Maisonneuve, QC<br>iNaturalist / lucetucru_', photoCreditUrl: 'https://www.inaturalist.org/observations/217124437',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Dipsacales',
           family: 'Caprifoliaceae', genus: 'Lonicera', species: 'L. × bella' } },
  { tier: 'low', common: 'Comfrey', sci: 'Symphytum officinale',
    presence: 'Established', ban: false,
    wiki: 'Symphytum_officinale',
    desc: '<em>Symphytum officinale</em> is a perennial flowering plant of the genus <em>Symphytum</em> in the family Boraginaceae. Along with thirty-four other species of <em>Symphytum</em>, it is known as comfrey. To differentiate it from other members of the genus, this species is known as common comfrey or true comfrey.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/727664656/large.jpg', photoCredit: 'Rosemont-La Petite-Patrie, QC<br>iNaturalist / marcolivierbeausoleil', photoCreditUrl: 'https://www.inaturalist.org/observations/396784022',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Boraginales',
           family: 'Boraginaceae', genus: 'Symphytum', species: 'S. officinale' } },
  { tier: 'low', common: 'Amur maple', sci: 'Acer ginnala',
    presence: 'Established', ban: false,
    wiki: 'Acer_ginnala',
    desc: '<em>Acer ginnala</em> (Amur maple) is a plant species with woody stems native to northeastern Asia from easternmost Mongolia east to Korea and Japan, and north to the Russian Far East in the Amur River valley.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/692799600/large.jpg', photoCredit: 'Lachine, QC<br>iNaturalist / amagregz', photoCreditUrl: 'https://www.inaturalist.org/observations/378783342',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Sapindales',
           family: 'Sapindaceae', genus: 'Acer', species: 'A. ginnala' } },
  { tier: 'low', common: 'Yellow floating heart', sci: 'Nymphoides peltata',
    presence: 'Established', ban: true,
    wiki: 'Nymphoides_peltata',
    desc: '<em>Nymphoides peltata</em> (fringed water lily, yellow floating heart, floating heart, water fringe, entire marshwort) is a perennial, rooted aquatic plant with floating leaves of the family Menyanthaceae.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/752486279/large.jpg', photoCredit: 'Saint-Laurent, QC<br>iNaturalist / pdz', photoCreditUrl: 'https://www.inaturalist.org/observations/409277691',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Asterales',
           family: 'Menyanthaceae', genus: 'Nymphoides', species: 'N. peltata' } },
  { tier: 'low', common: 'Hedge bedstraw', sci: 'Galium mollugo',
    presence: 'Established', ban: false,
    wiki: 'Galium_mollugo',
    desc: '<em>Galium mollugo</em>, common name hedge bedstraw or false baby\'s breath, is a herbaceous annual plant of the family Rubiaceae. It shares the name hedge bedstraw with the related European species, <em>Galium album</em>.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/548127501/large.jpg', photoCredit: 'Mercier-Hochelaga-Maisonneuve, QC<br>iNaturalist / marpou', photoCreditUrl: 'https://www.inaturalist.org/observations/304076788',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Gentianales',
           family: 'Rubiaceae', genus: 'Galium', species: 'G. mollugo' } },
  { tier: 'low', common: 'Reed manna grass', sci: 'Glyceria maxima',
    presence: 'Established', ban: false,
    wiki: 'Glyceria_maxima',
    desc: '<em>Glyceria maxima</em>, commonly known as great manna grass, reed mannagrass, and reed sweet-grass, is a species of rhizomatous perennial grasses in the mannagrass genus native to Europe and western Asia.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Commelinids', order: 'Poales',
           family: 'Poaceae', genus: 'Glyceria', species: 'G. maxima' } },
  { tier: 'low', common: 'Yellow flag iris', sci: 'Iris pseudacorus',
    presence: 'Established', ban: false,
    wiki: 'Iris_pseudacorus',
    desc: '<em>Iris pseudacorus</em>, the yellow flag, yellow iris, or water flag, is a species of flowering plant in the family Iridaceae. It is native to Europe, western Asia and northwest Africa.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/521438555/large.jpg', photoCredit: 'Pierrefonds-Roxboro, QC<br>iNaturalist / spottytowhee', photoCreditUrl: 'https://www.inaturalist.org/observations/289892197',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Monocots', order: 'Asparagales',
           family: 'Iridaceae', genus: 'Iris', species: 'I. pseudacorus' } },
  { tier: 'low', common: 'Water hyacinth', sci: 'Pontederia crassipes',
    presence: 'Single observation', ban: false,
    wiki: 'Pontederia_crassipes',
    desc: '<em>Eichhornia crassipes</em>, commonly known as common water hyacinth, is an aquatic plant native to the Amazon basin, and is often a highly problematic invasive species outside its native range.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/565601989/large.jpg', photoCredit: 'Ville-Marie, QC<br>iNaturalist / veronicaparadiso', photoCreditUrl: 'https://www.inaturalist.org/observations/313217368',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Commelinids', order: 'Commelinales',
           family: 'Pontederiaceae', genus: 'Pontederia', species: 'P. crassipes' } },
  { tier: 'low', common: 'Dame’s rocket', sci: 'Hesperis matronalis',
    presence: 'Established', ban: false,
    wiki: 'Hesperis_matronalis',
    desc: '<em>Hesperis matronalis</em> is a herbaceous plant species in the mustard family, Brassicaceae. It has numerous common names, including dame\'s rocket, damask violet, dame\'s-violet, dames-wort, dame\'s gilliflower, night-scented gilliflower, queen\'s gilliflower, rogue\'s gilliflower, summer lilac, and sweet rocket.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/673358067/large.jpg', photoCredit: 'Le Plateau-Mont-Royal, QC<br>iNaturalist / marcolivierbeausoleil', photoCreditUrl: 'https://www.inaturalist.org/observations/368661152',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Brassicales',
           family: 'Brassicaceae', genus: 'Hesperis', species: 'H. matronalis' } },
  { tier: 'low', common: 'Kudzu', sci: 'Pueraria montana',
    presence: 'Absent', ban: true,
    wiki: 'Pueraria_montana',
    desc: '<em>Pueraria montana</em> is a species of plant in the botanical family Fabaceae. At least three sub-species (alternatively called varieties) are known. It is closely related to other species in the genus <em>Pueraria</em>.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Fabales',
           family: 'Fabaceae', genus: 'Pueraria', species: 'P. montana' } },
  { tier: 'low', common: 'Water lettuce', sci: 'Pistia stratiotes',
    presence: 'Single observation', ban: false,
    wiki: 'Pistia',
    desc: '<em>Pistia</em> is a genus of aquatic plant in the arum family, Araceae. The single species it comprises, <em>Pistia stratiotes</em>, is often called water cabbage, water lettuce, Nile cabbage, or shellflower.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/594027192/large.jpg', photoCredit: 'Saint-Laurent, QC<br>iNaturalist / lithobates', photoCreditUrl: 'https://www.inaturalist.org/observations/327858616',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Monocots', order: 'Alismatales',
           family: 'Araceae', genus: 'Pistia', species: 'P. stratiotes' } },
  { tier: 'low', common: 'Yellow archangel', sci: 'Lamium galeobdolon',
    presence: 'Established', ban: false,
    wiki: 'Lamium_galeobdolon',
    desc: '<em>Lamium galeobdolon</em>, commonly known as yellow archangel, artillery plant, or aluminium plant, is a widespread wildflower in Europe, and has been introduced elsewhere as a garden plant.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/739948873/large.jpg', photoCredit: 'Rosemont-La Petite-Patrie, QC<br>iNaturalist / marcolivierbeausoleil', photoCreditUrl: 'https://www.inaturalist.org/observations/403037288',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Lamiales',
           family: 'Lamiaceae', genus: 'Lamium', species: 'L. galeobdolon' } },
  { tier: 'low', common: 'Garden lupin', sci: 'Lupinus polyphyllus',
    presence: 'Established', ban: false,
    wiki: 'Lupinus_polyphyllus',
    desc: '<em>Lupinus polyphyllus</em> (large-leaved lupine, big-leaved lupine, many-leaved lupine or, primarily in cultivation, garden lupin) is a species of lupine native to western North America from southern Alaska and British Columbia east to Quebec, and western Wyoming, and south to Utah and California.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/677205281/large.jpg', photoCredit: 'Sainte-Anne-de-Bellevue, QC<br>iNaturalist / sarah_99', photoCreditUrl: 'https://www.inaturalist.org/observations/370684809',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Fabales',
           family: 'Fabaceae', genus: 'Lupinus', species: 'L. polyphyllus' } },
  { tier: 'low', common: 'Silver grass', sci: 'Miscanthus sacchariflorus',
    presence: 'Established', ban: false,
    wiki: 'Miscanthus_sacchariflorus',
    desc: '<em>Miscanthus sacchariflorus</em> (common name: Amur silver-grass) is a grass native to temperate Northeast Asia.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/756582345/large.jpg', photoCredit: 'LaSalle, QC<br>iNaturalist / oleterre', photoCreditUrl: 'https://www.inaturalist.org/observations/411283954',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Commelinids', order: 'Poales',
           family: 'Poaceae', genus: 'Miscanthus', species: 'M. sacchariflorus' } },
  { tier: 'low', common: 'Chinese silver grass', sci: 'Miscanthus sinensis',
    presence: 'Established', ban: false,
    wiki: 'Miscanthus_sinensis',
    desc: '<em>Miscanthus sinensis</em> is a species of flowering plant in the grass family Poaceae, native to eastern Asia throughout most of China, Japan, Taiwan and Korea. It is an herbaceous perennial grass, growing to 0.8–2 m (3–7 ft) tall, rarely 4 m (13 ft), forming dense clumps from an underground rhizome.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Commelinids', order: 'Poales',
           family: 'Poaceae', genus: 'Miscanthus', species: 'M. sinensis' } },
  { tier: 'low', common: 'Siberian elm', sci: 'Ulmus pumila',
    presence: 'Established', ban: false,
    wiki: 'Ulmus_pumila',
    desc: '<em>Ulmus pumila</em>, the Siberian elm, is a tree native to Central Asia, eastern Siberia, the Russian Far East, Mongolia, Tibet, northern China, India (northern Kashmir) and Korea. It is also known as the Asiatic elm and dwarf elm.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/710654541/large.jpg', photoCredit: 'Mercier-Hochelaga-Maisonneuve, QC<br>iNaturalist / elacroix-carignan', photoCreditUrl: 'https://www.inaturalist.org/observations/388050848',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Rosales',
           family: 'Ulmaceae', genus: 'Ulmus', species: 'U. pumila' } },
  { tier: 'low', common: 'Periwinkle', sci: 'Vinca minor',
    presence: 'Established', ban: false,
    wiki: 'Vinca_minor',
    desc: '<em>Vinca minor</em> (common names lesser periwinkle or dwarf periwinkle) is a species of flowering plant native to central and southern Europe, from Portugal and France north to the Netherlands and the Baltic States, east to the Caucasus, and also southwestern Asia in Turkey.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/382595478/large.jpeg', photoCredit: 'Verdun, QC<br>iNaturalist / maximelaterreur', photoCreditUrl: 'https://www.inaturalist.org/observations/216338724',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Gentianales',
           family: 'Apocynaceae', genus: 'Vinca', species: 'V. minor' } },
  { tier: 'low', common: 'Black locust', sci: 'Robinia pseudoacacia',
    presence: 'Established', ban: false,
    wiki: 'Robinia_pseudoacacia',
    desc: '<em>Robinia pseudoacacia</em>, commonly known in its native territory as black locust, is a medium-sized deciduous tree native to the southeastern United States, but it has been widely planted and naturalized elsewhere in temperate North America, Europe, Southern Africa and Asia and is considered an invasive species.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/671818861/large.jpg', photoCredit: 'Mercier-Hochelaga-Maisonneuve, QC<br>iNaturalist / thatipoaceae', photoCreditUrl: 'https://www.inaturalist.org/observations/367858343',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Fabales',
           family: 'Fabaceae', genus: 'Robinia', species: 'R. pseudoacacia' } },
  { tier: 'low', common: 'Creeping yellowcress', sci: 'Rorippa amphibia',
    presence: 'Established', ban: false,
    wiki: 'Rorippa_amphibia',
    desc: '<em>Rorippa amphibia</em> is a plant species in the genus <em>Rorippa</em>. It is called great yellowcress. The flowers are visited by many types of insects, and can be characterized by a generalized pollination syndrome.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Brassicales',
           family: 'Brassicaceae', genus: 'Rorippa', species: 'R. amphibia' } },
  { tier: 'low', common: 'Multiflora rose', sci: 'Rosa multiflora',
    presence: 'Established', ban: false,
    wiki: 'Rosa_multiflora',
    desc: '<em>Rosa multiflora</em> (syn. <em>Rosa polyantha</em>) is a species of rose known commonly as multiflora rose, baby rose, Japanese rose, many-flowered rose, seven-sisters rose, and Eijitsu rose. It is native to eastern Asia, in China, Japan and Korea.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/525343975/large.jpg', photoCredit: 'Ahuntsic-Cartierville, QC<br>iNaturalist / karuquebec', photoCreditUrl: 'https://www.inaturalist.org/observations/291958824',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Rosales',
           family: 'Rosaceae', genus: 'Rosa', species: 'R. multiflora' } },
  { tier: 'low', common: 'Rugosa rose', sci: 'Rosa rugosa',
    presence: 'Established', ban: false,
    wiki: 'Rosa_rugosa',
    desc: '<em>Rosa rugosa</em> (rugosa rose, beach rose, Japanese rose, or Ramanas rose) is a species of rose native to eastern Asia, in northeastern China, Japan, Korea and southeastern Siberia, where it grows on the coast, often on sand dunes.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/689112581/large.jpg', photoCredit: 'LaSalle, QC<br>iNaturalist / karinaviera', photoCreditUrl: 'https://www.inaturalist.org/observations/376870819',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Rosales',
           family: 'Rosaceae', genus: 'Rosa', species: 'R. rugosa' } },
  { tier: 'low', common: 'Purple loosestrife', sci: 'Lythrum salicaria',
    presence: 'Established', ban: false,
    wiki: 'Lythrum_salicaria',
    desc: '<em>Lythrum salicaria</em> (purple loosestrife) is a flowering plant belonging to the family Lythraceae. It should not be confused with other plants sharing the name loosestrife that are members of the family Primulaceae. Other names include spiked loosestrife, or purple lythrum.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/712310853/large.jpg', photoCredit: 'Rosemont-La Petite-Patrie, QC<br>iNaturalist / marcolivierbeausoleil', photoCreditUrl: 'https://www.inaturalist.org/observations/388893553',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Myrtales',
           family: 'Lythraceae', genus: 'Lythrum', species: 'L. salicaria' } },
  { tier: 'low', common: 'Water fern', sci: 'Salvinia spp.',
    presence: 'Single observation', ban: false,
    wiki: 'Salvinia',
    desc: '<em>Salvinia</em>, a genus in the family Salviniaceae, is a floating fern named in honor of Anton Maria Salvini, a 17th-century Italian scientist. Watermoss is a common name for <em>Salvinia</em>.',
    photo: '', photoCredit: 'iNaturalist', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', class: 'Polypodiopsida',
           order: 'Salviniales', family: 'Salviniaceae',
           genus: 'Salvinia', species: '' } },
  { tier: 'low', common: 'Jerusalem artichoke', sci: 'Helianthus tuberosus',
    presence: 'Established', ban: false,
    wiki: 'Helianthus_tuberosus',
    desc: 'The Jerusalem artichoke (<em>Helianthus tuberosus</em>), also called sunroot, sunchoke, earth apple, or topinambour, is a species of sunflower native to eastern North America, and found from eastern Canada and Maine west to North Dakota, and south to northern Florida and Texas.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/601508107/large.jpg', photoCredit: 'Côte-des-Neiges-Notre-Dame-de-Grâce, QC<br>iNaturalist / elacroix-carignan', photoCreditUrl: 'https://www.inaturalist.org/observations/331561485',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Asterales',
           family: 'Asteraceae', genus: 'Helianthus', species: 'H. tuberosus' } },
  { tier: 'low', common: 'Common valerian', sci: 'Valeriana officinalis',
    presence: 'Established', ban: false,
    wiki: 'Valeriana_officinalis',
    desc: 'Valerian (<em>Valeriana officinalis</em>, Caprifoliaceae) is a perennial flowering plant native to Europe and Asia. In the summer when the mature plant may have a height of 1.5 metres, it bears sweetly scented pink or white flowers.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/661691110/large.jpg', photoCredit: 'Le Sud-Ouest, QC<br>iNaturalist / patrice_dupont', photoCreditUrl: 'https://www.inaturalist.org/observations/362534095',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Dipsacales',
           family: 'Caprifoliaceae', genus: 'Valeriana', species: 'V. officinalis' } },
  { tier: 'low', common: 'Virginia creeper', sci: 'Parthenocissus quinquefolia',
    presence: 'Established', ban: false,
    wiki: 'Parthenocissus_quinquefolia',
    desc: '<em>Parthenocissus quinquefolia</em>, known as Virginia creeper, Victoria creeper, five-leaved ivy, or five-finger, is a species of flowering plant in the grape family, Vitaceae.',
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/431751697/large.jpeg', photoCredit: 'Rosemont-La Petite-Patrie, QC<br>iNaturalist / marcolivierbeausoleil', photoCreditUrl: 'https://www.inaturalist.org/observations/242193414',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Vitales',
           family: 'Vitaceae', genus: 'Parthenocissus', species: 'P. quinquefolia' } },

  // ---------------- WATCH LIST (undetermined) ----------------
  { tier: 'watch', common: 'Japanese chaff flower', sci: 'Achyranthes japonica',
    presence: 'Absent', ban: false,
    wiki: 'Achyranthes_japonica', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Core eudicots', order: 'Caryophyllales',
           family: 'Amaranthaceae', genus: 'Achyranthes', species: 'A. japonica' } },
  { tier: 'watch', common: 'Wild angelica', sci: 'Angelica sylvestris',
    presence: 'Established', ban: false,
    wiki: 'Angelica_sylvestris', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Apiales',
           family: 'Apiaceae', genus: 'Angelica', species: 'A. sylvestris' } },
  { tier: 'watch', common: 'Mosquito fern', sci: 'Azolla spp.',
    presence: 'Single observation', ban: false,
    wiki: 'Azolla', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', class: 'Polypodiopsida',
           order: 'Salviniales', family: 'Salviniaceae',
           genus: 'Azolla', species: '' } },
  { tier: 'watch', common: 'Japanese honeysuckle', sci: 'Lonicera japonica',
    presence: 'Absent', ban: false,
    wiki: 'Lonicera_japonica', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Dipsacales',
           family: 'Caprifoliaceae', genus: 'Lonicera', species: 'L. japonica' } },
  { tier: 'watch', common: 'Common barberry', sci: 'Berberis vulgaris',
    presence: 'Established', ban: false,
    wiki: 'Berberis_vulgaris', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', order: 'Ranunculales',
           family: 'Berberidaceae', genus: 'Berberis', species: 'B. vulgaris' } },
  { tier: 'watch', common: 'Burning bush', sci: 'Euonymus alatus',
    presence: 'Established', ban: false,
    wiki: 'Euonymus_alatus', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Celastrales',
           family: 'Celastraceae', genus: 'Euonymus', species: 'E. alatus' } },
  { tier: 'watch', common: 'Water primrose', sci: 'Ludwigia peploides',
    presence: 'Absent', ban: false,
    wiki: 'Ludwigia_peploides', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Rosids', order: 'Myrtales',
           family: 'Onagraceae', genus: 'Ludwigia', species: 'L. peploides' } },
  { tier: 'watch', common: 'Creeping jenny', sci: 'Lysimachia nummularia',
    presence: 'Established', ban: false,
    wiki: 'Lysimachia_nummularia', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Angiosperms',
           clade3: 'Eudicots', clade4: 'Asterids', order: 'Ericales',
           family: 'Primulaceae', genus: 'Lysimachia', species: 'L. nummularia' } },
  { tier: 'watch', common: 'Four-leaf clover fern', sci: 'Marsilea quadrifolia',
    presence: 'Absent', ban: false,
    wiki: 'Marsilea_quadrifolia', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', class: 'Polypodiopsida',
           order: 'Salviniales', family: 'Marsileaceae',
           genus: 'Marsilea', species: 'M. quadrifolia' } },
  { tier: 'watch', common: 'Mugo pine', sci: 'Pinus mugo',
    presence: 'Established', ban: false,
    wiki: 'Pinus_mugo', desc: '',
    photo: '', photoCredit: 'Wikimedia Commons', photoCreditUrl: '',
    tax: { kingdom: 'Plantae', clade: 'Tracheophytes', clade2: 'Gymnosperms',
           division: 'Pinophyta', class: 'Pinopsida', order: 'Pinales',
           family: 'Pinaceae', genus: 'Pinus', species: 'P. mugo' } }
];

SPECIES.forEach(function (species) {
  species.priority = PRIORITY_SPECIES.has(species.sci);
});


// ============================================================
// B. OBSERVATION COUNTS — auto-loaded from the two GeoJSON files
// ============================================================
const OBS_COUNTS = {};

// ---- B1. Photo licenses, keyed by iNaturalist observation id ----
const PHOTO_LICENSES = {};
const LICENSE_URLS = {
  'CC0':         'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC-BY':       'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-SA':    'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC-BY-ND':    'https://creativecommons.org/licenses/by-nd/4.0/',
  'CC-BY-NC':    'https://creativecommons.org/licenses/by-nc/4.0/',
  'CC-BY-NC-SA': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  'CC-BY-NC-ND': 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
};

// License for a catalog photo, only if it is the same photo as the observation's
function photoLicenseFor(s) {
  const obs = /\/observations\/(\d+)/.exec(s.photoCreditUrl || '');
  const photo = /\/photos\/(\d+)\//.exec(s.photo || '');
  if (!obs || !photo) return null;
  const lic = PHOTO_LICENSES[obs[1]];
  let code;
  if (lic && lic.photoId === photo[1]) code = String(lic.code).toUpperCase();
  else if (s.photoLicense) code = String(s.photoLicense).toUpperCase();   // set by hand for photos not on the map
  else return null;
  return {
    label: code === 'CC0' ? 'CC0' : code.replace(/^CC-/, 'CC '),   // "CC-BY-NC" -> "CC BY-NC"
    url: LICENSE_URLS[code] || ''
  };
}

function normLatin(s) {
  return (s || '').toLowerCase().trim()
    .replace(/\s+(var\.|subsp\.|f\.|forma)\s+\S+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bumpCount(sci, key) {
  if (!sci) return;
  if (!OBS_COUNTS[sci]) OBS_COUNTS[sci] = { inat: 0, sentinel: 0, unknownAcc: 0 };
  OBS_COUNTS[sci][key]++;
}

Promise.all([
  fetch('../data/places.geojson').then(function (r) { return r.json(); }).catch(function () { return { features: [] }; }),
  fetch('../data/sentinel_wgs84.geojson').then(function (r) { return r.json(); }).catch(function () { return { features: [] }; })
]).then(function (results) {
  var inat = results[0];
  var sent = results[1];

  // Photo licenses for the catalog photos (they come from these observations)
  (inat.features || []).forEach(function (f) {
    var p = f.properties || {};
    if (!p.id || !p.photo_license || !p.image_url) return;
    var m = /\/photos\/(\d+)\//.exec(p.image_url);
    PHOTO_LICENSES[String(p.id)] = { code: p.photo_license, photoId: m ? m[1] : null };
  });

  var byNorm = {};
  SPECIES.forEach(function (s) { byNorm[normLatin(s.sci)] = s.sci; });
  byNorm[normLatin('Phragmites australis australis')] = 'Phragmites australis subsp. australis';

  var byBinomial = {};
  SPECIES.forEach(function (s) {
    var b = normLatin(s.sci).split(' ').slice(0, 2).join(' ');
    if (!byBinomial[b]) byBinomial[b] = s.sci;
  });
  // Catalog name for a raw Latin name; falls back to genus + species so
  // subspecies records ("Lamium galeobdolon argentatum") count toward their entry.
  function catalogSci(raw) {
    return byNorm[normLatin(raw)] ||
      byBinomial[normLatin(raw).split(' ').slice(0, 2).join(' ')] || null;
  }

  (inat.features || []).forEach(function (f) {
    // Skip obscured-coordinate records, matching the map
    var obscured = f.properties.coordinates_obscured;
    if (obscured === true || obscured === 'true' || obscured === 'True') return;
    var raw = (f.properties.scientific_name || '').trim();
    // Records without a recorded accuracy are hidden on the map by default,
    // so count them separately from the normal iNaturalist count
    var pa = f.properties.positional_accuracy, ppa = f.properties.public_positional_accuracy;
    var unknownAcc = (pa === null || pa === undefined || pa === '') &&
                     (ppa === null || ppa === undefined || ppa === '');
    bumpCount(catalogSci(raw) || raw, unknownAcc ? 'unknownAcc' : 'inat');
  });

  (sent.features || []).forEach(function (f) {
    var raw = (f.properties.scientific_name || f.properties['Nom_espece_latin'] || '').trim();
    var key = catalogSci(raw);
    if (key) bumpCount(key, 'sentinel');
  });

  if (typeof render === 'function') render();
}).catch(function (err) {
  console.error('Could not load observation counts:', err);
});


// ============================================================
// C. TIER METADATA + PROJECTS — tier labels and per-species projects
// ============================================================
const TIER_META = {
  high:     { label: 'High risk',            className: 'tier-high' },
  moderate: { label: 'Moderate risk',        className: 'tier-moderate' },
  low:      { label: 'Low risk',             className: 'tier-low' },
  watch:    { label: 'Undetermined — watch', className: 'tier-watch' }
};

let projectRecords = [];

function projectsFor(s) {
  return projectRecords.filter(function (project) {
    const species = project.properties && project.properties.species;
    return Array.isArray(species) && species.some(function (item) {
      return item && normLatin(item.scientific) === normLatin(s.sci);
    });
  });
}

fetch('../data/projects.geojson')
  .then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' loading projects.geojson');
    return response.json();
  })
  .then(function (data) {
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('projects.geojson must be a GeoJSON FeatureCollection');
    }
    projectRecords = data.features.filter(function (feature) {
      return feature && feature.type === 'Feature' && feature.properties;
    });
    render();
  })
  .catch(function (err) {
    console.error('Could not load catalog project data:', err);
  });


// ============================================================
// D. DOM HANDLES — the elements the script talks to
// ============================================================
const listEl   = document.getElementById('species-list');
const countEl  = document.getElementById('species-count');

const taxPanel = document.getElementById('taxonomy-panel');
const taxBody  = document.getElementById('tax-body');
const taxClose = document.getElementById('tax-close');

const projPanel = document.getElementById('projects-panel');
const projBody  = document.getElementById('pp-body');
const projClose = document.getElementById('pp-close');


// ============================================================
// E. FILTER STATE — the single source of truth for catalog filters
// ============================================================
const catFilters = {
  search: '',
  tier: new Set(),
  presence: new Set(),
  rank: new Set(),
  priorityOnly: false,
  sort: 'default'
};


// ============================================================
// F. HELPERS — initials, escaping, photo + counts, rank detection
// ============================================================
function initialsFor(s) {
  const source = s.common || s.sci || '?';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

// ---- F1. Photo (or placeholder with tier colour) ----
function renderPhoto(s) {
  const hasPhoto = typeof s.photo === 'string' && s.photo.length > 0;
  const license  = hasPhoto ? photoLicenseFor(s) : null;
  const credit   = (s.photoCredit || '') + (s.photoCredit && license ? ' · ' + license.label : '');
  const creditEl = credit
    ? (s.photoCreditUrl
        ? '<a class="species-credit" href="' + s.photoCreditUrl +
          '" target="_blank" rel="noopener noreferrer">' + credit + '</a>'
        : '<span class="species-credit">' + credit + '</span>')
    : '';

  if (!hasPhoto) {
    const meta = TIER_META[s.tier];
    return (
      '<div class="species-photo species-photo-placeholder ' + meta.className + '">' +
        '<span class="spp-initials">' + initialsFor(s) + '</span>' +
        '<span class="spp-hint">add photo</span>' +
        creditEl +
      '</div>'
    );
  }

  return (
    '<div class="species-photo">' +
      '<img class="species-photo-zoom" src="' + s.photo + '" data-full="' + escapeAttr(s.photo) + '"' +
        ' data-caption="' + escapeAttr(s.common + (s.photoCredit ? ' — ' + s.photoCredit.replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]*>/g, '') : '')) + '"' +
        (license ? ' data-license="' + escapeAttr(license.label) + '" data-license-url="' + escapeAttr(license.url) + '"' : '') +
        ' alt="' + escapeAttr(s.common) + '" loading="lazy" tabindex="0" role="button"' +
        ' title="Click to enlarge" />' +
      creditEl +
    '</div>'
  );
}

// ---- F2. Counts (iNat + Sentinelle pills) ----
function renderCounts(s) {
  const c = OBS_COUNTS[s.sci];
  if (!c || (c.inat === 0 && c.sentinel === 0)) return '';

  function fmt(n) {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
    return String(n);
  }

  const inatPart = c.inat > 0
    ? '<span class="species-count-pill" title="iNaturalist observations">' +
        '<span class="sc-dot sc-dot-inat" title="iNaturalist"></span>' + fmt(c.inat) +
      '</span>'
    : '';
  const sentPart = c.sentinel > 0
    ? '<span class="species-count-pill" title="Sentinelle observations">' +
        '<span class="sc-dot sc-dot-sentinel" title="Sentinelle"></span>' + fmt(c.sentinel) +
      '</span>'
    : '';

  return '<div class="species-counts">' + inatPart + sentPart + '</div>';
}

function observationTotal(s) {
  const counts = OBS_COUNTS[s.sci];
  return counts ? counts.inat + counts.sentinel : 0;
}

// ---- F3. Rank detection (species / hybrid / subspecies / genus) ----
function rankOf(s) {
  if (s.rank) return s.rank;
  const sci = (s.sci || '').toLowerCase();
  if (sci.indexOf('×') !== -1 || sci.indexOf(' x ') !== -1) return 'hybrid';
  if (sci.indexOf('subsp.') !== -1)                         return 'subspecies';
  if (sci.indexOf('spp.')   !== -1)                         return 'genus';
  return 'species';
}

function normalizeSearchText(text) {
  return (text || '').toLowerCase().replace(/×/g, 'x');
}


// ============================================================
// G. render() — THE MAIN RENDER LOOP
//    Filters SPECIES, sorts by tier, and rebuilds the whole list.
//    This is the function that "rebuilds every card from scratch".
// ============================================================
function render() {
  const q     = normalizeSearchText(catFilters.search).trim();
  const tiers = catFilters.tier;
  const pres  = catFilters.presence;
  const ranks = catFilters.rank;

  const filtered = SPECIES.filter(function (s) {
    if (catFilters.priorityOnly && !s.priority) return false;
    if (tiers.size && !tiers.has(s.tier)) return false;
    if (pres.size  && !pres.has(s.presence)) return false;
    if (ranks.size) {
      const r = rankOf(s);
      if (!ranks.has(r)) return false;
    }
    if (q) {
      const hay = normalizeSearchText(s.common + ' ' + s.sci);
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  const tierOrder = { high: 0, moderate: 1, low: 2, watch: 3 };
  filtered.sort(function (a, b) {
    if (catFilters.sort !== 'default') {
      const sortByObservations = catFilters.sort.indexOf('observations-') === 0;
      const direction = catFilters.sort.endsWith('-asc') ? 1 : -1;
      const countA = sortByObservations ? observationTotal(a) : projectsFor(a).length;
      const countB = sortByObservations ? observationTotal(b) : projectsFor(b).length;
      if (countA !== countB) return (countA - countB) * direction;
    }

    const d = tierOrder[a.tier] - tierOrder[b.tier];
    return d !== 0 ? d : a.common.localeCompare(b.common);
  });

  countEl.textContent = filtered.length + ' of ' + SPECIES.length + ' species';

  if (!filtered.length) {
    listEl.innerHTML = '<p class="species-empty">No species match these filters.</p>';
    return;
  }

  let html = '';
  let currentTier = null;
  filtered.forEach(function (s) {
    if (catFilters.sort === 'default' && s.tier !== currentTier) {
      currentTier = s.tier;
      const meta = TIER_META[s.tier];
      html += '<h2 class="species-tier-heading ' + meta.className + '">' + meta.label +
        '</h2>';
    }
    html += renderCard(s);
  });
  listEl.innerHTML = html;

  // ---- G1. Rewire the buttons on the freshly built cards ----
  listEl.querySelectorAll('.species-tax-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      showTaxonomy(SPECIES[idx]);
    });
  });
  listEl.querySelectorAll('.species-project-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      showProjects(SPECIES[idx]);
    });
  });
}


// ============================================================
// H. renderCard(s) — ONE CARD'S HTML
// ============================================================
function renderCard(s) {
  const idx     = SPECIES.indexOf(s);
  const wikiUrl = 'https://en.wikipedia.org/wiki/' + s.wiki;
  const meta    = TIER_META[s.tier];
  const projs   = projectsFor(s);
  const hasProj = projs.length > 0;

  const presenceLabel =
    s.presence === 'Established'        ? 'Established' :
    s.presence === 'Absent'             ? 'Absent' :
    s.presence === 'Single observation' ? 'Occasional observation' :
    s.presence;

  const banPill = s.ban
    ? '<button type="button" class="pill pill-ban" data-info="refee" title="What does this mean?">Cultivation &amp; sale prohibited (REFEE)</button>'
    : '';

  const descHtml = s.desc
    ? '<p class="species-desc">' + s.desc + '</p>'
    : '<p class="species-desc species-desc-empty">Description coming soon.</p>';

  const counts = OBS_COUNTS[s.sci];
  const hasObs = counts && (counts.inat > 0 || counts.sentinel > 0 || counts.unknownAcc > 0);
  // Only unknown-accuracy records: open the map with that option already on
  const onlyUnknown = hasObs && counts.inat === 0 && counts.sentinel === 0;
  const mapBtn = hasObs
    ? '<a class="species-map-btn" href="../map.html?species=' + encodeURIComponent(s.sci) +
        (onlyUnknown ? '&accuracy=all' : '') + '"' +
        (onlyUnknown ? ' title="Only records with unknown location accuracy"' : '') + '>View in map</a>'
    : '<span class="species-map-btn is-empty" title="No mapped observations in Montréal">Not on map</span>';

  const projectBtn = hasProj
    ? '<button class="species-project-btn" data-idx="' + idx + '" type="button">' +
        'View projects &amp; initiatives <span class="spb-count">' + projs.length + '</span>' +
      '</button>'
    : '<button class="species-project-btn is-empty" type="button" disabled ' +
        'title="No projects or initiatives recorded for this species">' +
        'No projects recorded' +
      '</button>';

  return (
    '<article class="species-card">' +
      renderPhoto(s) +
      renderCounts(s) +
      '<div class="species-body">' +
        '<div class="species-card-head">' +
          '<h3 class="species-name">' + s.common + '</h3>' +
          '<button type="button" class="species-tier-badge ' + meta.className + '" data-info="risk" title="What does this risk level mean?">' + meta.label + '</button>' +
        '</div>' +
        '<p class="species-sci"><em>' + s.sci + '</em></p>' +
        '<div class="species-pills">' +
          '<button type="button" class="pill pill-status" data-info="presence" title="What does the Québec status mean?">Québec: ' + presenceLabel + '</button>' +
          (s.priority
            ? '<button type="button" class="pill pill-priority" data-info="priority" title="One of Québec’s 26 priority plant species for control">Québec priority</button>'
            : '') +
          banPill +
        '</div>' +
        descHtml +
        '<div class="species-actions">' +
          mapBtn +
          '<button class="species-tax-btn" data-idx="' + idx + '" type="button">View scientific classification</button>' +
          projectBtn +
          '<a class="species-wiki" href="' + wikiUrl + '" target="_blank" rel="noopener noreferrer">Wikipedia ↗</a>' +
        '</div>' +
      '</div>' +
    '</article>'
  );
}


// ============================================================
// I. TAXONOMY PANEL — "View scientific classification"
// ============================================================
const TAX_ROWS = [
  ['Kingdom',  'kingdom'],
  ['Clade',    'clade'],
  ['Clade',    'clade2'],
  ['Clade',    'clade3'],
  ['Clade',    'clade4'],
  ['Division', 'division'],
  ['Class',    'class'],
  ['Order',    'order'],
  ['Family',   'family'],
  ['Genus',    'genus'],
  ['Species',  'species']
];

function showTaxonomy(s) {
  projPanel.hidden = true;
  const header = '<div class="tax-species">' +
      '<div class="tax-common">' + s.common + '</div>' +
      '<div class="tax-sci"><em>' + s.sci + '</em></div>' +
    '</div>';

  let rows = '';
  const t = s.tax || {};
  TAX_ROWS.forEach(function (pair) {
    const label = pair[0];
    const key   = pair[1];
    const value = t[key];
    if (!value) return;
    const italic = (key === 'genus' || key === 'species');
    const valueHtml = italic ? '<em>' + value + '</em>' : value;

    rows += '<div class="tax-row">' +
              '<span class="tax-label">' + label + '</span>' +
              '<span class="tax-value">' + valueHtml + '</span>' +
            '</div>';
  });

  taxBody.innerHTML = header + '<div class="tax-rows">' + rows + '</div>';
  taxPanel.hidden = false;

  markActiveCard(s);
  revealPanel(taxPanel);
}


// ============================================================
// J. PROJECTS PANEL — "View projects & initiatives"
// ============================================================
function showProjects(s) {
  const projs = projectsFor(s);

  let html = '<div class="pp-species">' +
      '<div class="pp-common">' + s.common + '</div>' +
      '<div class="pp-sci"><em>' + s.sci + '</em></div>' +
    '</div>';

  if (!projs.length) {
    html += '<p class="pp-empty">No projects or initiatives recorded for this species yet.</p>';
  } else {
    html += '<ul class="pp-list">';
    projs.forEach(function (project) {
      const p = project.properties;
      const org = p.organization ? '<span class="pp-org">' + escapeHtml(p.organization) +
        (p.year ? ' · ' + escapeHtml(p.year) : '') + '</span>' : '';
      let links = '';
      if (p.project_url && /^https?:\/\//i.test(p.project_url)) {
        links += '<a class="pp-link" href="' + escapeAttr(p.project_url) +
          '" target="_blank" rel="noopener noreferrer">Original project details ↗</a>';
      }
      if (p.source_url && /^https?:\/\//i.test(p.source_url)) {
        links += '<a class="pp-link" href="' + escapeAttr(p.source_url) +
          '" target="_blank" rel="noopener noreferrer">Project update ↗</a>';
      }
      const details = [];
      if (p.project_area) details.push('<div class="pp-detail"><strong>Sites:</strong> ' + escapeHtml(p.project_area) + '</div>');
      if (Array.isArray(p.actions) && p.actions.length) {
        details.push('<div class="pp-detail"><strong>Work:</strong><ul>' +
          p.actions.map(function (action) { return '<li>' + escapeHtml(action) + '</li>'; }).join('') +
          '</ul></div>');
      }
      html += '<li class="pp-item">' +
                '<div class="pp-item-head">' +
                  '<span class="pp-item-name">' + escapeHtml(p.name || 'Untitled project') + '</span>' +
                  org +
                '</div>' +
                (p.description ? '<p class="pp-description">' + escapeHtml(p.description) + '</p>' : '') +
                (details.length ? '<details class="pp-more"><summary>Project details</summary>' + details.join('') + '</details>' : '') +
                (links ? '<div class="pp-links">' + links + '</div>' : '') +
              '</li>';
    });
    html += '</ul>';
  }

  projBody.innerHTML = html;
  taxPanel.hidden = true;
  projPanel.hidden = false;

  markActiveCard(s);
  revealPanel(projPanel);
}


// On phones the list and the open panel sit side by side (see .has-panel in
// style.css), so the panel stays next to the card instead of jumping to the bottom.
const layoutEl = document.querySelector('.species-layout');
const PHONE_QUERY = window.matchMedia('(max-width: 999px)');
function syncLayoutPanelState() {
  if (!layoutEl) return;
  layoutEl.classList.toggle('has-panel', !taxPanel.hidden || !projPanel.hidden);
}
function revealPanel(panel) {
  syncLayoutPanelState();
  panel.scrollTop = 0;
  // Reset any offset from a previous selection
  taxPanel.style.marginTop = '';
  projPanel.style.marginTop = '';

  if (!PHONE_QUERY.matches) return;   // desktop: fixed side panel, nothing to do

  // Line the panel up with the selected card (cards re-flow narrower once the
  // panel column appears, so measure after the layout change).
  const card = listEl.querySelector('.species-card.active');
  if (!card || !layoutEl) return;
  requestAnimationFrame(function () {
    const layoutTop = layoutEl.getBoundingClientRect().top;
    const cardTop = card.getBoundingClientRect().top - layoutTop;
    // Don't let the panel hang past the end of the list
    const maxTop = Math.max(0, listEl.offsetHeight - panel.offsetHeight);
    panel.style.marginTop = Math.min(cardTop, maxTop) + 'px';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}


// ============================================================
// K. CARD ACTIVE HIGHLIGHT — mark the card whose panel is open
// ============================================================
function markActiveCard(s) {
  listEl.querySelectorAll('.species-card').forEach(function (c) {
    c.classList.remove('active');
    const h = c.querySelector('.species-name');
    if (h && h.textContent === s.common) c.classList.add('active');
  });
}


// ============================================================
// L. PANEL CLOSE BUTTONS — taxonomy + projects
// ============================================================
if (taxClose) {
  taxClose.addEventListener('click', function () {
    taxPanel.hidden = true;
    taxPanel.style.marginTop = '';
    syncLayoutPanelState();
    listEl.querySelectorAll('.species-card').forEach(function (c) {
      c.classList.remove('active');
    });
  });
}

if (projClose) {
  projClose.addEventListener('click', function () {
    projPanel.hidden = true;
    projPanel.style.marginTop = '';
    syncLayoutPanelState();
    listEl.querySelectorAll('.species-card').forEach(function (c) {
      c.classList.remove('active');
    });
  });
}


// ============================================================
// M. FILTER UI POPOVERS — open/close behaviour for the filter bar
// ============================================================
function closeAllPopovers() {
  document.querySelectorAll('.fp-panel').forEach(function (p) { p.hidden = true; });
  document.querySelectorAll('.fp-btn').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  hideSearchSuggest();
}

document.querySelectorAll('.fp').forEach(function (wrap) {
  const btn   = wrap.querySelector('.fp-btn');
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
// N. POPOVER CHECKBOXES — tier / presence / rank
// ============================================================
function bindPopoverChecks(selector, setRef, syncFn, updateFn) {
  document.querySelectorAll(selector).forEach(function (cb) {
    cb.addEventListener('change', function () {
      const v = cb.getAttribute('data-value');
      if (cb.checked) setRef.add(v);
      else setRef.delete(v);
      if (syncFn) syncFn();
      if (updateFn) updateFn();
      render();
    });
  });
}

// ---- N1. Tier filter ----
bindPopoverChecks(
  '#cf-tier-list input[data-value]',
  catFilters.tier,
  function () {
    const all = document.getElementById('cf-tier-all');
    const boxes = document.querySelectorAll('#cf-tier-list input[data-value]');
    const checked = Array.from(boxes).filter(function (b) { return b.checked; }).length;
    if (all) all.checked = boxes.length > 0 && checked === boxes.length;
  },
  updateCatSummaries
);

const tierAll = document.getElementById('cf-tier-all');
if (tierAll) tierAll.addEventListener('change', function (e) {
  const on = e.target.checked;
  catFilters.tier.clear();
  document.querySelectorAll('#cf-tier-list input[data-value]').forEach(function (cb) {
    cb.checked = on;
    if (on) catFilters.tier.add(cb.getAttribute('data-value'));
  });
  updateCatSummaries();
  render();
});

// ---- N2. Presence filter ----
bindPopoverChecks(
  '#cf-presence-list input[data-value]',
  catFilters.presence,
  function () {
    const all = document.getElementById('cf-presence-all');
    const boxes = document.querySelectorAll('#cf-presence-list input[data-value]');
    const checked = Array.from(boxes).filter(function (b) { return b.checked; }).length;
    if (all) all.checked = boxes.length > 0 && checked === boxes.length;
  },
  updateCatSummaries
);

const presenceAll = document.getElementById('cf-presence-all');
if (presenceAll) presenceAll.addEventListener('change', function (e) {
  const on = e.target.checked;
  catFilters.presence.clear();
  document.querySelectorAll('#cf-presence-list input[data-value]').forEach(function (cb) {
    cb.checked = on;
    if (on) catFilters.presence.add(cb.getAttribute('data-value'));
  });
  updateCatSummaries();
  render();
});

// ---- N3. Rank filter ----
bindPopoverChecks(
  '#cf-rank-list input[data-value]',
  catFilters.rank,
  function () {
    const all = document.getElementById('cf-rank-all');
    const boxes = document.querySelectorAll('#cf-rank-list input[data-value]');
    const checked = Array.from(boxes).filter(function (b) { return b.checked; }).length;
    if (all) all.checked = boxes.length > 0 && checked === boxes.length;
  },
  updateCatSummaries
);

const rankAll = document.getElementById('cf-rank-all');
if (rankAll) rankAll.addEventListener('change', function (e) {
  const on = e.target.checked;
  catFilters.rank.clear();
  document.querySelectorAll('#cf-rank-list input[data-value]').forEach(function (cb) {
    cb.checked = on;
    if (on) catFilters.rank.add(cb.getAttribute('data-value'));
  });
  updateCatSummaries();
  render();
});


// ============================================================
// O. SUMMARIES — "All" / "N selected" labels on the filter buttons
// ============================================================
function updateCatSummaries() {
  const tierSum = document.getElementById('cf-tier-summary');
  if (tierSum) {
    const n = catFilters.tier.size;
    tierSum.textContent = n === 0 ? 'All' : n + ' selected';
    tierSum.classList.toggle('is-set', n > 0);
  }
  const presSum = document.getElementById('cf-presence-summary');
  if (presSum) {
    const n = catFilters.presence.size;
    presSum.textContent = n === 0 ? 'All' : n + ' selected';
    presSum.classList.toggle('is-set', n > 0);
  }
  const rankSum = document.getElementById('cf-rank-summary');
  if (rankSum) {
    const n = catFilters.rank.size;
    rankSum.textContent = n === 0 ? 'All' : n + ' selected';
    rankSum.classList.toggle('is-set', n > 0);
  }
}


// ============================================================
// P. LIVE SEARCH SUGGESTIONS — keyboard + click
// ============================================================
const searchInput = document.getElementById('species-search');
const sortSelect = document.getElementById('species-sort');
const priorityFilter = document.getElementById('cf-priority');
const suggestBox  = document.getElementById('species-search-suggest');
let suggestIndex  = -1;
const requestedSpeciesName = new URLSearchParams(window.location.search).get('species');
// Map data can use trinomials without a rank ("Phragmites australis australis"),
// so fall back to matching on genus + species.
function binomial(name) {
  return normLatin(name).split(' ').slice(0, 2).join(' ');
}
const requestedSpecies = requestedSpeciesName && (
  SPECIES.find(function (species) {
    return normLatin(species.sci) === normLatin(requestedSpeciesName) ||
      normalizeSearchText(species.common) === normalizeSearchText(requestedSpeciesName);
  }) ||
  SPECIES.find(function (species) {
    return binomial(species.sci) === binomial(requestedSpeciesName);
  })
);
if (requestedSpecies) {
  catFilters.search = requestedSpecies.common;
  searchInput.value = requestedSpecies.common;
}

if (sortSelect) {
  sortSelect.addEventListener('change', function () {
    catFilters.sort = sortSelect.value;
    render();
  });
}

if (priorityFilter) {
  priorityFilter.addEventListener('change', function () {
    catFilters.priorityOnly = priorityFilter.checked;
    render();
  });
}

function hideSearchSuggest() {
  if (suggestBox) suggestBox.hidden = true;
  suggestIndex = -1;
}

function showSearchSuggest(query) {
  if (!suggestBox) return;
  const q = normalizeSearchText(query).trim();
  if (!q) { hideSearchSuggest(); return; }

  const matches = SPECIES.filter(function (s) {
    return normalizeSearchText(s.common + ' ' + s.sci).indexOf(q) !== -1;
  }).slice(0, 8);

  if (!matches.length) {
    suggestBox.innerHTML = '<div class="ss-empty">No matches</div>';
    suggestBox.hidden = false;
    return;
  }

  suggestBox.innerHTML = matches.map(function (s, i) {
    const meta = TIER_META[s.tier];
    return '<button type="button" class="ss-item' + (i === suggestIndex ? ' active' : '') + '" ' +
             'data-idx="' + SPECIES.indexOf(s) + '">' +
             '<span class="ss-common">' + escapeHtml(s.common) + '</span>' +
             '<span class="ss-sci"><em>' + escapeHtml(s.sci) + '</em></span>' +
             '<span class="ss-tier ' + meta.className + '">' + meta.label + '</span>' +
           '</button>';
  }).join('');
  suggestBox.hidden = false;

  suggestBox.querySelectorAll('.ss-item').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const sp = SPECIES[idx];
      searchInput.value = sp.common;
      catFilters.search = sp.common;
      hideSearchSuggest();
      render();
    });
  });
}

if (searchInput) {
  searchInput.addEventListener('input', function (e) {
    catFilters.search = e.target.value;
    render();
    showSearchSuggest(e.target.value);
  });
  searchInput.addEventListener('focus', function () {
    if (searchInput.value.trim()) showSearchSuggest(searchInput.value);
  });
  searchInput.addEventListener('keydown', function (e) {
    if (suggestBox && !suggestBox.hidden) {
      const items = suggestBox.querySelectorAll('.ss-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        suggestIndex = Math.min(suggestIndex + 1, items.length - 1);
        items.forEach(function (it, i) { it.classList.toggle('active', i === suggestIndex); });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        suggestIndex = Math.max(suggestIndex - 1, 0);
        items.forEach(function (it, i) { it.classList.toggle('active', i === suggestIndex); });
        return;
      }
      if (e.key === 'Enter' && suggestIndex >= 0 && items[suggestIndex]) {
        e.preventDefault();
        items[suggestIndex].click();
        return;
      }
      if (e.key === 'Escape') {
        hideSearchSuggest();
        return;
      }
    }
  });
}

document.addEventListener('click', function (e) {
  if (suggestBox && !suggestBox.hidden) {
    if (!suggestBox.contains(e.target) && e.target !== searchInput) hideSearchSuggest();
  }
});


// ============================================================
// Q. RESET — the Reset button clears every catalog filter
// ============================================================
const resetBtn = document.getElementById('cf-reset');
if (resetBtn) resetBtn.addEventListener('click', function () {
  catFilters.search = '';
  catFilters.tier.clear();
  catFilters.presence.clear();
  catFilters.rank.clear();
  catFilters.priorityOnly = false;
  catFilters.sort = 'default';

  document.querySelectorAll('#cf-tier-list input[data-value], #cf-presence-list input[data-value], #cf-rank-list input[data-value]').forEach(function (cb) {
    cb.checked = false;
  });
  const tAll = document.getElementById('cf-tier-all');
  const pAll = document.getElementById('cf-presence-all');
  const rAll = document.getElementById('cf-rank-all');
  if (tAll) tAll.checked = false;
  if (pAll) pAll.checked = false;
  if (rAll) rAll.checked = false;

  if (searchInput) searchInput.value = '';
  if (priorityFilter) priorityFilter.checked = false;
  if (sortSelect) sortSelect.value = 'default';
  hideSearchSuggest();

  updateCatSummaries();
  render();
});


// ============================================================
// R. INITIAL RENDER
// ============================================================
render();
updateCatSummaries();
if (requestedSpecies) {
  const speciesCard = Array.from(listEl.querySelectorAll('.species-card')).find(function (card) {
    const name = card.querySelector('.species-name');
    return name && name.textContent === requestedSpecies.common;
  });
  if (speciesCard) {
    speciesCard.classList.add('active');
    speciesCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ============================================================
// S. LIGHTBOX — click a species photo → full-size image
//    (same look as the map's popup lightbox; styles in style.css)
// ============================================================
function openPhotoLightbox(img) {
  const full = img.getAttribute('data-full');
  if (!full) return;
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML =
    '<div class="lightbox-content"><img src="' + escapeAttr(full) + '" alt="">' +
    '<button class="lightbox-close" type="button" aria-label="Close">×</button>' +
    '<div class="lightbox-caption"></div></div>';
  const captionEl = overlay.querySelector('.lightbox-caption');
  captionEl.textContent = img.getAttribute('data-caption') || '';
  const licenseLabel = img.getAttribute('data-license');
  if (licenseLabel) {
    captionEl.appendChild(document.createTextNode(' · '));
    const licenseUrl = img.getAttribute('data-license-url');
    const el = document.createElement(licenseUrl ? 'a' : 'span');
    el.textContent = licenseLabel;
    if (licenseUrl) {
      el.href = licenseUrl;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
    captionEl.appendChild(el);
  }
  const returnFocus = document.activeElement;
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }
  function onKey(ev) { if (ev.key === 'Escape') close(); }
  overlay.addEventListener('click', function (ev) {
    if (ev.target === overlay || ev.target.classList.contains('lightbox-close')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  overlay.querySelector('.lightbox-close').focus();
}

document.addEventListener('click', function (e) {
  const img = e.target.closest('.species-photo-zoom');
  if (img) openPhotoLightbox(img);
});
document.addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList &&
      e.target.classList.contains('species-photo-zoom')) {
    e.preventDefault();
    openPhotoLightbox(e.target);
  }
});
