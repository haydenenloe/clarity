'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: "Hi! I have access to all your session notes and journal entries. Ask me anything — patterns you're noticing, what you've been working on, how you're progressing, or what to focus on next.",
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  useEffect(() => {
    // Auth check
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/')
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const history = newMessages.slice(1) // exclude welcome message for history
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.slice(0, -1), // all but the just-added user message
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to get response')
      }

      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      // Remove the user message we optimistically added on error
      setMessages(messages)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function newConversation() {
    setMessages([WELCOME_MESSAGE])
    setInput('')
    setError(null)
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/sessions" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Clarity</span>
            <span className="text-xs text-[#888] bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#2a2a2a]">beta</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/sessions" className="text-sm text-[#888] hover:text-white transition-colors">Sessions</Link>
            <Link href="/record" className="text-sm text-[#888] hover:text-white transition-colors">Record</Link>
            <Link href="/journal" className="text-sm text-[#888] hover:text-white transition-colors">Journal</Link>
            <Link href="/chat" className="text-sm text-white transition-colors">Chat</Link>
            <Link href="/prep" className="text-sm text-[#888] hover:text-white transition-colors">Prep</Link>
            <Link href="/billing" className="text-sm text-[#888] hover:text-white transition-colors">Billing</Link>
          </div>
        </div>
      </nav>

      {/* Chat container */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pb-4 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between py-4 flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold">Chat</h1>
            <p className="text-xs text-[#555]">Ask about your sessions, patterns, and progress</p>
          </div>
          <button
            onClick={newConversation}
            className="text-xs text-[#666] hover:text-[#aaa] border border-[#2a2a2a] hover:border-[#444] px-3 py-1.5 rounded-lg transition-all"
          >
            New conversation
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ minHeight: 0 }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-[#1a1730] border border-[#312e81] flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-0.5">
                  ✦
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#6366f1] text-white rounded-br-sm'
                    : 'bg-[#111] border border-[#1f1f1f] text-[#ddd] rounded-bl-sm'
                }`}
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-[#1a1730] border border-[#312e81] flex items-center justify-center text-xs mr-2 flex-shrink-0">
                ✦
              </div>
              <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <p className="text-[#f87171] text-xs bg-[#2a0a0a] border border-[#3a1515] px-3 py-2 rounded-lg">
                {error}
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-[#1f1f1f] pt-4">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your sessions…"
              rows={1}
              disabled={loading}
              className="flex-1 bg-[#111] border border-[#2a2a2a] focus:border-[#4a4a6a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#444] resize-none outline-none transition-colors disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-xl bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-[#333] text-center mt-2">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </main>
  )
}
