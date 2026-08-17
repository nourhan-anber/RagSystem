import { describe, test, expect } from 'vitest'
import { chatReducer, initialChatState } from './chatReducer'

// Drives the reducer through a sequence of actions, starting from empty.
function apply(actions, state = initialChatState) {
  return actions.reduce(chatReducer, state)
}

const ask = { type: 'ask', text: 'What does the report say?', userId: 'u1', replyId: 'a1' }

describe('chatReducer', () => {
  test('ask appends the user turn and an empty assistant turn', () => {
    const state = apply([ask])

    expect(state.messages).toEqual([
      { id: 'u1', role: 'user', text: 'What does the report say?' },
      { id: 'a1', role: 'assistant', text: '', sources: [], status: 'streaming', error: null },
    ])
  })

  test('ask marks the thread as streaming', () => {
    expect(apply([ask]).isStreaming).toBe(true)
  })

  test('tokens accumulate onto the streaming assistant turn in order', () => {
    const state = apply([
      ask,
      { type: 'token', value: 'The ' },
      { type: 'token', value: 'report ' },
      { type: 'token', value: 'says.' },
    ])

    expect(state.messages[1].text).toBe('The report says.')
  })

  test('sources attach to the streaming assistant turn', () => {
    const sources = [{ text: 'chunk one', score: 0.9 }]

    const state = apply([ask, { type: 'sources', value: sources }])

    expect(state.messages[1].sources).toEqual(sources)
  })

  test('done completes the assistant turn and ends streaming', () => {
    const state = apply([ask, { type: 'token', value: 'Hi' }, { type: 'done' }])

    expect(state.messages[1].status).toBe('complete')
    expect(state.isStreaming).toBe(false)
  })

  test('error preserves the partial answer already streamed', () => {
    const state = apply([
      ask,
      { type: 'token', value: 'The report sta' },
      { type: 'error', message: 'connection lost' },
    ])

    expect(state.messages[1]).toMatchObject({
      text: 'The report sta',
      status: 'error',
      error: 'connection lost',
    })
    expect(state.isStreaming).toBe(false)
  })

  test('a late token after done does not mutate the completed turn', () => {
    const state = apply([
      ask,
      { type: 'token', value: 'done text' },
      { type: 'done' },
      { type: 'token', value: ' STRAY' },
    ])

    expect(state.messages[1].text).toBe('done text')
  })

  test('reset clears the thread when switching workspace', () => {
    const state = apply([ask, { type: 'token', value: 'hi' }, { type: 'reset' }])

    expect(state).toEqual(initialChatState)
  })

  test('a second question keeps the earlier turns', () => {
    const state = apply([
      ask,
      { type: 'token', value: 'first answer' },
      { type: 'done' },
      { type: 'ask', text: 'why?', userId: 'u2', replyId: 'a2' },
    ])

    expect(state.messages.map((m) => m.id)).toEqual(['u1', 'a1', 'u2', 'a2'])
    expect(state.messages[1].text).toBe('first answer')
  })

  test('does not mutate the previous state object', () => {
    const before = apply([ask])
    const snapshot = JSON.parse(JSON.stringify(before))

    chatReducer(before, { type: 'token', value: 'mutation?' })

    expect(before).toEqual(snapshot)
  })
})
