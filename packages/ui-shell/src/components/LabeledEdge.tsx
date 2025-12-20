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

export interface LabeledEdgeData {
    label: string;
    offset?: number;
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

    return (
        <>
            {/* The SVG edge path */}
            <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />

            {/* EdgeLabelRenderer renders labels as HTML outside of SVG */}
            {data?.label && (
                <EdgeLabelRenderer>
                    <div
                        className="react-flow__edge-label-html"
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'none',
                            // Label styling
                            fontSize: 11,
                            fontWeight: 500,
                            color: 'var(--color-text-secondary, #9aa5ce)',
                            backgroundColor: 'var(--color-surface-secondary, #24283b)',
                            padding: '4px 6px',
                            borderRadius: 4,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
