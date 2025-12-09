/**
 * StartEndNodes.tsx
 * Terminal node components marking workflow start and end.
 */

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

export const StartNode = memo(function StartNode() {
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500 text-white font-semibold text-sm shadow-md">
      Start
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-600 border-2 border-white"
      />
    </div>
  )
})

export const EndNode = memo(function EndNode() {
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500 text-white font-semibold text-sm shadow-md">
      End
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-red-600 border-2 border-white"
      />
    </div>
  )
})
