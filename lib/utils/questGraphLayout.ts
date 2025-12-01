/**
 * Automatic layout utilities for React Flow using dagre
 */

import dagre from 'dagre'
import type { Node, Edge, Position } from '@xyflow/react'
import type { QuestNodeData } from './questGraph'

const nodeWidth = 200
const nodeHeight = 100

export function getLayoutedElements(
  nodes: Node<QuestNodeData>[],
  edges: Edge[],
  direction = 'LR' // Left to Right
) {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 100,
    ranksep: 150,
    edgesep: 50,
    marginx: 50,
    marginy: 50,
  })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: nodeWidth, 
      height: nodeHeight 
    })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      targetPosition: 'left' as Position,
      sourcePosition: 'right' as Position,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

