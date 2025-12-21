/**
 * LabeledEdge - Custom edge component that renders labels above the edge path.
 * 
 * Uses EdgeLabelRenderer to escape SVG and render labels as HTML divs.
 * This ensures labels are never crossed by edge lines regardless of layout.
 * 
 * @see https://reactflow.dev/examples/edges/edge-label-renderer
 */
import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    type EdgeProps,
} from 'reactflow';
import styles from './LabeledEdge.module.css';

export interface LabeledEdgeData {
    label: string;
    offset?: number;
    /** Source entity type name (for tooltip) */
    sourceEntity?: string;
    /** Target entity type name (for tooltip) */
    targetEntity?: string;
}

export function LabeledEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    data,
}: EdgeProps<LabeledEdgeData>) {
    // Calculate the path and label position
    // The offset parameter creates curved paths for parallel edges
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        offset: data?.offset,
        borderRadius: 8,
    });

    // Build tooltip text showing which entities the relationship connects
    const tooltip = data?.sourceEntity && data?.targetEntity
        ? `${data.sourceEntity} → ${data.targetEntity}`
        : undefined;

    return (
        <>
            {/* The SVG edge path */}
            <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />

            {/* EdgeLabelRenderer renders labels as HTML outside of SVG */}
            {data?.label && (
                <EdgeLabelRenderer>
                    <div
                        className={styles.label}
                        style={{
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                        }}
                        title={tooltip}
                    >
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

