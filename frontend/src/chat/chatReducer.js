export const initialChatState = { messages: [], isStreaming: false }

/**
 * Applies a patch to the trailing assistant turn, but only while it is still
 * streaming. Events can arrive after a stream has been closed or aborted, and
 * those must not resurrect a finished turn.
 */
function patchStreamingReply(state, patch) {
  const last = state.messages[state.messages.length - 1]
  if (!last || last.role !== 'assistant' || last.status !== 'streaming') {
    return state
  }

  return {
    ...state,
    messages: [...state.messages.slice(0, -1), { ...last, ...patch(last) }],
  }
}

export function chatReducer(state, action) {
  switch (action.type) {
    case 'ask':
      return {
        ...state,
        isStreaming: true,
        messages: [
          ...state.messages,
          { id: action.userId, role: 'user', text: action.text },
          {
            id: action.replyId,
            role: 'assistant',
            text: '',
            sources: [],
            status: 'streaming',
            error: null,
          },
        ],
      }

    case 'token':
      return patchStreamingReply(state, (last) => ({ text: last.text + action.value }))

    case 'sources':
      return patchStreamingReply(state, () => ({ sources: action.value }))

    case 'done': {
      const next = patchStreamingReply(state, () => ({ status: 'complete' }))
      return { ...next, isStreaming: false }
    }

    case 'error': {
      const next = patchStreamingReply(state, () => ({
        status: 'error',
        error: action.message,
      }))
      return { ...next, isStreaming: false }
    }

    case 'reset':
      return initialChatState

    default:
      return state
  }
}
