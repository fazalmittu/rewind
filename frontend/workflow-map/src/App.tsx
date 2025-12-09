/**
 * App.tsx
 * Root component with three-panel layout: template list, canvas, properties.
 */

import { useState, useEffect, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import WorkflowCanvas from './components/WorkflowCanvas'
import TemplateList from './components/TemplateList'
import PropertiesPanel from './components/PropertiesPanel'
import { fetchInitialData, saveTemplate } from './api'
import { WorkflowTemplate, TemplateStep, CanonicalScreen } from './types'

function App() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [screens, setScreens] = useState<CanonicalScreen[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [selectedStep, setSelectedStep] = useState<TemplateStep | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInitialData()
      .then(([templatesData, screensData]) => {
        setTemplates(templatesData)
        setScreens(screensData)
        
        const params = new URLSearchParams(window.location.search)
        const templateId = params.get('template')
        if (templateId) {
          const template = templatesData.find(t => t.id === templateId)
          if (template) setSelectedTemplate(template)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSelectTemplate = useCallback((template: WorkflowTemplate) => {
    setSelectedTemplate(template)
    setSelectedStep(null)
    const url = new URL(window.location.href)
    url.searchParams.set('template', template.id)
    window.history.pushState({}, '', url.toString())
  }, [])

  const handleSelectStep = useCallback((step: TemplateStep | null) => {
    setSelectedStep(step)
  }, [])

  const handleUpdateStep = useCallback((updatedStep: TemplateStep) => {
    if (!selectedTemplate) return

    const updatedSteps = selectedTemplate.steps.map(s =>
      s.stepNumber === updatedStep.stepNumber ? updatedStep : s
    )
    
    const updatedTemplate = { ...selectedTemplate, steps: updatedSteps }
    setSelectedTemplate(updatedTemplate)
    setSelectedStep(updatedStep)
    setTemplates(prev => prev.map(t => 
      t.id === updatedTemplate.id ? updatedTemplate : t
    ))
  }, [selectedTemplate])

  const handleUpdateTemplate = useCallback((updates: Partial<WorkflowTemplate>) => {
    if (!selectedTemplate) return
    
    const updatedTemplate = { ...selectedTemplate, ...updates }
    setSelectedTemplate(updatedTemplate)
    setTemplates(prev => prev.map(t => 
      t.id === updatedTemplate.id ? updatedTemplate : t
    ))
  }, [selectedTemplate])

  const handleAddStep = useCallback(() => {
    if (!selectedTemplate) return
    
    const newStep: TemplateStep = {
      stepNumber: selectedTemplate.steps.length + 1,
      screenPattern: screens[0]?.label || 'New Screen',
      actionTemplate: 'New action',
      usesInputs: [],
      extracts: {}
    }
    
    const updatedTemplate = {
      ...selectedTemplate,
      steps: [...selectedTemplate.steps, newStep]
    }
    
    setSelectedTemplate(updatedTemplate)
    setTemplates(prev => prev.map(t => 
      t.id === updatedTemplate.id ? updatedTemplate : t
    ))
    setSelectedStep(newStep)
  }, [selectedTemplate, screens])

  const handleDeleteStep = useCallback((stepNumber: number) => {
    if (!selectedTemplate) return
    
    const updatedSteps = selectedTemplate.steps
      .filter(s => s.stepNumber !== stepNumber)
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 }))
    
    const updatedTemplate = { ...selectedTemplate, steps: updatedSteps }
    setSelectedTemplate(updatedTemplate)
    setTemplates(prev => prev.map(t => 
      t.id === updatedTemplate.id ? updatedTemplate : t
    ))
    
    if (selectedStep?.stepNumber === stepNumber) {
      setSelectedStep(null)
    }
  }, [selectedTemplate, selectedStep])

  const handleSaveTemplate = useCallback(async () => {
    if (!selectedTemplate) return
    
    try {
      await saveTemplate(selectedTemplate)
      alert('Template saved successfully!')
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save template')
    }
  }, [selectedTemplate])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a 
            href="/"
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            ← Back to Dashboard
          </a>
          {selectedTemplate && (
            <>
              <span className="text-gray-300">|</span>
              <h1 className="font-semibold text-gray-900">{selectedTemplate.name}</h1>
            </>
          )}
        </div>
        {selectedTemplate && (
          <button
            onClick={handleSaveTemplate}
            className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
          >
            Save Changes
          </button>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <TemplateList
            templates={templates}
            selectedTemplate={selectedTemplate}
            onSelect={handleSelectTemplate}
          />
        </aside>

        <main className="flex-1 relative">
          {selectedTemplate ? (
            <ReactFlowProvider>
              <WorkflowCanvas
                template={selectedTemplate}
                selectedStep={selectedStep}
                onSelectStep={handleSelectStep}
                onAddStep={handleAddStep}
                onDeleteStep={handleDeleteStep}
              />
            </ReactFlowProvider>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-lg font-medium text-gray-700 mb-2">
                  Select a workflow template
                </h2>
                <p className="text-sm text-gray-500">
                  Choose a template from the sidebar to view and edit its diagram
                </p>
              </div>
            </div>
          )}
        </main>

        {selectedTemplate && (
          <aside className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
            <PropertiesPanel
              template={selectedTemplate}
              selectedStep={selectedStep}
              screens={screens}
              onUpdateStep={handleUpdateStep}
              onUpdateTemplate={handleUpdateTemplate}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

export default App
