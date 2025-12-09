/**
 * api.ts
 * API client for fetching and persisting workflow data.
 */

import { WorkflowTemplate, CanonicalScreen } from './types'

const API_BASE = ''

export async function fetchTemplates(): Promise<WorkflowTemplate[]> {
  const response = await fetch(`${API_BASE}/templates`)
  if (!response.ok) throw new Error(`Failed to fetch templates: ${response.statusText}`)
  return response.json()
}

export async function fetchScreens(): Promise<CanonicalScreen[]> {
  const response = await fetch(`${API_BASE}/screens`)
  if (!response.ok) throw new Error(`Failed to fetch screens: ${response.statusText}`)
  return response.json()
}

export async function fetchInitialData(): Promise<[WorkflowTemplate[], CanonicalScreen[]]> {
  return Promise.all([fetchTemplates(), fetchScreens()])
}

export async function saveTemplate(template: WorkflowTemplate): Promise<void> {
  const response = await fetch(`${API_BASE}/templates/${template.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  })
  if (!response.ok) throw new Error(`Failed to save template: ${response.statusText}`)
}

