/**
 * constants.ts
 * Shared layout, color, and style constants for the workflow map.
 */

// Layout
export const NODE_SPACING_X = 500
export const NODE_OFFSET_X = 150
export const NODE_Y = 100
export const START_END_Y = 124
export const END_NODE_OFFSET = 350
export const EXPORT_PADDING = 50

// Colors
export const COLORS = {
  edge: '#9ca3af',
  start: '#22c55e',
  end: '#ef4444',
  stepMinimap: '#6b7280',
  exportBackground: '#f9fafb',
  gridDots: '#e5e7eb',
} as const

// Edge styles
export const EDGE_STYLE = { stroke: COLORS.edge, strokeWidth: 2 }
export const START_EDGE_STYLE = { stroke: COLORS.start, strokeWidth: 2 }
export const END_EDGE_STYLE = { stroke: COLORS.end, strokeWidth: 2 }

// React Flow config
export const REACT_FLOW_CONFIG = {
  minZoom: 0.3,
  maxZoom: 1.5,
  fitViewPadding: 0.2,
} as const

export const MINIMAP_CONFIG = {
  width: 120,
  height: 80,
  bottom: 70,
  right: 10,
  maskColor: 'rgba(0, 0, 0, 0.1)',
} as const

