"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/varde/icon";

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
};

type Stage = "drop" | "parsing" | "done";

export function ImportModal({ open, onClose, onDone }: ImportModalProps) {
  if (!open) return null;
  return <ImportModalContent onClose={onClose} onDone={onDone} />;
}

// Lifting state into a component that mounts/unmounts with `open` is what lets
// us reset stage/pct on each open without a setState-in-effect anti-pattern.
function ImportModalContent({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [stage, setStage] = useState<Stage>("drop");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Drive the parsing animation with tracked timers so they always get
  // cleaned up when the stage flips or the modal unmounts.
  useEffect(() => {
    if (stage !== "parsing") return;
    let p = 0;
    let doneTimeout: ReturnType<typeof setTimeout> | null = null;
    const iv = setInterval(() => {
      p += 9 + Math.random() * 16;
      const next = Math.min(100, p);
      setPct(next);
      if (next >= 100) {
        clearInterval(iv);
        doneTimeout = setTimeout(() => setStage("done"), 250);
      }
    }, 110);
    return () => {
      clearInterval(iv);
      if (doneTimeout) clearTimeout(doneTimeout);
    };
  }, [stage]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 id="import-modal-title">Importer une trace GPX</h3>
          <button type="button" className="pd-close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {stage === "drop" && (
          <div className="modal-body">
            <div
              className="dropzone"
              role="button"
              tabIndex={0}
              onClick={() => setStage("parsing")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setStage("parsing");
                }
              }}
            >
              <Icon name="import" size={34} />
              <div className="dz-t">Dépose ton fichier .gpx ici</div>
              <div className="dz-s">ou clique pour parcourir</div>
            </div>
            <label className="imp-opt">
              <input type="checkbox" defaultChecked /> Détecter les points d&apos;eau et ravitos à proximité
            </label>
            <label className="imp-opt">
              <input type="checkbox" defaultChecked /> Calculer le plan d&apos;autonomie automatiquement
            </label>
          </div>
        )}

        {stage === "parsing" && (
          <div className="modal-body parsing">
            <div className="parse-file">
              <Icon name="route" size={18} /> tour-des-cretes.gpx
            </div>
            <div className="pbar">
              <div className="pbar-fill" style={{ width: pct + "%" }} />
            </div>
            <div className="parse-steps mono">
              <div className={pct > 5 ? "on" : ""}>· lecture du tracé · 2 184 points</div>
              <div className={pct > 40 ? "on" : ""}>· profil altimétrique · D+ 1 980 m</div>
              <div className={pct > 70 ? "on" : ""}>· recherche des POI à proximité…</div>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="modal-body done">
            <div className="done-ic">
              <Icon name="check" size={30} />
            </div>
            <div className="done-t">Trace importée</div>
            <div className="done-grid mono">
              <div>
                <b>34,2 km</b>
                <span>distance</span>
              </div>
              <div>
                <b>+1 980 m</b>
                <span>D+</span>
              </div>
              <div>
                <b>7</b>
                <span>POI détectés</span>
              </div>
              <div>
                <b>6</b>
                <span>segments</span>
              </div>
            </div>
            <button type="button" className="btn primary full" onClick={onDone}>
              Ouvrir le plan d&apos;autonomie
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
