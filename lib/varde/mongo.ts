// Server-only MongoDB access for points of interest.
//
// Imported only by the /api/water-points route handler — it reads server-side
// env vars and must never reach the client bundle. (`server-only` isn't a
// dependency here, so this is enforced by convention: keep imports server-side.)
//
// We cache the connect() PROMISE (not just the client) on globalThis so that
// concurrent requests and Next's dev hot-reload share a single connection pool
// instead of each opening their own.

import { MongoClient, type Collection } from "mongodb";

// NB: the env var is spelled with a zero ("MONG0"), matching the project's .env.
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGO_DATABASE;

/** Curated POI document — matches the output of scripts/transform-pois.mjs. */
export type PointOfInterestDoc = {
  _id: string; // "node/<id>"
  osmType: string;
  category: string;
  subtype: string;
  location: { type: "Point"; coordinates: [number, number] };
  source?: string;
  name?: string;
  operator?: string;
  openingHours?: string;
  website?: string;
  phone?: string;
  access?: string;
  fee?: string;
  wheelchair?: string;
  description?: string;
  checkDate?: string;
  drinkingWater?: string;
  fountain?: string;
  bottle?: string;
  covered?: string;
  indoor?: string;
  seasonal?: string;
  natural?: string;
  manMade?: string;
};

const globalForMongo = globalThis as unknown as {
  __vardePoiClient?: Promise<MongoClient>;
};

function clientPromise(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!globalForMongo.__vardePoiClient) {
    globalForMongo.__vardePoiClient = new MongoClient(uri).connect();
  }
  return globalForMongo.__vardePoiClient;
}

/**
 * The `points_of_interest` collection, typed. Geo queries rely on a 2dsphere
 * index on `location` (already present in the `varde` database).
 */
export async function getPoiCollection(): Promise<
  Collection<PointOfInterestDoc>
> {
  if (!dbName) throw new Error("MONGO_DATABASE is not set");
  const client = await clientPromise();
  return client.db(dbName).collection<PointOfInterestDoc>("points_of_interest");
}
