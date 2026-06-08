// DOM builders for the topo map's imperative MapLibre layer: POI marker glyphs,
// markers, and the OSM water-point popup. Kept out of the component so the JSX
// stays a single container div. `document` is only touched inside function
// bodies, so importing this module is SSR-safe.

import { type Poi, type PoiType } from "@/lib/varde/data";
import { KIND_LABEL, type WaterPoint } from "@/lib/varde/overpass";
import { POI_COLOR } from "@/components/varde/topo-map-style";

function poiGlyphSvg(type: PoiType): string {
  switch (type) {
    case "eau":
      return '<path d="M0,-6 C4,-1 4.5,2 0,6 C-4.5,2 -4,-1 0,-6 Z" fill="#fff"/>';
    case "source":
      return '<path d="M0,-6 C4,-1 4.5,2 0,6 C-4.5,2 -4,-1 0,-6 Z" fill="none" stroke="#fff" stroke-width="1.6"/>';
    case "ravito":
      return '<rect x="-4.5" y="-4.5" width="9" height="9" rx="1.5" fill="#fff"/>';
    case "refuge":
      return '<path d="M-5,4 L-5,-1 L0,-5 L5,-1 L5,4 Z" fill="#fff"/>';
  }
}

// Build popup DOM with textContent/href (no innerHTML) so untrusted OSM tag
// values can't smuggle script/HTML into the page.
export function buildOsmPopupContent(wp: WaterPoint): HTMLElement {
  const root = document.createElement("div");
  root.className = "osm-water-popup";

  const title = document.createElement("div");
  title.className = "osm-water-popup-title";
  title.textContent = wp.name ?? KIND_LABEL[wp.kind];
  root.appendChild(title);

  const sub = document.createElement("div");
  sub.className = "osm-water-popup-sub";
  sub.textContent = wp.name ? KIND_LABEL[wp.kind] : "OpenStreetMap";
  root.appendChild(sub);

  const rows: Array<readonly [string, string]> = [];
  if (wp.drinkable === true) rows.push(["Potable", "oui"]);
  if (wp.drinkable === false) rows.push(["Potable", "non"]);
  if (wp.seasonal) rows.push(["Saisonnier", "oui"]);
  if (wp.fee === true) rows.push(["Payant", "oui"]);
  if (wp.operator) rows.push(["Opérateur", wp.operator]);
  if (wp.openingHours) rows.push(["Horaires", wp.openingHours]);

  if (rows.length > 0) {
    const list = document.createElement("dl");
    list.className = "osm-water-popup-list";
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      list.appendChild(dt);
      list.appendChild(dd);
    }
    root.appendChild(list);
  }

  const link = document.createElement("a");
  link.className = "osm-water-popup-link";
  link.href = `https://www.openstreetmap.org/node/${wp.id}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Voir sur OpenStreetMap →";
  root.appendChild(link);

  return root;
}

export function makeMarkerElement(poi: Poi, onActivate: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "varde-poi-marker " + poi.type + (poi.fiable ? "" : " unreliable");
  el.setAttribute("aria-label", `${poi.name} — ${poi.type}`);

  const dot = document.createElement("span");
  dot.className = "varde-poi-dot";
  dot.style.backgroundColor = POI_COLOR[poi.type];
  dot.innerHTML = `<svg viewBox="-12 -12 24 24" width="100%" height="100%">${poiGlyphSvg(poi.type)}</svg>`;
  el.appendChild(dot);

  if (!poi.fiable) {
    const ring = document.createElement("span");
    ring.className = "varde-poi-ring";
    ring.style.borderColor = POI_COLOR[poi.type];
    el.appendChild(ring);
  }

  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onActivate();
  });
  return el;
}
