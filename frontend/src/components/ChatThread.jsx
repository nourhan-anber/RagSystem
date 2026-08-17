import { useEffect, useRef } from 'react'
import { Message } from './Message'

export function ChatThread({ messages, onRetry }) {
  const endRef = useRef(null)

  // Keep the newest text in view while an answer streams in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div className="thread">
      <div className="thread__inner">
        {messages.map((message) => (
          <Message key={message.id} message={message} onRetry={onRetry} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
