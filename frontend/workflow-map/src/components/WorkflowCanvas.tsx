import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import StepNode from './StepNode'
import { WorkflowTemplate, TemplateStep } from '../types'

interface WorkflowCanvasProps {
  template: WorkflowTemplate
  selectedStep: TemplateStep | null
  onSelectStep: (step: TemplateStep | null) => void
  onAddStep: () => void
  onDeleteStep: (stepNumber: number) => void
  onUpdateTemplate?: (updates: Partial<WorkflowTemplate>) => void
}

const nodeTypes = {
  stepNode: StepNode,
}

export default function WorkflowCanvas({
  template,
  selectedStep,
  onSelectStep,
  onAddStep,
  onDeleteStep,
}: WorkflowCanvasProps) {
  const initialNodes: Node[] = useMemo(() => {
    return template.steps.map((step, index) => ({
      id: `step-${step.stepNumber}`,
      type: 'stepNode',
      position: { x: 300, y: index * 180 + 50 },
      data: {
        step,
        isSelected: selectedStep?.stepNumber === step.stepNumber,
        onDelete: onDeleteStep,
      },
    }))
  }, [template.steps, selectedStep, onDeleteStep])

  const initialEdges: Edge[] = useMemo(() => {
    return template.steps.slice(0, -1).map((step, index) => ({
      id: `edge-${step.stepNumber}-${template.steps[index + 1].stepNumber}`,
      source: `step-${step.stepNumber}`,
      target: `step-${template.steps[index + 1].stepNumber}`,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#9ca3af', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#9ca3af',
      },
    }))
  }, [template.steps])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(
      template.steps.map((step, index) => ({
        id: `step-${step.stepNumber}`,
        type: 'stepNode',
        position: nodes.find(n => n.id === `step-${step.stepNumber}`)?.position || {
          x: 300,
          y: index * 180 + 50,
        },
        data: {
          step,
          isSelected: selectedStep?.stepNumber === step.stepNumber,
          onDelete: onDeleteStep,
        },
      }))
    )
  }, [template.steps, selectedStep, onDeleteStep, setNodes])

  useEffect(() => {
    setEdges(
      template.steps.slice(0, -1).map((step, index) => ({
        id: `edge-${step.stepNumber}-${template.steps[index + 1].stepNumber}`,
        source: `step-${step.stepNumber}`,
        target: `step-${template.steps[index + 1].stepNumber}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#9ca3af', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#9ca3af',
        },
      }))
    )
  }, [template.steps, setEdges])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const step = template.steps.find(s => `step-${s.stepNumber}` === node.id)
      onSelectStep(step || null)
    },
    [template.steps, onSelectStep]
  )

  const onPaneClick = useCallback(() => {
    onSelectStep(null)
  }, [onSelectStep])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9ca3af',
          },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        <Controls showInteractive={false} />
      </ReactFlow>

      <button
        onClick={onAddStep}
        className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-gray-300 transition-all text-sm font-medium text-gray-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Step
      </button>
    </div>
  )
}

