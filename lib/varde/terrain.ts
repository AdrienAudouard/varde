// Terrain analysis (domain layer, pure). Splits a route into consecutive
// uphill / downhill / flat sections with per-section stats. Sibling to
// `slope.ts`: no module state, takes the route explicitly, deterministic.

import { pointAtKm, segTime, statsBetween, type RoutePoint } from "@/lib/varde/data";

export type TerrainType = "up" | "down" | "flat";

export type TerrainSection = {
  idx: number;
  type: TerrainType;
  fromKm: number;
  toKm: number;
  dist: number;
  dplus: number;
  dminus: number;
  avgGrade: number;
  hours: number;
};

// Grade (%) above which a stretch reads as a real climb / descent rather than
// rolling terrain. Applied identically to per-step grades, post-merge net
// grade, and the finalized section type so they never disagree.
const GRADE_THRESH = 3;
// Resample stride (km): smooths GPS elevation jitter before classifying.
// Fine enough to resolve short climbs/descents (a coarse stride averages a
// bump and its following dip into one near-flat step).
const STEP_KM = 0.05;
// Minimum section length (km): shorter runs fold into a neighbour to avoid
// micro-fragmentation on noisy elevation. Kept small so a genuine short climb
// isn't swallowed into an adjacent descent (which would flatten both into one
// section by their cancelling net grade).
const MIN_DIST_KM = 0.2;

function classify(grade: number): TerrainType {
  if (grade > GRADE_THRESH) return "up";
  if (grade < -GRADE_THRESH) return "down";
  return "flat";
}

// Net grade (%) over a stretch from its start/end elevation and length.
function netGrade(startEle: number, endEle: number, distKm: number): number {
  const meters = distKm * 1000;
  return meters === 0 ? 0 : ((endEle - startEle) / meters) * 100;
}

type Run = {
  type: TerrainType;
  fromKm: number;
  toKm: number;
  startEle: number;
  endEle: number;
};

function runDist(run: Run): number {
  return run.toKm - run.fromKm;
}

// Recompute a run's class from its current net grade (used after folding a
// short run into it).
function reclassify(run: Run): void {
  run.type = classify(netGrade(run.startEle, run.endEle, runDist(run)));
}

export function buildTerrain(route: readonly RoutePoint[]): TerrainSection[] {
  if (route.length < 2) return [];
  const totalKm = route[route.length - 1].dist;

  // Resample at STEP_KM, always including the endpoint so the fractional tail
  // (and sub-STEP_KM routes) still produce at least two samples.
  const samples: { km: number; ele: number }[] = [];
  for (let k = 0; k < totalKm; k += STEP_KM) {
    samples.push({ km: k, ele: pointAtKm(route, k).ele });
  }
  samples.push({ km: totalKm, ele: pointAtKm(route, totalKm).ele });

  // Build runs of consecutive same-class samples.
  const runs: Run[] = [];
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    const type = classify(netGrade(prev.ele, cur.ele, cur.km - prev.km));
    const last = runs[runs.length - 1];
    if (last && last.type === type) {
      last.toKm = cur.km;
      last.endEle = cur.ele;
    } else {
      runs.push({ type, fromKm: prev.km, toKm: cur.km, startEle: prev.ele, endEle: cur.ele });
    }
  }

  // Fold runs shorter than MIN_DIST_KM into the previous run (the first run, if
  // short, folds into the next). Never fold away the only remaining run.
  let i = 0;
  while (runs.length > 1 && i < runs.length) {
    if (runDist(runs[i]) >= MIN_DIST_KM) {
      i++;
      continue;
    }
    if (i === 0) {
      const next = runs[1];
      next.fromKm = runs[0].fromKm;
      next.startEle = runs[0].startEle;
      runs.splice(0, 1);
      reclassify(next);
    } else {
      const prev = runs[i - 1];
      prev.toKm = runs[i].toKm;
      prev.endEle = runs[i].endEle;
      runs.splice(i, 1);
      reclassify(prev);
      i = i - 1;
    }
  }

  // Coalesce now-adjacent same-class runs.
  const merged: Run[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && last.type === run.type) {
      last.toKm = run.toKm;
      last.endEle = run.endEle;
    } else {
      merged.push({ ...run });
    }
  }

  return merged.map((run, idx) => {
    const dist = runDist(run);
    const avgGrade = netGrade(run.startEle, run.endEle, dist);
    const { dplus, dminus } = statsBetween(route, run.fromKm, run.toKm);
    return {
      idx,
      type: classify(avgGrade),
      fromKm: run.fromKm,
      toKm: run.toKm,
      dist,
      dplus,
      dminus,
      avgGrade,
      hours: segTime(dist, dplus, dminus),
    };
  });
}
