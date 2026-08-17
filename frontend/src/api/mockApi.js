/**
 * In-memory stand-in for the backend, used when VITE_USE_MOCKS=true.
 *
 * It exists because /data/ingest, /data/projects and /nlp/answer are not built
 * yet. It mirrors the same contracts the real client speaks, so switching over
 * is a change of import, not a change of UI code.
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const MOCK_ANSWER =
  'Based on the documents in this workspace, the retrieval step found several passages that ' +
  'bear on your question.\n\n' +
  'The **key points** are:\n\n' +
  '1. The indexed chunks are embedded and matched by cosine similarity.\n' +
  '2. Only the top-scoring passages are passed to the model as context.\n' +
  '3. The model is instructed to answer strictly from those passages.\n\n' +
  'If the documents do not cover something, the answer will say so rather than guess.'

let workspaces = [
  { id: '1', name: 'Wiki notes' },
  { id: 'research', name: 'Research' },
]

let filesByWorkspace = {
  1: [{ id: 'f0', name: 'Wiki.txt', size: 18244 }],
  research: [],
}

let nextId = 100

export function createMockApi() {
  return {
    async listWorkspaces() {
      await delay(200)
      return [...workspaces]
    },

    async createWorkspace(name) {
      await delay(200)
      const workspace = { id: `w${nextId++}`, name }
      workspaces = [workspace, ...workspaces]
      filesByWorkspace[workspace.id] = []
      return workspace
    },

    async listFiles(projectId) {
      await delay(150)
      return [...(filesByWorkspace[projectId] ?? [])]
    },

    async ingestFile(projectId, file) {
      await delay(900)

      if (file.name.endsWith('.exe')) {
        throw new Error('This file type is not supported. Upload a .txt or .pdf file.')
      }

      const record = { id: `f${nextId++}`, name: file.name, size: file.size, chunks: 24 }
      filesByWorkspace[projectId] = [...(filesByWorkspace[projectId] ?? []), record]
      return record
    },
  }
}

export async function* mockStreamAnswer({ projectId, signal }) {
  await delay(600)
  if (signal?.aborted) return

  const files = filesByWorkspace[projectId] ?? []

  if (files.length === 0) {
    yield { type: 'sources', value: [] }
    for (const word of 'There are no indexed documents in this workspace yet. Upload a file to ask questions about it.'.split(
      ' '
    )) {
      await delay(30)
      yield { type: 'token', value: `${word} ` }
    }
    yield { type: 'done' }
    return
  }

  yield {
    type: 'sources',
    value: files.slice(0, 3).flatMap((file, index) => [
      {
        text:
          'The system splits each document into overlapping chunks before embedding them, ' +
          'so that retrieval returns passages rather than whole files.',
        score: 0.82 - index * 0.07,
        file: file.name,
      },
    ]),
  }

  for (const word of MOCK_ANSWER.split(' ')) {
    if (signal?.aborted) return
    await delay(28)
    yield { type: 'token', value: `${word} ` }
  }

  yield { type: 'done' }
}
