import { createSSEDecoder } from './sse'

/**
 * Streams an answer for one question as an async iterable of protocol events:
 *
 *   { type: 'sources', value: [...] }   retrieved chunks, sent before generation
 *   { type: 'token',   value: '...' }   one delta of the answer
 *   { type: 'done' }                    generation finished
 *   { type: 'error',   message: '...' } generation or transport failed
 *
 * Transport failures are yielded as error events rather than thrown, so the UI
 * has one place to handle every way an answer can fail. A caller-triggered
 * abort ends the iteration silently, since the user asked for it.
 */
export async function* streamAnswer({
  projectId,
  text,
  history = [],
  limit = 5,
  signal,
  fetchImpl = fetch,
}) {
  let response
  try {
    response = await fetchImpl(`/api/v1/nlp/answer/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ text, history, limit }),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') return
    yield { type: 'error', message: err.message }
    return
  }

  if (!response.ok) {
    yield { type: 'error', message: `Request failed (${response.status})` }
    return
  }

  const decoder = createSSEDecoder()
  const utf8 = new TextDecoder()
  const reader = response.body.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      for (const frame of decoder.push(utf8.decode(value, { stream: true }))) {
        let event
        try {
          event = JSON.parse(frame.data)
        } catch {
          yield { type: 'error', message: 'Malformed response from server' }
          return
        }
        yield event
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return
    yield { type: 'error', message: err.message }
  } finally {
    decoder.flush()
    reader.releaseLock()
  }
}
