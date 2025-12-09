import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { TemplateStep } from '../types'

export interface StepNodeData {
  step: TemplateStep
  isSelected: boolean
  onDelete: (stepNumber: number) => void
}

interface StepNodeProps {
  data: StepNodeData
}

function StepNode({ data }: StepNodeProps) {
  const { step, isSelected, onDelete } = data

  // Highlight parameter placeholders in the action template
  const highlightParams = (text: string) => {
    const parts = text.split(/(\{[^}]+\})/)
    return parts.map((part, i) => {
      if (part.match(/^\{[^}]+\}$/)) {
        return (
          <span
            key={i}
            className="inline-block bg-blue-100 text-blue-700 px-1 rounded text-xs font-mono"
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-sm min-w-[200px] max-w-[280px] transition-all ${
        isSelected
          ? 'border-blue-500 shadow-md ring-2 ring-blue-100'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Target handle (input) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">
            {step.stepNumber}
          </span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {step.screenPattern}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(step.stepNumber)
          }}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title="Delete step"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-sm text-gray-700 leading-relaxed">
          {highlightParams(step.actionTemplate)}
        </p>

        {/* Input params used */}
        {step.usesInputs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {step.usesInputs.map(input => (
              <span
                key={input}
                className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
              >
                {input}
              </span>
            ))}
          </div>
        )}

        {/* Extracts */}
        {Object.keys(step.extracts).length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">Extracts:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.keys(step.extracts).map(key => (
                <span
                  key={key}
                  className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded"
                >
                  {key}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Source handle (output) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />
    </div>
  )
}

export default memo(StepNode)

