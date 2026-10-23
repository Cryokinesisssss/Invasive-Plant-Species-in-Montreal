# Invasive species observations — Montréal

## The five sentences
1. This project maps research-grade iNaturalist observations of invasive
   plant species in Montréal, classified by the risk tier assigned by
   Québec's Ministère de l'Environnement.
2. It is for nature enthusiasts, students, and researchers who are interested in Montreal's invasive fauna
   and want to know what is growing there and how serious it is.
3. On this map you can filter observations by risk tier, species, borough,
   and year, and click a borough to see which species were recorded there.
4. The data comes from iNaturalist (CC0 / CC-BY / CC-BY-NC), the Québec
   invasive-species list (REFEE), the Sentinelle dataset (CC-BY 4.0), and
   Ville de Montréal administrative boundaries.
5. A snapshot from October 2026; updated periodically.

## Core action
"Nature enthusiasts, students, and researchers in Montréal can filter iNaturalist observations by
risk tier and borough to see which invasive species are recorded where."

## Data sources and licences
- iNaturalist observations — iNaturalist / user  — CC0 / CC-BY / CC-BY-NC per observation — Accessed October 19, 2026
  https://www.inaturalist.org/
- Liste des espèces exotiques envahissantes (MELCCFP) —
https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/gestion-faune-habitats-fauniques/gestion-especes-exotiques-envahissantes-animales/liste-especes#note3
- Sentinelle — Espèces exotiques envahissantes — MINISTÈRE DE L’ENVIRONNEMENT, DE LA LUTTE CONTRE LES CHANGEMENTS CLIMATIQUES, DE LA FAUNE ET DES PARCS — CC-BY 4.0 — Accessed October 20, 2026
https://www.donneesquebec.ca/recherche/dataset/especes-exotiques-envahissantes
      - LAB 5: The Sentinelle records were reprojected from EPSG:32198 to WGS 84 (EPSG:4326), filtered to Montréal’s administrative region, and matched to the project’s invasive-species list to assign high, moderate, or low risk classifications. 
         - Red = High risk; Orange = Moderate risk; Yellow = Low risk; Grey = Unclassified
- Limites administratives de l'agglomération de Montréal — CC-BY 4.0 —
  https://www.app.geo.ca/en-ca/map-browser/record/9797a946-9da8-41ec-8815-f6b276dec7e9

## How to run
1. Open the project folder in VS Code.
2. Right-click `site/index.html`, Open with Live Server
   (**rooted at the project folder**, so `../data/` resolves).
3. Run `notebooks/build_places.ipynb` top-to-bottom to regenerate
   `data/places.geojson`; the final check cell must print four ✓.

## Not in this iteration
- Green spaces (parks, cemeteries, golf courses) are not a separate
  layer — they would clutter the map at this zoom.
- Local anti-invasive projects are planned for a later version; they
  need their own source, cleaning, and licence review.


## AI Disclusore
AI Disclosure
Lane: Guided (Green), I pasted each piece into my own files and ran it myself.

Tools and models: DeepSeek (deepseek-chat / V3) in the free web chat window for the bulk of the pipeline and map code. GitHub Copilot in VS Code for small corrections and fixes along the way.

What I delegated: I used DeepSeek one piece at a time to build the CSV→GeoJSON pipeline in build_geojson.py — the row loop, the clean/to_float/to_bool helpers, the risk-tier lookup and the licence filter — and the Leaflet map logic in app.js: the filter state, passesFilters, the popup HTML, and the borough click/highlight handlers. I also asked it for the species catalog logic in species.js. I used Copilot in VS Code for smaller corrections — fixing a path, adjusting a CSS value, tidying a function after I'd run it. Each time I copied the code into VS Code, ran it through Live Server, and checked the console before moving on.

What came back, and what I changed or rejected: The first pipeline left 33 rows as "unknown". I wrote a diagnostic script, saw the missing subspecies taxon IDs (5903, 1611981, 487107, 707386, 462124), and added them myself until unknown = 0. I changed the licence logic so every observation is kept but ND/SA/blank photos are dropped, that decision was mine. The one I remember most: every time I clicked a city or borough, a black border appeared. I kept rejecting DeepSeek's attempts to remove it, because none of them were what I wanted, and I tried to remove it myself. I didn't succeed. I went back to DeepSeek a while later with a clearer description of the problem, and that attempt worked.

How I tested it: The notebook's final check cell asserts that the feature count equals the cleaned row count, every geometry falls inside the Montréal bounding box, required properties are populated, and the risk tiers sum to the total in which all four pass. I also ran the classification diagnostic until unknown = 0, and clicked through the map after each change.

What stayed human: The risk tiers and TAXON_INFO, the licence policy, the story text, the colors, the "About this map" section.

What I don't yet understand: Clicking a borough works, it outlines and the side panel fills in with the right counts. But I don't fully understand how that click reaches renderSelectionPanel without the map's own click handler also firing and closing the panel. I know L.DomEvent.stopPropagation(e) is involved, because I hit the bug where the panel opened and immediately closed, and adding it fixed it. I just couldn't explain the event order from memory.