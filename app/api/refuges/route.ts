// GET /api/refuges?w=&s=&e=&n=&categories=
//
// Returns Refuge[] within the given bbox, proxied from the refuges.info public
// API (https://www.refuges.info/api/doc/). Unlike /api/water-points (MongoDB),
// this is third-party data: we proxy server-side to dodge CORS, transform the
// GeoJSON into the app's flat Refuge[] shape, and let Next's data cache hold the
// upstream response (revalidate) so panning doesn't hammer a free API. The route
// is dynamic by virtue of reading the query string.

import { RefugeKind, type Refuge } from "@/lib/varde/refuges";

// refuges.info point type ids we surface as "refuges": 7 = cabane non gardée,
// 9 = gîte d'étape, 10 = refuge gardé. Their water (6), lakes, summits, etc. are
// deliberately excluded — water has its own curated, MongoDB-backed layer.
const TYPE_POINTS = "7,9,10";

// Generous per-request cap. Refuges are sparse so a viewport returns far fewer;
// passed explicitly because the API otherwise defaults to 250.
const NB_POINTS = 1000;

// Cache the upstream response for an hour: refuge data changes slowly and a
// given bbox recurs as the user pans back and forth.
const REVALIDATE_S = 3600;

function finiteNum(v: string | null): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// refuges.info `type.id` → our RefugeKind.
function classifyKind(typeId: unknown): RefugeKind {
  switch (typeId) {
    case 10:
      return RefugeKind.Guarded;
    case 7:
      return RefugeKind.Unguarded;
    case 9:
      return RefugeKind.Gite;
    default:
      return RefugeKind.Other;
  }
}

// A refuge "has water" if it's a staffed refuge (always has water) or its icon
// encodes water: refuges.info bakes amenities into the icon name, so a cabin
// with a spring/tap reads e.g. "cabane_eau", "cabane_feu_eau", "cabane_red_eau".
function deriveHasWater(typeId: unknown, icone: unknown): boolean {
  if (typeId === 10) return true;
  return typeof icone === "string" && icone.includes("eau");
}

// Minimal shape of a refuges.info GeoJSON feature at detail=simple. Fields are
// optional/unknown because it's third-party data, validated as we read it.
type RefugeFeature = {
  id?: number;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    nom?: string;
    id?: number;
    type?: { id?: number; valeur?: string; icone?: string };
    coord?: { alt?: number };
    places?: { valeur?: number };
    etat?: { valeur?: string };
    lien?: string;
  };
};

function toRefuge(f: RefugeFeature): Refuge | null {
  const coords = f.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const props = f.properties ?? {};
  const id = f.id ?? props.id;
  if (typeof id !== "number") return null;

  const beds = props.places?.valeur;
  const status = props.etat?.valeur?.trim();
  return {
    id,
    kind: classifyKind(props.type?.id),
    lng,
    lat,
    name: props.nom || undefined,
    alt: typeof props.coord?.alt === "number" ? props.coord.alt : undefined,
    beds: typeof beds === "number" && beds > 0 ? beds : undefined,
    hasWater: deriveHasWater(props.type?.id, props.type?.icone),
    status: status ? status : undefined,
    link: props.lien || undefined,
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

  // Mirror the water route's category contract: absent → refuge; present but
  // without "refuge" → nothing to return (lets the client gate by category).
  const catParam = searchParams.get("categories");
  if (catParam !== null) {
    const cats = catParam.split(",").map((c) => c.trim()).filter(Boolean);
    if (!cats.includes("refuge")) return Response.json([]);
  }

  // refuges.info bbox order is W,S,E,N — same as ours.
  const upstream =
    `https://www.refuges.info/api/bbox?bbox=${west},${south},${east},${north}` +
    `&type_points=${TYPE_POINTS}&detail=simple&format=geojson&nb_points=${NB_POINTS}`;

  try {
    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_S },
    });
    if (!res.ok) {
      console.error(`[api/refuges] upstream ${res.status} for ${upstream}`);
      return Response.json({ error: "Upstream refuges.info request failed" }, { status: 502 });
    }

    const data = (await res.json()) as { features?: RefugeFeature[] };
    const features = data.features ?? [];
    if (features.length >= NB_POINTS) {
      console.warn(
        `[api/refuges] result hit nb_points=${NB_POINTS} for bbox ` +
          `[${west}, ${south}, ${east}, ${north}] — some refuges may be omitted`,
      );
    }

    const refuges = features.map(toRefuge).filter((r): r is Refuge => r !== null);
    return Response.json(refuges);
  } catch (err) {
    console.error("[api/refuges] fetch failed", err);
    return Response.json({ error: "Refuges request failed" }, { status: 502 });
  }
}
