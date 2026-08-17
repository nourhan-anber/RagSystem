// The backend answers with a `signal` enum on failure (see models/enums/ResponseEnums.py).
// Anything not listed here falls back to the HTTP status, so new signals are never silent.
const SIGNAL_MESSAGES = {
  file_type_not_supported: 'This file type is not supported. Upload a .txt or .pdf file.',
  file_size_exceeded: 'This file is too large.',
  file_upload_failed: 'The file could not be uploaded. Try again.',
  processing_failed: 'The file was uploaded but could not be read.',
  not_found_files: 'There are no files in this workspace yet.',
  no_file_found_with_this_id: 'That file is no longer available.',
  project_not_found: 'That workspace no longer exists.',
  insert_into_vectordb_error: 'The file could not be indexed for search.',
  vectordb_search_error: 'Search failed for this workspace.',
  rag_answer_error: 'An answer could not be generated.',
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

async function request(fetchImpl, url, options) {
  const response = await fetchImpl(url, options)
  const body = await readJson(response)

  if (!response.ok) {
    const message = SIGNAL_MESSAGES[body.signal] ?? `Request failed (${response.status})`
    throw new Error(message)
  }

  return body
}

const toWorkspace = (project) => ({
  id: project.project_id,
  name: project.project_name || project.project_id,
})

export function createApi({ fetchImpl = fetch } = {}) {
  return {
    async listWorkspaces() {
      const body = await request(fetchImpl, '/api/v1/data/projects')
      return (body.projects ?? []).map(toWorkspace)
    },

    async createWorkspace(name) {
      const body = await request(fetchImpl, '/api/v1/data/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      return toWorkspace(body.project)
    },

    async listFiles(projectId) {
      const body = await request(fetchImpl, `/api/v1/data/files/${projectId}`)
      return (body.files ?? []).map((file) => ({
        id: file.file_id,
        name: file.file_name,
        size: file.size,
      }))
    },

    async ingestFile(projectId, file) {
      const form = new FormData()
      form.append('file', file)

      const body = await request(fetchImpl, `/api/v1/data/ingest/${projectId}`, {
        method: 'POST',
        body: form,
      })

      return { id: body.file_id, name: body.file_name, chunks: body.chunks }
    },
  }
}
