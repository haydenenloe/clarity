'use client'
import { useState } from 'react'
import { MessageSquare, X, Send } from 'lucide-react'

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'bug' | 'idea' | 'question'>('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!message.trim()) return
    setLoading(true)
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, email, url: window.location.href }),
    })
    setLoading(false)
    setSent(true)
    setTimeout(() => { setOpen(false); setSent(false); setMessage(''); }, 2000)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-2xl p-5">
          {sent ? (
            <p className="text-sm text-[#4ade80] text-center py-4">Thanks — we got it.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-white">Send feedback</span>
                <button onClick={() => setOpen(false)}><X size={16} className="text-[#555]" /></button>
              </div>
              <div className="flex gap-2 mb-4">
                {(['bug', 'idea', 'question'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors capitalize ${
                      type === t
                        ? 'bg-[#6366f1] border-[#6366f1] text-white'
                        : 'border-[#2a2a2a] text-[#666] hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#555] resize-none mb-3 focus:outline-none focus:border-[#6366f1]"
                rows={3}
                placeholder={type === 'bug' ? 'What went wrong?' : type === 'idea' ? 'What would make this better?' : 'What do you need help with?'}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
              <input
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white placeholder-[#555] mb-3 focus:outline-none focus:border-[#6366f1]"
                placeholder="Email (optional)"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <button
                onClick={submit}
                disabled={loading || !message.trim()}
                className="w-full bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Send size={14} />
                {loading ? 'Sending...' : 'Send'}
              </button>
            </>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 bg-[#6366f1] hover:bg-[#818cf8] rounded-full flex items-center justify-center shadow-lg shadow-indigo-900/40 transition-colors"
      >
        {open ? <X size={18} className="text-white" /> : <MessageSquare size={18} className="text-white" />}
      </button>
    </div>
  )
}
