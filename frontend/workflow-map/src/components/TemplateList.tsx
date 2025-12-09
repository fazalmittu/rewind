/**
 * TemplateList.tsx
 * Left sidebar listing available workflow templates.
 */

import { WorkflowTemplate } from '../types'

interface TemplateListProps {
  templates: WorkflowTemplate[]
  selectedTemplate: WorkflowTemplate | null
  onSelect: (template: WorkflowTemplate) => void
}

export default function TemplateList({ 
  templates, 
  selectedTemplate, 
  onSelect 
}: TemplateListProps) {
  if (templates.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Templates
        </h2>
        <p className="text-sm text-gray-400">
          No templates yet. Record some workflows first.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Templates
      </h2>
      <div className="space-y-2">
        {templates.map(template => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedTemplate?.id === template.id
                ? 'bg-blue-50 border-blue-200'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-sm text-gray-900 mb-0.5">
              {template.name}
            </div>
            <div className="text-xs text-gray-500 line-clamp-2">
              {template.description}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">
                {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
              </span>
              {template.instances && template.instances.length > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-blue-600">
                    {template.instances.length} run{template.instances.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
