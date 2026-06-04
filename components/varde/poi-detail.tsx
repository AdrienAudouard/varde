"use client";

import { Icon, type IconName } from "@/components/varde/icon";
import { POIS, SEGMENTS, fmtTime, type PoiType } from "@/lib/varde/data";

type PoiDetailProps = {
  poiId: string;
  onClose: () => void;
};

const TYPE_META: Record<PoiType, { label: string; icon: IconName; cls: string }> = {
  eau: { label: "Point d'eau", icon: "drop", cls: "eau" },
  source: { label: "Source (incertaine)", icon: "drop", cls: "eau" },
  ravito: { label: "Ravitaillement", icon: "fork", cls: "ravito" },
  refuge: { label: "Refuge", icon: "house", cls: "refuge" },
};

export function PoiDetail({ poiId, onClose }: PoiDetailProps) {
  const p = POIS.find((x) => x.id === poiId);
  if (!p) return null;
  const m = TYPE_META[p.type];
  const seg = SEGMENTS.find((s) => s.to.km === p.km);
  return (
    <div className="poi-detail">
      <button type="button" className="pd-close" onClick={onClose}>
        <Icon name="close" size={16} />
      </button>
      <div className={"pd-head " + m.cls}>
        <span className="pd-ic">
          <Icon name={m.icon} size={18} />
        </span>
        <div>
          <div className="pd-type">{m.label}</div>
          <div className="pd-name">{p.name}</div>
        </div>
      </div>
      <div className="pd-row">
        <span>Position</span>
        <strong className="mono">
          km {p.km.toFixed(1).replace(".", ",")} · {p.offset} m du tracé
        </strong>
      </div>
      {seg && (
        <div className="pd-row">
          <span>Passage estimé</span>
          <strong className="mono">{fmtTime(seg.arrive)}</strong>
        </div>
      )}
      <div className="pd-note">{p.note}</div>
      <div className={"pd-status " + (p.fiable ? "ok" : "warn")}>
        <Icon name={p.fiable ? "check" : "alert"} size={15} />
        {p.fiable ? "Fiabilisé" : "À vérifier — peut être à sec"}
      </div>
      <div className="pd-actions">
        <button type="button" className="btn ghost sm">
          <Icon name="edit" size={14} /> Annoter
        </button>
        <button type="button" className="btn ghost sm">
          <Icon name="alert" size={14} /> Signaler
        </button>
      </div>
    </div>
  );
}
