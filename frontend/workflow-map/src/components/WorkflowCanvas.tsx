import { useCallback, useEffect } from 'react'
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
import { StartNode, EndNode } from './StartEndNodes'
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
  startNode: StartNode,
  endNode: EndNode,
}

const NODE_SPACING_X = 500
const NODE_OFFSET_X = 150
const NODE_Y = 100
const START_END_Y = 124
const END_NODE_OFFSET = 350

const EDGE_STYLE = { stroke: '#9ca3af', strokeWidth: 2 }
const START_EDGE_STYLE = { stroke: '#22c55e', strokeWidth: 2 }
const END_EDGE_STYLE = { stroke: '#ef4444', strokeWidth: 2 }

const makeMarker = (color: string) => ({ type: MarkerType.ArrowClosed, color })

export default function WorkflowCanvas({
  template,
  selectedStep,
  onSelectStep,
  onAddStep,
  onDeleteStep,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    const stepNodes = template.steps.map((step, index) => ({
      id: `step-${step.stepNumber}`,
      type: 'stepNode',
      position: { x: index * NODE_SPACING_X + NODE_OFFSET_X, y: NODE_Y },
      data: {
        step,
        isSelected: selectedStep?.stepNumber === step.stepNumber,
        onDelete: onDeleteStep,
      },
    }))

    const lastStepX = Math.max(0, template.steps.length - 1) * NODE_SPACING_X + NODE_OFFSET_X

    setNodes([
      { id: 'start', type: 'startNode', position: { x: 0, y: START_END_Y }, data: {} },
      ...stepNodes,
      { id: 'end', type: 'endNode', position: { x: lastStepX + END_NODE_OFFSET, y: START_END_Y }, data: {} },
    ])
  }, [template.steps, selectedStep, onDeleteStep, setNodes])

  useEffect(() => {
    const stepEdges: Edge[] = template.steps.slice(0, -1).map((step, index) => ({
      id: `edge-${step.stepNumber}-${template.steps[index + 1].stepNumber}`,
      source: `step-${step.stepNumber}`,
      target: `step-${template.steps[index + 1].stepNumber}`,
      type: 'smoothstep',
      style: EDGE_STYLE,
      markerEnd: makeMarker('#9ca3af'),
    }))

    const firstStep = template.steps[0]
    const lastStep = template.steps[template.steps.length - 1]

    setEdges([
      {
        id: 'edge-start',
        source: 'start',
        target: firstStep ? `step-${firstStep.stepNumber}` : 'end',
        type: 'smoothstep',
        style: START_EDGE_STYLE,
        markerEnd: makeMarker('#22c55e'),
      },
      ...stepEdges,
      ...(lastStep ? [{
        id: 'edge-end',
        source: `step-${lastStep.stepNumber}`,
        target: 'end',
        type: 'smoothstep',
        style: END_EDGE_STYLE,
        markerEnd: makeMarker('#ef4444'),
      }] : []),
    ])
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
          style: EDGE_STYLE,
          markerEnd: makeMarker('#9ca3af'),
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
