import { useCallback, useEffect, useReducer, useRef } from 'react'
import { askQuestion } from '../api'
import { chatReducer, initialChatState } from './chatReducer'

let sequence = 0
const nextId = () => `m${++sequence}`

/**
 * Owns one conversation thread for one workspace. The thread lives only in
 * memory: switching workspace or reloading starts a fresh thread, while the
 * indexed documents stay on the server.
 */
export function useChat(projectId) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)
  const abortRef = useRef(null)
  const messagesRef = useRef(state.messages)
  messagesRef.current = state.messages

  useEffect(() => {
    abortRef.current?.abort()
    dispatch({ type: 'reset' })
  }, [projectId])

  // Abort any in-flight answer when the view goes away.
  useEffect(() => () => abortRef.current?.abort(), [])

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!trimmed) return

      // Only settled turns are context; the pending reply is not part of history.
      const history = messagesRef.current
        .filter((m) => m.role === 'user' || m.status === 'complete')
        .map((m) => ({ role: m.role, text: m.text }))

      dispatch({ type: 'ask', text: trimmed, userId: nextId(), replyId: nextId() })

      const controller = new AbortController()
      abortRef.current = controller

      try {
        for await (const event of askQuestion({
          projectId,
          text: trimmed,
          history,
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) break
          dispatch(event)
        }
      } catch (err) {
        dispatch({ type: 'error', message: err.message })
      } finally {
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [projectId]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    dispatch({ type: 'done' })
  }, [])

  return { messages: state.messages, isStreaming: state.isStreaming, send, stop }
}
