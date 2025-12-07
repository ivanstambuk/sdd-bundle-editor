import type { UiBundleSnapshot, UiEntity } from '../types';

interface EntityNavigatorProps {
  bundle: UiBundleSnapshot | null;
  selected?: { entityType: string; id: string };
  onSelect(entity: UiEntity): void;
}

export function EntityNavigator({ bundle, selected, onSelect }: EntityNavigatorProps) {
  if (!bundle) {
    return (
      <div className="entity-navigator">
        <div className="entity-placeholder">
          <div className="entity-placeholder-icon">📦</div>
          <div>No bundle loaded.</div>
        </div>
      </div>
    );
  }

  const entries = Object.entries(bundle.entities);

  return (
    <div className="entity-navigator">
      <h2>Entities</h2>
      {entries.map(([entityType, entities]) => (
        <div key={entityType} className="entity-group" data-type={entityType}>
          <h3 className="entity-group-header">{entityType}</h3>
          <ul className="entity-list">
            {entities.map((entity) => {
              const isSelected =
                selected?.entityType === entity.entityType && selected?.id === entity.id;
              return (
                <li key={entity.id} className="entity-item">
                  <button
                    type="button"
                    className={`entity-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelect(entity)}
                  >
                    {entity.id}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
