"use client";

import { SEGMENTS, fmtTime } from "@/lib/varde/data";

type RecapTableProps = {
  selectedSeg: number | null;
  setSelectedSeg: (i: number | null) => void;
};

export function RecapTable({ selectedSeg, setSelectedSeg }: RecapTableProps) {
  const totalWater = SEGMENTS.reduce((a, s) => a + s.water, 0);
  return (
    <aside className="autonomy recap">
      <div className="au-head">
        <h2>Tableau de course</h2>
        <p>Récapitulatif des ravitos et de l&apos;eau à porter.</p>
      </div>
      <div className="rt-wrap">
        <table className="rtable">
          <thead>
            <tr>
              <th>Ravito</th>
              <th>km</th>
              <th>D+</th>
              <th>Eau</th>
              <th>Passage</th>
            </tr>
          </thead>
          <tbody>
            {SEGMENTS.map((s, i) => (
              <tr
                key={i}
                className={selectedSeg === i ? "active" : ""}
                onClick={() => setSelectedSeg(selectedSeg === i ? null : i)}
              >
                <td className="rt-name">{s.to.name}</td>
                <td className="mono">{s.to.km.toFixed(1).replace(".", ",")}</td>
                <td className="mono up">+{Math.round(s.dplus)}</td>
                <td className="mono">
                  <strong>{s.water.toFixed(1).replace(".", ",")} L</strong>
                </td>
                <td className="mono">{fmtTime(s.arrive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="au-foot">
        <span>Eau totale estimée</span>
        <strong>{totalWater.toFixed(1).replace(".", ",")} L</strong>
      </div>
    </aside>
  );
}
