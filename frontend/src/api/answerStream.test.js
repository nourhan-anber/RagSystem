import { describe, test, expect, vi } from 'vitest'
import { streamAnswer } from './answerStream'

// Builds a fetch-like Response whose body streams the given text chunks.
function streamingResponse(chunks, { ok = true, status = 200 } = {}) {
  const encoder = new TextEncoder()
  return {
    ok,
    status,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    }),
    text: async () => chunks.join(''),
  }
}

async function collect(iterable) {
  const out = []
  for await (const item of iterable) out.push(item)
  return out
}

describe('streamAnswer', () => {
  test('yields each protocol event in the order the server sent it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      streamingResponse([
        'data: {"type":"sources","value":[{"text":"chunk"}]}\n\n',
        'data: {"type":"token","value":"Hello"}\n\n',
        'data: {"type":"token","value":" world"}\n\n',
        'data: {"type":"done"}\n\n',
      ])
    )

    const events = await collect(
      streamAnswer({ projectId: 'proj1', text: 'hi', fetchImpl })
    )

    expect(events).toEqual([
      { type: 'sources', value: [{ text: 'chunk' }] },
      { type: 'token', value: 'Hello' },
      { type: 'token', value: ' world' },
      { type: 'done' },
    ])
  })

  test('reassembles an event split across chunk boundaries', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(streamingResponse(['data: {"type":"tok', 'en","value":"split"}\n\n']))

    const events = await collect(
      streamAnswer({ projectId: 'proj1', text: 'hi', fetchImpl })
    )

    expect(events).toEqual([{ type: 'token', value: 'split' }])
  })

  test('posts the question and history to the workspace answer endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(streamingResponse(['data: {"type":"done"}\n\n']))
    const history = [{ role: 'user', text: 'earlier' }]

    await collect(
      streamAnswer({ projectId: 'proj1', text: 'why?', history, limit: 7, fetchImpl })
    )

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/v1/nlp/answer/proj1')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ text: 'why?', history, limit: 7 })
  })

  test('reports a failed response as an error event instead of throwing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(streamingResponse(['boom'], { ok: false, status: 500 }))

    const events = await collect(
      streamAnswer({ projectId: 'proj1', text: 'hi', fetchImpl })
    )

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('error')
    expect(events[0].message).toMatch(/500/)
  })

  test('reports a network failure as an error event', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))

    const events = await collect(
      streamAnswer({ projectId: 'proj1', text: 'hi', fetchImpl })
    )

    expect(events).toEqual([{ type: 'error', message: 'offline' }])
  })

  test('surfaces a server-sent error event', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      streamingResponse([
        'data: {"type":"token","value":"partial"}\n\n',
        'data: {"type":"error","message":"llm unavailable"}\n\n',
      ])
    )

    const events = await collect(
      streamAnswer({ projectId: 'proj1', text: 'hi', fetchImpl })
    )

    expect(events[1]).toEqual({ type: 'error', message: 'llm unavailable' })
  })

  test('ends quietly when the caller aborts the request', async () => {
    const controller = new AbortController()
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchImpl = vi.fn().mockRejectedValue(abortError)

    const events = await collect(
      streamAnswer({ projectId: 'proj1', text: 'hi', signal: controller.signal, fetchImpl })
    )

    expect(events).toEqual([])
  })
})
