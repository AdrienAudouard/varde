#!/usr/bin/env node
/**
 * transform-pois.mjs
 * -----------------------------------------------------------------------------
 * Transform an Overpass / OpenStreetMap GeoJSON export into NDJSON documents
 * ready to import into MongoDB.
 *
 * The output model is GENERIC: the same shape holds for any point of interest
 * (water, refuge, supermarket, ...). The POI type is resolved from OSM tags via
 * the config-driven CATEGORY_RULES below, and only a curated set of "important"
 * properties is kept (promoted to clean, typed top-level fields). The original
 * `feature.geometry` (a GeoJSON Point in [lng, lat]) is passed straight through
 * to `location`, so MongoDB can build a 2dsphere index for geo queries.
 *
 * Usage:
 *   nvm use 22                                  # repo's default node is v14
 *   node scripts/transform-pois.mjs [input] [output]
 *
 * Defaults: data/water_points.geojson -> data/water_points.ndjson
 *
 * Import into MongoDB (keep --mode upsert: `_id` is the OSM id, so re-imports are
 * idempotent; plain insert mode would error on any repeated node id):
 *   mongoimport --uri "mongodb://localhost:27017/varde" \
 *     --collection pois --file data/water_points.ndjson --mode upsert
 *
 * Then, in mongosh:
 *   db.pois.createIndex({ location: "2dsphere" });    // required for geo queries
 *   db.pois.createIndex({ category: 1, subtype: 1 });
 * -----------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Category resolver: ordered list, FIRST MATCHING RULE WINS.
 *
 * A rule matches when every key in `match` is present on the feature with one
 * of the accepted values (string or array of strings). `subtype` is the rule's
 * explicit subtype, or — when omitted — the matched tag value itself.
 *
 * Order encodes precedence: a node tagged both `natural=spring` and
 * `amenity=drinking_water` resolves to water/drinking_water because the amenity
 * rule is listed first.
 */
const CATEGORY_RULES = [
  { match: { amenity: "drinking_water" }, category: "water", subtype: "drinking_water" },
  { match: { man_made: ["water_tap", "drinking_fountain", "water_well", "water_point"] }, category: "water" },
  { match: { natural: ["spring", "hot_spring"] }, category: "water" },

  // --- Ready for future exports (not exercised by water_points.geojson). ---
  // { match: { tourism: ["alpine_hut", "wilderness_hut"] }, category: "refuge" },
  // { match: { amenity: "shelter" }, category: "refuge", subtype: "shelter" },
  // { match: { shop: ["supermarket", "convenience"] }, category: "supermarket" },
];

/**
 * Universal curated fields — kept for every category.
 * Maps the output field name -> source OSM tag(s). When an array is given, the
 * first present tag wins. Values are kept as their original strings (OSM yes/no
 * tags are multi-valued, so we do NOT coerce them to booleans).
 */
const UNIVERSAL_FIELDS = {
  name: "name",
  operator: "operator",
  openingHours: "opening_hours",
  website: ["website", "contact:website"],
  phone: ["phone", "contact:phone"],
  access: "access",
  fee: "fee",
  wheelchair: "wheelchair",
  description: "description",
  checkDate: "check_date",
};

/**
 * Per-category extra fields, keyed by resolved category. Adding a new POI type
 * = add a CATEGORY_RULES entry and (optionally) a field map here.
 */
const CATEGORY_FIELDS = {
  water: {
    drinkingWater: "drinking_water",
    fountain: "fountain",
    bottle: "bottle",
    covered: "covered",
    indoor: "indoor",
    seasonal: "seasonal",
    natural: "natural",
    manMade: "man_made",
  },
  refuge: {
    capacity: "capacity",
    beds: "beds",
    reservation: "reservation",
  },
  supermarket: {
    brand: "brand",
    brandWikidata: "brand:wikidata",
  },
};

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

/** Pick the first present, non-empty value among one or more OSM tag keys. */
function pick(props, source) {
  const keys = Array.isArray(source) ? source : [source];
  for (const key of keys) {
    const value = props[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return undefined;
}

/** Copy each mapped field onto `doc` when its source tag exists. */
function applyFields(doc, props, fieldMap) {
  for (const [field, source] of Object.entries(fieldMap)) {
    const value = pick(props, source);
    if (value !== undefined) doc[field] = value;
  }
}

/** Resolve { category, subtype } from OSM tags, or null when nothing matches. */
function resolveCategory(props) {
  for (const rule of CATEGORY_RULES) {
    let matched = true;
    let matchedValue;
    for (const [key, expected] of Object.entries(rule.match)) {
      const value = props[key];
      const accepted = Array.isArray(expected) ? expected : [expected];
      if (value === undefined || !accepted.includes(value)) {
        matched = false;
        break;
      }
      matchedValue = value;
    }
    if (matched) return { category: rule.category, subtype: rule.subtype ?? matchedValue };
  }
  return null;
}

/** Build a MongoDB document from a GeoJSON feature, or null when it's skipped. */
function transformFeature(feature) {
  const props = feature.properties ?? {};

  const resolved = resolveCategory(props);
  if (!resolved) return { doc: null, reason: "no-category" };

  const osmId = feature.id ?? props["@id"];
  if (!osmId || typeof osmId !== "string") return { doc: null, reason: "no-id" };

  const geometry = feature.geometry;
  if (!geometry || !Array.isArray(geometry.coordinates)) return { doc: null, reason: "no-geometry" };

  const doc = {
    _id: osmId,
    osmType: osmId.split("/")[0],
    category: resolved.category,
    subtype: resolved.subtype,
    location: geometry, // already a valid GeoJSON Point in [lng, lat]
    source: "openstreetmap",
  };

  applyFields(doc, props, UNIVERSAL_FIELDS);
  const categoryFields = CATEGORY_FIELDS[resolved.category];
  if (categoryFields) applyFields(doc, props, categoryFields);

  return { doc, reason: null };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const input = process.argv[2] ?? "data/water_points.geojson";
  const output = process.argv[3] ?? "data/water_points.ndjson";

  const raw = readFileSync(input, "utf8");
  const collection = JSON.parse(raw);
  const features = Array.isArray(collection.features) ? collection.features : [];

  const lines = [];
  const skipped = { "no-category": 0, "no-id": 0, "no-geometry": 0 };

  for (const feature of features) {
    const { doc, reason } = transformFeature(feature);
    if (doc) {
      lines.push(JSON.stringify(doc));
    } else {
      skipped[reason] += 1;
    }
  }

  writeFileSync(output, lines.length ? lines.join("\n") + "\n" : "");

  const totalSkipped = skipped["no-category"] + skipped["no-id"] + skipped["no-geometry"];
  console.log(`Input:   ${input}`);
  console.log(`Output:  ${output}`);
  console.log(`Features: ${features.length}`);
  console.log(`Written:  ${lines.length}`);
  console.log(
    `Skipped:  ${totalSkipped}` +
      ` (no category: ${skipped["no-category"]},` +
      ` no id: ${skipped["no-id"]},` +
      ` no geometry: ${skipped["no-geometry"]})`,
  );
}

main();
