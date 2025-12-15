import React from 'react';
import type { UiBundleSnapshot, UiEntity } from '../types';
import { formatEntityType } from '../utils/formatText';

interface BreadcrumbProps {
    bundle: UiBundleSnapshot | null;
    selectedEntity: UiEntity | null;
}

export function Breadcrumb({ bundle, selectedEntity }: BreadcrumbProps) {
    const manifest = bundle?.manifest as any;
    const bundleName = manifest?.bundleType || 'Bundle';

    return (
        <div className="breadcrumb">
            <span className="breadcrumb-item">{bundleName}</span>
            {selectedEntity && (
                <>
                    <span className="breadcrumb-separator">›</span>
                    <span className="breadcrumb-item">{formatEntityType(selectedEntity.entityType)}</span>
                    <span className="breadcrumb-separator">›</span>
                    <span className="breadcrumb-item breadcrumb-current">{selectedEntity.id}</span>
                </>
            )}
        </div>
    );
}
