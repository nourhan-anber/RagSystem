import { describe, test, expect, vi } from 'vitest'
import { createApi } from './client'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

describe('createApi', () => {
  test('lists workspaces from the projects endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ projects: [{ project_id: 'abc', project_name: 'Research' }] })
    )

    const workspaces = await createApi({ fetchImpl }).listWorkspaces()

    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/data/projects')
    expect(workspaces).toEqual([{ id: 'abc', name: 'Research' }])
  })

  test('falls back to the project id when a workspace has no name', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ projects: [{ project_id: '1' }] }))

    const workspaces = await createApi({ fetchImpl }).listWorkspaces()

    expect(workspaces).toEqual([{ id: '1', name: '1' }])
  })

  test('creates a workspace by posting its display name', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ project: { project_id: 'x1', project_name: 'Papers' } }))

    const created = await createApi({ fetchImpl }).createWorkspace('Papers')

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/v1/data/projects')
    expect(JSON.parse(options.body)).toEqual({ name: 'Papers' })
    expect(created).toEqual({ id: 'x1', name: 'Papers' })
  })

  test('uploads a file as multipart form data to the workspace', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ file_id: 'f1', file_name: 'notes.txt', chunks: 12 }))
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    const result = await createApi({ fetchImpl }).ingestFile('proj1', file)

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/v1/data/ingest/proj1')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBe(file)
    expect(result).toEqual({ id: 'f1', name: 'notes.txt', chunks: 12 })
  })

  test('translates a backend signal into a readable error message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ signal: 'file_type_not_supported' }, { ok: false, status: 400 })
    )
    const file = new File(['x'], 'photo.png', { type: 'image/png' })

    await expect(createApi({ fetchImpl }).ingestFile('proj1', file)).rejects.toThrow(
      'This file type is not supported'
    )
  })

  test('reports an unrecognised failure with its status code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }))

    await expect(createApi({ fetchImpl }).listWorkspaces()).rejects.toThrow('503')
  })
})
