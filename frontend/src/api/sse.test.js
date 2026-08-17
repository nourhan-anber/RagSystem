import { describe, test, expect } from 'vitest'
import { createSSEDecoder } from './sse'

describe('createSSEDecoder', () => {
  test('emits a frame when a blank line terminates it', () => {
    const decoder = createSSEDecoder()

    const events = decoder.push('data: {"type":"token"}\n\n')

    expect(events).toEqual([{ event: 'message', data: '{"type":"token"}' }])
  })

  test('withholds a frame until its terminating blank line arrives', () => {
    const decoder = createSSEDecoder()

    expect(decoder.push('data: {"type":"tok')).toEqual([])
    expect(decoder.push('en"}')).toEqual([])
    expect(decoder.push('\n\n')).toEqual([
      { event: 'message', data: '{"type":"token"}' },
    ])
  })

  test('emits every complete frame contained in one chunk', () => {
    const decoder = createSSEDecoder()

    const events = decoder.push('data: one\n\ndata: two\n\ndata: three\n\n')

    expect(events.map((e) => e.data)).toEqual(['one', 'two', 'three'])
  })

  test('joins repeated data fields with a newline', () => {
    const decoder = createSSEDecoder()

    const events = decoder.push('data: line one\ndata: line two\n\n')

    expect(events[0].data).toBe('line one\nline two')
  })

  test('reads the event name from the event field', () => {
    const decoder = createSSEDecoder()

    const events = decoder.push('event: sources\ndata: []\n\n')

    expect(events[0]).toEqual({ event: 'sources', data: '[]' })
  })

  test('ignores comment lines used as keepalives', () => {
    const decoder = createSSEDecoder()

    const events = decoder.push(': keepalive\n\ndata: real\n\n')

    expect(events.map((e) => e.data)).toEqual(['real'])
  })

  test('handles CRLF line endings', () => {
    const decoder = createSSEDecoder()

    const events = decoder.push('data: windows\r\n\r\n')

    expect(events[0].data).toBe('windows')
  })

  test('keeps only a single leading space off the data value', () => {
    const decoder = createSSEDecoder()

    const events = decoder.push('data:  two spaces\n\n')

    expect(events[0].data).toBe(' two spaces')
  })

  test('discards an unterminated trailing frame', () => {
    const decoder = createSSEDecoder()

    decoder.push('data: complete\n\ndata: truncated')

    expect(decoder.flush()).toEqual([])
  })
})
