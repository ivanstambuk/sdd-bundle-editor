/**
 * EntityDependencyGraph - Interactive graph visualization of an entity's dependencies.
 * Uses React Flow for rendering with the current entity centered and connected entities around it.
 * 
 * Reuses styling patterns from RelationshipGraph for consistency.
 */
import { useCallback, useMemo } from 'react';
import ReactFlow, {
    Node,
    Edge,
    MiniMap,
    Controls,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    MarkerType,
    NodeMouseHandler,
    type EdgeTypes,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import type { BundleTypeEntityConfig } from '@sdd-bundle-editor/shared-types';
import { getEntityColorFromConfigs } from '../utils/entityColors';
import { LabeledEdge, type LabeledEdgeData } from './LabeledEdge';
import styles from './EntityDependencyGraph.module.css';

/** Edge representing a reference from one entity to another */
export interface EntityEdge {
    fromEntityType: string;
    fromId: string;
    fromField: string;
    toEntityType: string;
    toId: string;
}

interface EntityDependencyGraphProps {
    /** Current entity type */
    entityType: string;
    /** Current entity ID */
    entityId: string;
    /** Outgoing references (this entity uses these) */
    outgoing: EntityEdge[];
    /** Incoming references (these entities use this one) */
    incoming: EntityEdge[];
    /** Entity type configurations for colors */
    entityConfigs: BundleTypeEntityConfig[];
    /** Callback when an entity node is clicked */
    onNavigate?: (entityType: string, entityId: string) => void;
    /** Get display name for a relationship field */
    getFieldDisplay: (entityType: string, fieldName: string) => string;
}


// Apply dagre layout to position nodes
function getLayoutedElements(
    nodes: Node[],
    edges: Edge[],
    centerNodeId: string
): { nodes: Node[]; edges: Edge[] } {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 180;
    const nodeHeight = 50;

    dagreGraph.setGraph({
        rankdir: 'LR', // Left to right layout
        nodesep: 50,
        ranksep: 100,
        marginx: 40,
        marginy: 40,
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
}

export function EntityDependencyGraph({
    entityType,
    entityId,
    outgoing,
    incoming,
    entityConfigs,
    onNavigate,
    getFieldDisplay,
}: EntityDependencyGraphProps) {
    // Build nodes and edges from dependencies
    const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge<LabeledEdgeData>[] = [];
        const addedNodes = new Set<string>();

        // Helper to create node ID
        const makeNodeId = (type: string, id: string) => `${type}:${id}`;

        // Add center node (current entity)
        const centerNodeId = makeNodeId(entityType, entityId);
        const centerColor = getEntityColorFromConfigs(entityType, entityConfigs);

        nodes.push({
            id: centerNodeId,
            type: 'default',
            data: {
                label: entityId,
                entityType,
                isCenter: true,
            },
            position: { x: 0, y: 0 },
            style: {
                background: centerColor,
                color: '#1a1b26',
                border: '3px solid #fff',
                borderRadius: '8px',
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                cursor: 'default',
                minWidth: '140px',
                textAlign: 'center' as const,
            },
        });
        addedNodes.add(centerNodeId);

        // Add outgoing nodes (this entity uses these)
        outgoing.forEach((edge, index) => {
            const nodeId = makeNodeId(edge.toEntityType, edge.toId);

            if (!addedNodes.has(nodeId)) {
                const color = getEntityColorFromConfigs(edge.toEntityType, entityConfigs);
                nodes.push({
                    id: nodeId,
                    type: 'default',
                    data: {
                        label: edge.toId,
                        entityType: edge.toEntityType,
                    },
                    position: { x: 0, y: 0 },
                    style: {
                        background: color,
                        color: '#1a1b26',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        fontWeight: 600,
                        fontSize: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        minWidth: '120px',
                        textAlign: 'center' as const,
                    },
                });
                addedNodes.add(nodeId);
            }

            // Edge from center to target
            const label = getFieldDisplay(edge.fromEntityType, edge.fromField);
            edges.push({
                id: `out-${index}`,
                source: centerNodeId,
                target: nodeId,
                type: 'labeled',
                data: { label },
                style: {
                    stroke: 'var(--color-accent, #7aa2f7)',
                    strokeWidth: 2,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: 'var(--color-accent, #7aa2f7)',
                    width: 20,
                    height: 20,
                },
            });
        });

        // Add incoming nodes (these entities use this)
        incoming.forEach((edge, index) => {
            const nodeId = makeNodeId(edge.fromEntityType, edge.fromId);

            if (!addedNodes.has(nodeId)) {
                const color = getEntityColorFromConfigs(edge.fromEntityType, entityConfigs);
                nodes.push({
                    id: nodeId,
                    type: 'default',
                    data: {
                        label: edge.fromId,
                        entityType: edge.fromEntityType,
                    },
                    position: { x: 0, y: 0 },
                    style: {
                        background: color,
                        color: '#1a1b26',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        fontWeight: 600,
                        fontSize: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        minWidth: '120px',
                        textAlign: 'center' as const,
                    },
                });
                addedNodes.add(nodeId);
            }

            // Edge from source to center
            const label = getFieldDisplay(edge.fromEntityType, edge.fromField);
            edges.push({
                id: `in-${index}`,
                source: nodeId,
                target: centerNodeId,
                type: 'labeled',
                data: { label },
                style: {
                    stroke: 'var(--color-border, #414868)',
                    strokeWidth: 1.5,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: 'var(--color-border, #414868)',
                    width: 20,
                    height: 20,
                },
            });
        });

        // Apply layout
        return getLayoutedElements(nodes, edges, centerNodeId);
    }, [entityType, entityId, outgoing, incoming, entityConfigs, getFieldDisplay]);

    const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

    // Define custom edge types
    const edgeTypes: EdgeTypes = useMemo(
        () => ({ labeled: LabeledEdge }),
        []
    );

    // Handle node click -> navigate to entity
    const onNodeClick: NodeMouseHandler = useCallback(
        (_event, node) => {
            // Don't navigate when clicking center node
            if (node.data.isCenter) return;
            onNavigate?.(node.data.entityType, node.data.label);
        },
        [onNavigate]
    );

    // Empty state
    if (outgoing.length === 0 && incoming.length === 0) {
        return (
            <div className={styles.empty}>
                <span className={styles.emptyIcon}>🔗</span>
                <p>No dependencies for this entity.</p>
            </div>
        );
    }

    return (
        <div className={styles.graph} data-testid="entity-dependency-graph">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                fitView
                fitViewOptions={{
                    padding: 0.3,
                    minZoom: 0.5,
                    maxZoom: 1.5,
                }}
                minZoom={0.3}
                maxZoom={2}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{
                    type: 'labeled',
                }}
                proOptions={{ hideAttribution: true }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="var(--color-border-subtle, #2f3549)"
                />
                <Controls
                    showInteractive={false}
                    position="bottom-left"
                />
                <MiniMap
                    nodeColor={(node) => node.style?.background as string || '#414868'}
                    maskColor="rgba(0, 0, 0, 0.6)"
                    style={{
                        backgroundColor: 'var(--color-surface-secondary, #24283b)',
                        border: '1px solid var(--color-border, #414868)',
                        borderRadius: '8px',
                    }}
                    position="bottom-right"
                />
            </ReactFlow>
        </div>
    );
}
