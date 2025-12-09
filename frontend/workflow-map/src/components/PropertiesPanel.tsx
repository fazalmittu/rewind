/**
 * PropertiesPanel.tsx
 * Right sidebar for editing workflow and step properties.
 */

import { useState, useEffect } from 'react'
import { WorkflowTemplate, TemplateStep, CanonicalScreen } from '../types'

interface PropertiesPanelProps {
  template: WorkflowTemplate
  selectedStep: TemplateStep | null
  screens: CanonicalScreen[]
  onUpdateStep: (step: TemplateStep) => void
  onUpdateTemplate: (updates: Partial<WorkflowTemplate>) => void
}

export default function PropertiesPanel({
  template,
  selectedStep,
  screens,
  onUpdateStep,
  onUpdateTemplate,
}: PropertiesPanelProps) {
  const [localStep, setLocalStep] = useState<TemplateStep | null>(selectedStep)
  const [localName, setLocalName] = useState(template.name)
  const [localDescription, setLocalDescription] = useState(template.description)

  useEffect(() => {
    setLocalStep(selectedStep)
  }, [selectedStep])

  useEffect(() => {
    setLocalName(template.name)
    setLocalDescription(template.description)
  }, [template.name, template.description])

  const handleStepChange = (field: keyof TemplateStep, value: unknown) => {
    if (!localStep) return
    const updated = { ...localStep, [field]: value }
    setLocalStep(updated)
    onUpdateStep(updated)
  }

  const handleUsesInputsChange = (inputKey: string, checked: boolean) => {
    if (!localStep) return
    const current = localStep.usesInputs || []
    const updated = checked
      ? [...current, inputKey]
      : current.filter(k => k !== inputKey)
    handleStepChange('usesInputs', updated)
  }

  const handleTemplateNameChange = () => {
    if (localName !== template.name) {
      onUpdateTemplate({ name: localName })
    }
  }

  const handleTemplateDescChange = () => {
    if (localDescription !== template.description) {
      onUpdateTemplate({ description: localDescription })
    }
  }

  if (selectedStep && localStep) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Step {localStep.stepNumber} Properties
          </h2>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Screen
          </label>
          <select
            value={localStep.screenPattern}
            onChange={(e) => handleStepChange('screenPattern', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {screens.length > 0 ? (
              screens.map(screen => (
                <option key={screen.id} value={screen.label}>
                  {screen.label}
                </option>
              ))
            ) : (
              <option value={localStep.screenPattern}>
                {localStep.screenPattern}
              </option>
            )}
            {!screens.find(s => s.label === localStep.screenPattern) && (
              <option value={localStep.screenPattern}>
                {localStep.screenPattern} (custom)
              </option>
            )}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action
          </label>
          <textarea
            value={localStep.actionTemplate}
            onChange={(e) => handleStepChange('actionTemplate', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="e.g., Click on {button_name}"
          />
          <p className="text-xs text-gray-400 mt-1">
            Use {'{param_name}'} for input placeholders
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Uses Inputs
          </label>
          {Object.keys(template.inputs).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(template.inputs).map(([key, param]) => (
                <label key={key} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localStep.usesInputs?.includes(key) || false}
                    onChange={(e) => handleUsesInputsChange(key, e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-mono text-gray-900">{key}</span>
                    <p className="text-xs text-gray-500">{param.description}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No inputs defined</p>
          )}
        </div>

        {Object.keys(localStep.extracts).length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Extracts
            </label>
            <div className="space-y-1">
              {Object.entries(localStep.extracts).map(([key, def]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-green-700">{key}</span>
                  <span className="text-gray-400">from {def.from}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Template Properties
        </h2>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleTemplateNameChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={handleTemplateDescChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Inputs
        </label>
        {Object.keys(template.inputs).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(template.inputs).map(([key, param]) => (
              <div key={key} className="text-sm">
                <span className="font-mono text-gray-900">{key}</span>
                <span className="text-gray-400 ml-2 text-xs">({param.type})</span>
                {param.required && <span className="text-red-500 ml-1">*</span>}
                <p className="text-xs text-gray-500">{param.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No inputs</p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Outputs
        </label>
        {Object.keys(template.outputs).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(template.outputs).map(([key, param]) => (
              <div key={key} className="text-sm">
                <span className="font-mono text-green-700">{key}</span>
                <span className="text-gray-400 ml-2 text-xs">({param.type})</span>
                <p className="text-xs text-gray-500">{param.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No outputs</p>
        )}
      </div>

      <div className="pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-400 space-y-1">
          <p>Steps: {template.steps.length}</p>
          <p>Instances: {template.instances?.length || 0}</p>
          <p>Created: {new Date(template.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}
