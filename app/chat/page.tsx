'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface Conversation {
  id: string
  title: string
  updated_at: string
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const WELCOME_CONTENT =
  "Hi! I have access to all your session notes and journal entries. Ask me anything — patterns you're noticing, what you've been working on, how you're progressing, or what to focus on next."

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auth + initial load
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/')
        return
      }
      await loadConversations(user.id)
    })
  }, [])

  async function loadConversations(userId?: string) {
    setLoadingConvs(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = userId || user?.id
      if (!uid) return

      const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('id, title, updated_at')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false })

      if (convErr) throw convErr

      if (!convs || convs.length === 0) {
        // Create a first conversation
        const { data: newConv, error: createErr } = await supabase
          .from('conversations')
          .insert({ user_id: uid, title: 'New conversation' })
          .select('id, title, updated_at')
          .single()
        if (createErr) throw createErr
        setConversations([newConv])
        setActiveConvId(newConv.id)
        setMessages([])
      } else {
        setConversations(convs)
        setActiveConvId(convs[0].id)
        await loadMessages(convs[0].id)
      }
    } finally {
      setLoadingConvs(false)
    }
  }

  async function loadMessages(convId: string) {
    setLoadingMsgs(true)
    setMessages([])
    setError(null)
    try {
      const { data, error: msgErr } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })

      if (msgErr) throw msgErr
      setMessages((data as Message[]) || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingMsgs(false)
    }
  }

  async function selectConversation(convId: string) {
    if (convId === activeConvId) return
    setActiveConvId(convId)
    await loadMessages(convId)
    // On mobile, hide sidebar after selecting
    if (window.innerWidth < 768) setShowSidebar(false)
  }

  async function newConversation() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: 'New conversation' })
      .select('id, title, updated_at')
      .single()

    if (error || !newConv) return

    setConversations((prev) => [newConv, ...prev])
    setActiveConvId(newConv.id)
    setMessages([])
    setError(null)
    if (window.innerWidth < 768) setShowSidebar(false)
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading || !activeConvId) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setInput('')
    setLoading(true)
    setError(null)

    const isFirstMessage = messages.length === 0

    // Optimistic user message
    const optimisticUserMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, optimisticUserMsg])

    try {
      // 1. Insert user message to DB
      const { data: savedUserMsg, error: insertErr } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: activeConvId,
          user_id: user.id,
          role: 'user',
          content: text,
        })
        .select('id, role, content, created_at')
        .single()

      if (insertErr) throw insertErr

      // Update optimistic message with real id
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = savedUserMsg as Message
        return copy
      })

      // 2. Build history (last 20 messages)
      const { data: historyData } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: false })
        .limit(20)

      const history = (historyData || []).reverse()
      // Exclude the just-inserted user message from history
      const historyForApi = history.slice(0, -1)

      // 3. POST to /api/chat
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyForApi,
          conversationId: activeConvId,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to get response')
      }

      const data = await res.json()
      const replyContent = data.reply

      // 4. Insert assistant response to DB
      const { data: savedAssistantMsg, error: assistInsertErr } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: activeConvId,
          user_id: user.id,
          role: 'assistant',
          content: replyContent,
        })
        .select('id, role, content, created_at')
        .single()

      if (assistInsertErr) throw assistInsertErr

      setMessages((prev) => [...prev, savedAssistantMsg as Message])

      // 5. Update conversations.updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConvId)

      // 6. Auto-title on first message
      if (isFirstMessage) {
        const words = text.trim().split(/\s+/).slice(0, 6).join(' ')
        const newTitle = words + (text.trim().split(/\s+/).length > 6 ? '…' : '')
        await supabase
          .from('conversations')
          .update({ title: newTitle })
          .eq('id', activeConvId)

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvId
              ? { ...c, title: newTitle, updated_at: new Date().toISOString() }
              : c
          )
        )
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvId ? { ...c, updated_at: new Date().toISOString() } : c
          ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        )
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      // Rollback optimistic message
      setMessages((prev) => prev.filter((m) => m !== optimisticUserMsg))
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

  const activeConv = conversations.find((c) => c.id === activeConvId)

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
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

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>

        {/* LEFT SIDEBAR */}
        <div
          className={`
            flex-shrink-0 flex flex-col
            bg-[#0d0d0d] border-r border-[#1f1f1f]
            transition-all duration-200
            ${showSidebar ? 'w-64' : 'w-0 overflow-hidden'}
            md:w-64 md:overflow-visible
          `}
        >
          <div className="p-3 border-b border-[#1f1f1f] flex-shrink-0">
            <button
              onClick={newConversation}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a2e] hover:bg-[#22223a] border border-[#312e81] text-sm text-indigo-300 hover:text-indigo-200 transition-all"
            >
              <span className="text-base">＋</span>
              <span>New conversation</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {loadingConvs ? (
              <div className="px-3 py-8 flex items-center justify-center">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`
                    w-full text-left px-3 py-2.5 mx-0 flex flex-col gap-0.5
                    border-l-2 transition-all
                    hover:bg-[#161622]
                    ${conv.id === activeConvId
                      ? 'bg-[#1a1a2e] border-l-indigo-500 text-white'
                      : 'border-l-transparent text-[#888] hover:text-[#ccc]'
                    }
                  `}
                >
                  <span className="text-xs leading-snug line-clamp-1 font-medium">
                    {conv.title}
                  </span>
                  <span className="text-[10px] text-[#444]">
                    {getRelativeTime(conv.updated_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1f1f1f] flex-shrink-0">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setShowSidebar((v) => !v)}
              className="md:hidden text-[#666] hover:text-white p-1"
            >
              {showSidebar ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate">{activeConv?.title || 'Chat'}</h1>
              <p className="text-xs text-[#555]">Ask about your sessions, patterns, and progress</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ minHeight: 0 }}>
            {/* Welcome message — show only if no messages */}
            {!loadingMsgs && messages.length === 0 && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-[#1a1730] border border-[#312e81] flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-0.5">
                  ✦
                </div>
                <div
                  className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed bg-[#111] border border-[#1f1f1f] text-[#ddd]"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {WELCOME_CONTENT}
                </div>
              </div>
            )}

            {loadingMsgs ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={msg.id || i}
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
              ))
            )}

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
          <div className="flex-shrink-0 border-t border-[#1f1f1f] px-4 pt-3 pb-4">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your sessions…"
                rows={1}
                disabled={loading || loadingMsgs}
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
                disabled={!input.trim() || loading || loadingMsgs}
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
      </div>
    </main>
  )
}
