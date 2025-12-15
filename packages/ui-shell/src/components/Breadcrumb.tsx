import React from 'react';
import type { UiBundleSnapshot, UiEntity } from '../types';
import { getEntityDisplayName } from '../utils/schemaMetadata';

interface BreadcrumbProps {
    bundle: UiBundleSnapshot | null;
    selectedEntity: UiEntity | null;
}

export function Breadcrumb({ bundle, selectedEntity }: BreadcrumbProps) {
    const manifest = bundle?.manifest as any;
    const bundleName = manifest?.bundleType || 'Bundle';

    // Get display name from schema
    const getDisplayName = (entityType: string): string => {
        const schema = bundle?.schemas?.[entityType];
        return getEntityDisplayName(schema) ?? entityType;
    };

    return (
        <div className="breadcrumb">
            <span className="breadcrumb-item">{bundleName}</span>
            {selectedEntity && (
                <>
                    <span className="breadcrumb-separator">›</span>
                    <span className="breadcrumb-item">{getDisplayName(selectedEntity.entityType)}</span>
                    <span className="breadcrumb-separator">›</span>
                    <span className="breadcrumb-item breadcrumb-current">{selectedEntity.id}</span>
                </>
            )}
        </div>
    );
}
