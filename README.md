# Invasive-Plant-Species-in-Montreal
Mapping invasive plant species observations in Montreal boroughs and cities using risk tiers according to Ministère de l'Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs (Québec).

# Invasive species observations — Montréal

## The five sentences
1. This project maps research-grade iNaturalist observations of invasive
   plant species in Montréal, classified by the risk tier assigned by
   Québec's Ministère de l'Environnement.
2. It is for nature enthusiasts, students, and researchers who are interested in Montreal's invasive fauna
   and want to know what is growing there and how serious it is.
3. On this map you can filter observations by risk tier, species, borough,
   year, Québec presence, Québec priority status, location precision, and
   photo availability, and click a borough to see which species were recorded there.
4. The data comes from iNaturalist, the Québec
   invasive-species list (REFEE), the Sentinelle dataset (CC-BY 4.0), and
   Ville de Montréal administrative boundaries.
5. iNaturalist observations and photo-license metadata are scheduled for
   daily refresh; other reference datasets are updated manually.

## Core action
"Nature enthusiasts, students, and researchers in Montréal can filter iNaturalist observations by
risk tier and borough to see which invasive species are recorded where."

## Data sources and licences
- iNaturalist observations — iNaturalist / user — observation license shown per record — Accessed October 19, 2026
  https://www.inaturalist.org/
  Photo licenses are looked up separately through the iNaturalist API; photos
  are shown only when their own license permits reuse and required attribution is available.
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
3. Run `notebooks/ChecksPassed.ipynb` top-to-bottom to regenerate
   `data/places.geojson`; observations outside the Montréal borough/city
   boundaries are excluded, and the final check cell verifies the result.
   To refresh from iNaturalist first, run `python scripts/update_observations.py`,
   then run `python scripts/run_data_pipeline.py`. Both commands need internet
   access; the full refresh may take a few minutes.
   The map excludes observations whose observation license is blank or
   All Rights Reserved; the source GeoJSON and CSV remain unchanged by that
   display filter.
4. GitHub Actions is configured to refresh and publish changed map data daily
   at 06:17 UTC. It can also be started manually from the repository's Actions tab.
   The workflow becomes active after these changes are committed and pushed to GitHub.

## Adding projects to the map
- Add each project as a GeoJSON `Feature` in `data/projects.geojson`.
- Store point coordinates in GeoJSON order: `[longitude, latitude]`.
- Use the `Projects` checkbox to show or hide all project points.
- Include the organization and project area. Use `project_url` for the
  original project details and `source_url` for a later project update or
  additional information.
  The marker location can represent the organization rather than the project
  site, so explain that distinction in `marker_location`.
- Add related species in the `species` array using their catalog common and
  scientific names. The species catalog uses those scientific names to list
  associated projects, which can be opened in its projects panel.
- If the source does not identify the species, leave `species` empty and add
  a concise `species_note` describing what is known, such as "Buckthorn
  species not identified."
- If a source names a park but not an exact work site, place a representative
  point inside that park and explain the approximation in `marker_location`
  from the reader's perspective (for example, "Approximate point within [park];
  exact treatment area is not mapped"), rather than narrating what the source
  does not show.
- If one initiative covers multiple mapped sites, use a separate feature for
  each site and explain which project details apply across the initiative
  rather than to an individual site.
- Projects at different points within a shared park or island can use the same
  optional `cluster_group` value to cluster together without changing their
  individual project areas or popup details.
- Borough and city project totals are based on each project's mapped point
  falling inside the selected boundary.

## Not in this iteration
- Green spaces (parks, cemeteries, golf courses) are not a separate
  layer — they would clutter the map at this zoom.
- Selected municipal invasive-plant projects are mapped as project points;
  park-level points are approximate when the source does not provide exact
  intervention coordinates.


## AI Disclusore
AI Disclosure
Lane: Guided (Green), I pasted each piece into my own files and ran it myself.

Tools and models: DeepSeek (deepseek-chat / V3) in the free web chat window for the bulk of the pipeline and map code. GitHub Copilot in VS Code for small corrections and fixes along the way.

What I delegated: I used DeepSeek one piece at a time to build the CSV→GeoJSON pipeline in build_geojson.py — the row loop, the clean/to_float/to_bool helpers, the risk-tier lookup and the licence filter — and the Leaflet map logic in app.js: the filter state, passesFilters, the popup HTML, and the borough click/highlight handlers. I also asked it for the species catalog logic in species.js. I used Copilot in VS Code for smaller corrections — fixing a path, adjusting a CSS value, tidying a function after I'd run it. Each time I copied the code into VS Code, ran it through Live Server, and checked the console before moving on.

What came back, and what I changed or rejected: The first pipeline left 33 rows as "unknown". I wrote a diagnostic script, saw the missing subspecies taxon IDs (5903, 1611981, 487107, 707386, 462124), and added them myself until unknown = 0. I changed the licence logic so every observation is kept but ND/SA/blank photos are dropped, that decision was mine. The one I remember most: every time I clicked a city or borough, a black border appeared. I kept rejecting DeepSeek's attempts to remove it, because none of them were what I wanted, and I tried to remove it myself. I didn't succeed. I went back to DeepSeek a while later with a clearer description of the problem, and that attempt worked.

How I tested it: The notebook's final check cell asserts that the feature count equals the cleaned row count, every geometry falls inside the Montréal bounding box, required properties are populated, and the risk tiers sum to the total in which all four pass. I also ran the classification diagnostic until unknown = 0, and clicked through the map after each change.

What stayed human: The risk tiers and TAXON_INFO, the licence policy, the story text, the colors, the "About this map" section.

What I don't yet understand: Clicking a borough works, it outlines and the side panel fills in with the right counts. But I don't fully understand how that click reaches renderSelectionPanel without the map's own click handler also firing and closing the panel. I know L.DomEvent.stopPropagation(e) is involved, because I hit the bug where the panel opened and immediately closed, and adding it fixed it. I just couldn't explain the event order from memory.

After the demo (LAB 5):
 - What is this map about? "This map is about invasive plant species in Montreal and their levels of risk"
 - What do the darkest (or the different) colours mean? "The different colors display levels of risk for species, the darkest colors are the most high risk"

 ## A3 card and three tests, before any code
## A3 feature: Invasive plant species related projects
For A3 I will add projects as points that would describe various projects ways cities or organizations are working with the invasive plants, so that my reader can learn more about what is happening in the city in terms of invasive plant species prevention/control/etc.
It has depth because it (computes / responds / brings in) provides another angle, rather than just showing all the invasive species, it would show what is currently or has been done about it.
I will know it works when i have a point and a pop up of atleast one project.
My edge case is when a project source discusses invasive plants but does not name a specific species. The project should still appear on the map, while its pop-up explains that no species was specified and it is not assigned to a species catalog entry.


Test 1. I click a project point on the map.. PASSED
 Expected: A pop-up appears with the project or organization name, a short description, and a link to the source article.
Test 2. I select a borough or city from the map filter. PASSED
 Expected: The observation panel shows the number of project points located inside the selected boundary.
Test 3. I click a project point whose source does not identify a specific invasive species. PASSED
 Expected: Its pop-up says the source does not identify a specific species, and the project is not listed under a species in the catalog. 
