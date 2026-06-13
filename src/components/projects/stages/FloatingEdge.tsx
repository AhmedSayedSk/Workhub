'use client'

import {
  BaseEdge,
  getBezierPath,
  Position,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
  type Node as RFNode,
} from '@xyflow/react'

/**
 * Floating edges that always attach to one of the node's 4 handle circles
 * (the midpoint of each side: top / right / bottom / left). On every render
 * the nearest pair of handles is picked, so wires re-route as nodes move —
 * but always terminate exactly on a circle, never mid-border.
 */

interface NodeBox {
  cx: number
  cy: number
  w: number
  h: number
  x: number
  y: number
}

function getBox(node: InternalNode<RFNode>): NodeBox {
  const w = node.measured?.width ?? 0
  const h = node.measured?.height ?? 0
  const abs = node.internals.positionAbsolute
  return { cx: abs.x + w / 2, cy: abs.y + h / 2, w, h, x: abs.x, y: abs.y }
}

/** The 4 handle anchor points of a node (side midpoints). */
function handlePoints(box: NodeBox): Record<Position, { x: number; y: number }> {
  return {
    [Position.Top]: { x: box.cx, y: box.y },
    [Position.Right]: { x: box.x + box.w, y: box.cy },
    [Position.Bottom]: { x: box.cx, y: box.y + box.h },
    [Position.Left]: { x: box.x, y: box.cy },
  }
}

/**
 * Pick the pair of handles (one on each node) with the smallest distance
 * between them. 4×4 = 16 distance checks — trivial cost, exact result.
 */
function nearestHandlePair(a: NodeBox, b: NodeBox) {
  const aPoints = handlePoints(a)
  const bPoints = handlePoints(b)
  let best: {
    sourcePos: Position
    targetPos: Position
    sx: number
    sy: number
    tx: number
    ty: number
    d2: number
  } | null = null

  for (const [aPos, ap] of Object.entries(aPoints) as [Position, { x: number; y: number }][]) {
    for (const [bPos, bp] of Object.entries(bPoints) as [Position, { x: number; y: number }][]) {
      const dx = ap.x - bp.x
      const dy = ap.y - bp.y
      const d2 = dx * dx + dy * dy
      if (!best || d2 < best.d2) {
        best = { sourcePos: aPos, targetPos: bPos, sx: ap.x, sy: ap.y, tx: bp.x, ty: bp.y, d2 }
      }
    }
  }
  return best!
}

export function FloatingEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  if (!sourceNode || !targetNode) return null

  const sourceBox = getBox(sourceNode)
  const targetBox = getBox(targetNode)
  if (sourceBox.w === 0 || targetBox.w === 0) return null

  const pair = nearestHandlePair(sourceBox, targetBox)

  const [edgePath] = getBezierPath({
    sourceX: pair.sx,
    sourceY: pair.sy,
    sourcePosition: pair.sourcePos,
    targetX: pair.tx,
    targetY: pair.ty,
    targetPosition: pair.targetPos,
  })

  return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
}
