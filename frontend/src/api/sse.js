/**
 * Incremental Server-Sent Events decoder.
 *
 * A streamed response arrives in arbitrary chunks, so a single frame may be
 * split across several reads. The decoder buffers whatever is incomplete and
 * only emits frames once their terminating blank line has been seen.
 */
export function createSSEDecoder() {
  let buffer = ''

  function parseFrame(raw) {
    let event = 'message'
    const dataLines = []

    for (const line of raw.split('\n')) {
      if (line === '' || line.startsWith(':')) continue

      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      let value = colon === -1 ? '' : line.slice(colon + 1)

      // A single leading space after the colon is part of the framing, not the value.
      if (value.startsWith(' ')) value = value.slice(1)

      if (field === 'event') event = value
      else if (field === 'data') dataLines.push(value)
    }

    if (dataLines.length === 0) return null
    return { event, data: dataLines.join('\n') }
  }

  return {
    push(chunk) {
      buffer += chunk.replace(/\r\n/g, '\n')

      const events = []
      let boundary = buffer.indexOf('\n\n')

      while (boundary !== -1) {
        const frame = parseFrame(buffer.slice(0, boundary))
        if (frame) events.push(frame)

        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
      }

      return events
    },

    // An unterminated trailing frame is incomplete data, so it is discarded.
    flush() {
      buffer = ''
      return []
    },
  }
}
