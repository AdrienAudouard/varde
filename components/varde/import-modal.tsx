"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/varde/icon";
import { parseGpx } from "@/lib/varde/gpx";
import { buildSegments, fmtDur, statsBetween, type Trace } from "@/lib/varde/data";

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: (trace: Trace) => void;
};

type Stage = "drop" | "parsing" | "done" | "error";

// Reject before reading anything: a 15MB GPX is already an absurdly dense track.
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  if (!open) return null;
  return <ImportModalContent onClose={onClose} onImported={onImported} />;
}

// Mounting/unmounting this with `open` resets stage on each open without a
// setState-in-effect anti-pattern, and gives every open a fresh `ignoreRef`.
function ImportModalContent({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (trace: Trace) => void;
}) {
  const [stage, setStage] = useState<Stage>("drop");
  const [parsed, setParsed] = useState<Trace | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Set on unmount so an in-flight parse never calls setState on a dead tree.
  // IMPORTANT: reset to false in the setup, not just true in the cleanup —
  // otherwise React Strict Mode's mount→unmount→remount cycle leaves it stuck
  // `true`, and every parse silently bails after `await file.text()`.
  const ignoreRef = useRef(false);
  useEffect(() => {
    ignoreRef.current = false;
    return () => {
      ignoreRef.current = true;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Done-screen stats: derived during render (memoized), never via an effect.
  // statsBetween samples every 0.05km so we compute it once per parsed trace.
  const stats = useMemo(() => {
    if (!parsed || parsed.route.length < 2) {
      return { km: 0, dplus: 0, dminus: 0, points: 0, dur: "0h00" };
    }
    const route = parsed.route;
    const total = route[route.length - 1].dist;
    const { dplus, dminus } = statsBetween(route, 0, total);
    const hours = buildSegments(parsed)[0]?.hours ?? 0;
    return {
      km: total,
      dplus: Math.round(dplus),
      dminus: Math.round(dminus),
      points: route.length,
      dur: fmtDur(hours),
    };
  }, [parsed]);

  async function handleFile(file: File) {
    console.log("[varde/import] handleFile", { name: file.name, size: file.size, type: file.type });
    if (file.size > MAX_FILE_BYTES) {
      console.warn("[varde/import] rejected: file too large", file.size);
      setErrMsg("Fichier trop volumineux (max 15 Mo).");
      setStage("error");
      return;
    }
    setStage("parsing");
    try {
      console.log("[varde/import] reading file text…");
      const xml = await file.text();
      console.log("[varde/import] read text", { length: xml.length, ignore: ignoreRef.current });
      if (ignoreRef.current) {
        console.warn("[varde/import] aborted after read: ignoreRef is true (component unmounted)");
        return;
      }
      const trace = parseGpx(xml);
      console.log("[varde/import] parsed trace", { points: trace.route.length });
      setParsed(trace);
      setStage("done");
      console.log("[varde/import] stage → done");
    } catch (err) {
      console.error("[varde/import] parse/read failed", err);
      if (ignoreRef.current) return;
      setErrMsg(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

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

        <input
          ref={inputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className="imp-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void handleFile(file);
          }}
        />

        {stage === "drop" && (
          <div className="modal-body">
            <div
              className="dropzone"
              role="button"
              tabIndex={0}
              onClick={openPicker}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openPicker();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
            >
              <Icon name="import" size={34} />
              <div className="dz-t">Dépose ton fichier .gpx ici</div>
              <div className="dz-s">ou clique pour parcourir</div>
            </div>
          </div>
        )}

        {stage === "parsing" && (
          <div className="modal-body parsing">
            <div className="parse-file">
              <span className="varde-spinner" role="status" aria-label="Lecture en cours" />
              Lecture du fichier GPX…
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="modal-body done">
            <div className="done-ic">
              <Icon name="check" size={30} />
            </div>
            <div className="done-t">Trace importée</div>
            <dl className="done-stats">
              <div className="ds-cell">
                <dt>Distance</dt>
                <dd className="mono">{stats.km.toFixed(1).replace(".", ",")} km</dd>
              </div>
              <div className="ds-cell">
                <dt>Dénivelé +</dt>
                <dd className="mono">{stats.dplus} m</dd>
              </div>
              <div className="ds-cell">
                <dt>Dénivelé −</dt>
                <dd className="mono">{stats.dminus} m</dd>
              </div>
              <div className="ds-cell">
                <dt>Durée estimée</dt>
                <dd className="mono">{stats.dur}</dd>
              </div>
              <div className="ds-cell ds-wide">
                <dt>Points</dt>
                <dd className="mono">{stats.points}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="btn primary full"
              onClick={() => parsed && onImported(parsed)}
            >
              Ouvrir le plan d&apos;autonomie
            </button>
          </div>
        )}

        {stage === "error" && (
          <div className="modal-body imp-error">
            <div className="imp-error-ic">
              <Icon name="close" size={28} />
            </div>
            <div className="imp-error-t">Import impossible</div>
            <p className="imp-error-sub">{errMsg}</p>
            <button
              type="button"
              className="btn full"
              onClick={() => {
                setErrMsg("");
                setStage("drop");
              }}
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
