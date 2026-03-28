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
    /** All references in the bundle */
    allEdges: EntityEdge[];
    /** Depth of BFS traversal (1, 2, or 3) */
    depth: number;
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
    allEdges,
    depth,
    entityConfigs,
    onNavigate,
    getFieldDisplay,
}: EntityDependencyGraphProps) {
    // Build nodes and edges from dependencies
    const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge<LabeledEdgeData>[] = [];

        // Helper to create node ID
        const makeNodeId = (type: string, id: string) => `${type}:${id}`;

        // Initialize BFS
        const maxDepth = depth || 1;
        let currentLevel = new Set<string>();
        const rootId = makeNodeId(entityType, entityId);
        currentLevel.add(rootId);

        const visitedNodes = new Set<string>();
        visitedNodes.add(rootId);

        const collectedEdges = new Set<EntityEdge>();

        // Traverse BFS
        for (let currentDepth = 0; currentDepth < maxDepth; currentDepth++) {
            const nextLevel = new Set<string>();

            for (const nodeId of currentLevel) {
                // Find all edges where this nodeId is source or target
                for (const edge of allEdges) {
                    const sourceId = makeNodeId(edge.fromEntityType, edge.fromId);
                    const targetId = makeNodeId(edge.toEntityType, edge.toId);

                    if (sourceId === nodeId) {
                        collectedEdges.add(edge);
                        if (!visitedNodes.has(targetId)) {
                            visitedNodes.add(targetId);
                            nextLevel.add(targetId);
                        }
                    } else if (targetId === nodeId) {
                        collectedEdges.add(edge);
                        if (!visitedNodes.has(sourceId)) {
                            visitedNodes.add(sourceId);
                            nextLevel.add(sourceId);
                        }
                    }
                }
            }
            currentLevel = nextLevel;
            if (currentLevel.size === 0) break;
        }

        // Add center node (current entity)
        const centerColor = getEntityColorFromConfigs(entityType, entityConfigs);

        nodes.push({
            id: rootId,
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

        // Add all other nodes discovered in BFS
        for (const nodeId of visitedNodes) {
           if (nodeId === rootId) continue;
           
           // Extract type and id from composite nodeId
           const splitIndex = nodeId.indexOf(':');
           const nodeType = nodeId.slice(0, splitIndex);
           const nodeLabelId = nodeId.slice(splitIndex + 1);
           
           const color = getEntityColorFromConfigs(nodeType, entityConfigs);
           nodes.push({
               id: nodeId,
               type: 'default',
               data: {
                   label: nodeLabelId,
                   entityType: nodeType,
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
        }

        // Add all collected edges
        let edgeIndex = 0;
        for (const edge of collectedEdges) {
            const sourceId = makeNodeId(edge.fromEntityType, edge.fromId);
            const targetId = makeNodeId(edge.toEntityType, edge.toId);
            const label = getFieldDisplay(edge.fromEntityType, edge.fromField);

            // Determine styling based on whether it connects directly to root
            let edgeColor = 'var(--color-border-subtle, #3b4261)';
            let edgeWidth = 1;

            if (sourceId === rootId) {
                // Outgoing from center
                edgeColor = 'var(--color-accent, #7aa2f7)';
                edgeWidth = 2;
            } else if (targetId === rootId) {
                // Incoming to center
                edgeColor = 'var(--color-border, #414868)';
                edgeWidth = 1.5;
            }

            edges.push({
                id: `edge-${edgeIndex++}`,
                source: sourceId,
                target: targetId,
                type: 'labeled',
                data: { label },
                style: {
                    stroke: edgeColor,
                    strokeWidth: edgeWidth,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: edgeColor,
                    width: 20,
                    height: 20,
                },
            });
        }

        // Apply layout
        return getLayoutedElements(nodes, edges, rootId);
    }, [entityType, entityId, allEdges, depth, entityConfigs, getFieldDisplay]);

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
    if (layoutedEdges.length === 0) {
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
                style={{ width: '100%', height: '100%' }}
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
