// GET /api/water-points?w=&s=&e=&n=
//
// Returns WaterPoint[] within the given bbox, queried from MongoDB with a
// GeoJSON `$geoWithin` Polygon (served by the `location` 2dsphere index). Note:
// "GeoJSON request" refers to the *query geometry* — the response is the app's
// flat WaterPoint[], from which the map builds its own GeoJSON features.

import { getPoiCollection, type PointOfInterestDoc } from "@/lib/varde/mongo";
import { WaterPointKind, type WaterPoint } from "@/lib/varde/water-points";

// The mongodb driver requires the Node.js runtime (not edge). The handler is
// request-time dynamic: it reads the query string and hits the database.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generous safety cap. A trail bbox returns far fewer, but a pathological bbox
// could match a lot; we over-fetch by one to detect and log truncation rather
// than silently drop points from the plan.
const MAX_RESULTS = 5000;

function finiteNum(v: string | null): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// OSM `subtype` values (the `subtype` field of the curated POI docs) that this
// route knows how to classify. Named members keep `classifyKind` free of magic
// strings on both the input and output side.
enum WaterSubtype {
  DrinkingWater = "drinking_water",
  DrinkingFountain = "drinking_fountain",
  WaterPoint = "water_point",
  WaterTap = "water_tap",
  Tap = "tap",
  Spring = "spring",
  HotSpring = "hot_spring",
}

// Classify a water doc into a WaterPointKind. Every doc in this dataset carries
// amenity=drinking_water as its `subtype`; the secondary OSM descriptors the
// transform preserved (natural / man_made / fountain) are what actually
// distinguish the kinds. Precedence: spring (reliability-relevant) > tap >
// fountain > the generic drinking_water. Match values come from WaterSubtype,
// not bare literals.
function classifyKind(doc: PointOfInterestDoc): WaterPointKind {
  if (doc.natural === WaterSubtype.Spring || doc.natural === WaterSubtype.HotSpring) {
    return WaterPointKind.Spring;
  }
  if (doc.manMade === WaterSubtype.WaterTap || doc.manMade === WaterSubtype.Tap) {
    return WaterPointKind.Tap;
  }
  if (doc.fountain !== undefined || doc.manMade === WaterSubtype.DrinkingFountain) {
    return WaterPointKind.Fountain;
  }
  if (doc.subtype === WaterSubtype.WaterPoint) {
    return WaterPointKind.WaterPoint;
  }
  return WaterPointKind.DrinkingWater;
}

function boolTag(v: string | undefined): boolean | undefined {
  if (v === "yes") return true;
  if (v === "no") return false;
  return undefined;
}

function toWaterPoint(doc: PointOfInterestDoc): WaterPoint {
  const [lng, lat] = doc.location.coordinates;
  return {
    id: Number(doc._id.split("/")[1]), // "node/27122976" -> 27122976
    kind: classifyKind(doc),
    lng,
    lat,
    name: doc.name,
    operator: doc.operator,
    drinkable: boolTag(doc.drinkingWater),
    fee: boolTag(doc.fee),
    seasonal: doc.seasonal === "yes",
    openingHours: doc.openingHours,
  };
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const west = finiteNum(searchParams.get("w"));
  const south = finiteNum(searchParams.get("s"));
  const east = finiteNum(searchParams.get("e"));
  const north = finiteNum(searchParams.get("n"));

  if (west === null || south === null || east === null || north === null) {
    return Response.json(
      { error: "Missing or invalid bbox params (w, s, e, n)" },
      { status: 400 },
    );
  }
  if (
    west < -180 || east > 180 || south < -90 || north > 90 ||
    west >= east || south >= north
  ) {
    return Response.json({ error: "bbox out of range or inverted" }, { status: 400 });
  }

  // Which POI categories to return. Absent → "water" (back-compat for the plan's
  // route fetch). Empty after parsing → nothing selected, return [].
  const catParam = searchParams.get("categories");
  const categories =
    catParam === null
      ? ["water"]
      : catParam.split(",").map((c) => c.trim()).filter(Boolean);
  if (categories.length === 0) return Response.json([]);

  // GeoJSON Polygon ring (CCW exterior) from the bbox corners, closed.
  const ring: number[][] = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];

  try {
    const collection = await getPoiCollection();
    const docs = await collection
      .find({
        category: { $in: categories },
        location: { $geoWithin: { $geometry: { type: "Polygon", coordinates: [ring] } } },
      })
      .limit(MAX_RESULTS + 1)
      .toArray();

    if (docs.length > MAX_RESULTS) {
      docs.length = MAX_RESULTS;
      console.warn(
        `[api/water-points] result capped at ${MAX_RESULTS} for bbox ` +
          `[${west}, ${south}, ${east}, ${north}] — some points omitted`,
      );
    }

    return Response.json(docs.map(toWaterPoint));
  } catch (err) {
    console.error("[api/water-points] query failed", err);
    return Response.json({ error: "Database query failed" }, { status: 500 });
  }
}
