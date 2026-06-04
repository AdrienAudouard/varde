"use client";

import { Icon } from "@/components/varde/icon";

type LibraryProps = {
  onImport: () => void;
};

export function Library({ onImport }: LibraryProps) {
  return (
    <div className="library">
      <div className="lib-head">
        <div>
          <h1>Mes traces</h1>
          <p>Prépare tes sorties : trace, points d&apos;eau, ravitos et autonomie.</p>
        </div>
        <div className="lib-head-actions">
          <button type="button" className="btn ghost" onClick={onImport}>
            <Icon name="import" size={17} /> Importer un GPX
          </button>
          <button type="button" className="btn primary">
            <Icon name="pencil" size={17} /> Nouvelle trace
          </button>
        </div>
      </div>

      <div className="lib-grid">
        <button type="button" className="trace-card new" onClick={onImport}>
          <div className="new-plus">
            <Icon name="pencil" size={24} />
          </div>
          <div className="new-t">Dessiner une trace</div>
          <div className="new-s">ou importer un fichier GPX</div>
        </button>
      </div>

      <div className="empty-state lib-empty">
        <div className="empty-state-ic">
          <Icon name="route" size={28} />
        </div>
        <h2 className="empty-state-title">Aucune trace pour l&apos;instant</h2>
        <p className="empty-state-text">
          Importe un fichier GPX ou dessine une trace pour la retrouver ici.
        </p>
      </div>
    </div>
  );
}
