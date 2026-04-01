'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2 } from 'lucide-react'
import { FeedbackWidget } from '@/components/FeedbackWidget'

type Session = {
  id: string
  session_date: string
  status: string
  notes: any
  created_at: string
  audio_path: string | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    complete: { label: 'Complete', cls: 'bg-[#0f2318] text-[#4ade80] border-[#1a3a25]' },
    analyzing: { label: 'Analyzing…', cls: 'bg-[#1a1730] text-[#a78bfa] border-[#312e81]' },
    transcribing: { label: 'Transcribing…', cls: 'bg-[#1a1730] text-[#818cf8] border-[#312e81]' },
    uploading: { label: 'Uploading…', cls: 'bg-[#1a1200] text-[#facc15] border-[#3a2e00]' },
    error: { label: 'Error', cls: 'bg-[#2a0a0a] text-[#f87171] border-[#3a1515]' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-[#1a1a1a] text-[#888] border-[#2a2a2a]' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchSessions() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        router.replace('/')
        return
      }

      const { data, error: fetchError } = await sb
        .from('sessions')
        .select('id, session_date, status, notes, created_at, audio_path')
        .order('session_date', { ascending: false })

      if (fetchError) {
        setError('Failed to load sessions. Please refresh.')
      } else {
        setSessions(data ?? [])
      }
      setLoading(false)
    }
    fetchSessions()
  }, [])

  async function handleDelete(session: Session) {
    const confirmed = confirm('Delete this session?')
    if (!confirmed) return

    // Optimistically remove from list
    setSessions((prev) => prev.filter((s) => s.id !== session.id))

    const sb = createClient()

    // Delete audio from storage if path exists
    if (session.audio_path) {
      await sb.storage.from('session-audio').remove([session.audio_path])
    }

    // Delete session row
    const { error: deleteError } = await sb
      .from('sessions')
      .delete()
      .eq('id', session.id)

    if (deleteError) {
      console.error('Failed to delete session:', deleteError)
      // Re-fetch to restore state if delete failed
      const { data } = await sb
        .from('sessions')
        .select('id, session_date, status, notes, created_at, audio_path')
        .order('session_date', { ascending: false })
      setSessions(data ?? [])
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/sessions" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Clarity</span>
            <span className="text-xs text-[#888] bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#2a2a2a]">beta</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/sessions" className="text-sm text-white transition-colors">Sessions</Link>
            <Link href="/record" className="text-sm text-[#888] hover:text-white transition-colors">Record</Link>
            <Link href="/journal" className="text-sm text-[#888] hover:text-white transition-colors">Journal</Link>
            <Link href="/chat" className="text-sm text-[#888] hover:text-white transition-colors">Chat</Link>
            <Link href="/prep" className="text-sm text-[#888] hover:text-white transition-colors">Prep</Link>
            <Link href="/billing" className="text-sm text-[#888] hover:text-white transition-colors">Billing</Link>
            <form action="/api/auth/signout" method="POST">
              <button className="text-sm text-[#666] hover:text-[#888] transition-colors">Sign out</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Sessions</h1>
            <p className="text-[#666] text-sm mt-1">Your therapy session history</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/prep"
              className="text-sm text-[#888] hover:text-white border border-[#2a2a2a] hover:border-[#444] px-4 py-2 rounded-xl transition-all"
            >
              Prep for next →
            </Link>
            <Link
              href="/record"
              className="bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              + New session
            </Link>
          </div>
        </div>

        {/* Session list */}
        {loading && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-[#2a0a0a] border border-[#3a1515] rounded-xl p-4 text-[#f87171] text-sm mb-6">
            {error}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-24">
            <div className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">No sessions yet</h2>
            <p className="text-[#666] text-sm mb-6">Record your first therapy session to get started.</p>
            <Link
              href="/record"
              className="inline-flex bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors"
            >
              Record a session
            </Link>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((s) => {
              const summary = s.notes?.summary as string | undefined
              const firstLine = summary ? summary.split('.')[0] + '.' : null
              return (
                <div key={s.id} className="relative group">
                  <Link
                    href={s.status === 'complete' ? `/sessions/${s.id}` : '#'}
                    className={`block bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 transition-all ${s.status === 'complete' ? 'hover:border-[#2a2a2a] cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <StatusBadge status={s.status} />
                          <span className="text-[#666] text-xs">{formatDate(s.session_date)}</span>
                        </div>
                        {firstLine && (
                          <p className="text-[#aaa] text-sm leading-relaxed truncate">{firstLine}</p>
                        )}
                        {!firstLine && s.status !== 'complete' && (
                          <p className="text-[#555] text-sm italic">Processing…</p>
                        )}
                      </div>
                      {s.status === 'complete' && (
                        <svg className="w-5 h-5 text-[#555] flex-shrink-0 mt-0.5 mr-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </Link>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDelete(s)
                    }}
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-[#444] hover:text-[#f87171] hover:bg-[#2a0a0a] transition-all opacity-0 group-hover:opacity-100"
                    title="Delete session"
                    aria-label="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <FeedbackWidget />
    </main>
  )
}
