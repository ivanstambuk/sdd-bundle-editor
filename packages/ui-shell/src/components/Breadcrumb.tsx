import React from 'react';
import type { UiBundleSnapshot, UiEntity } from '../types';
import { getEntityDisplayName } from '../utils/schemaMetadata';
import styles from './Breadcrumb.module.css';

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
        <div className={styles.breadcrumb}>
            <span className={styles.item}>{bundleName}</span>
            {selectedEntity && (
                <>
                    <span className={styles.separator}>›</span>
                    <span className={styles.item}>{getDisplayName(selectedEntity.entityType)}</span>
                    <span className={styles.separator}>›</span>
                    <span className={`${styles.item} ${styles.current}`}>{selectedEntity.id}</span>
                </>
            )}
        </div>
    );
}

