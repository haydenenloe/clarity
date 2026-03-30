'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface PrepBrief {
  lastSessionRecap: string
  patterns: string[]
  suggestedAgenda: string[]
  questionsToExplore: string[]
}

export default function PrepPage() {
  const [brief, setBrief] = useState<PrepBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionCount, setSessionCount] = useState(0)

  async function generateBrief() {
    const supabase = createClient()
    setLoading(true)
    setError(null)

    try {
      // Fetch last 3 completed sessions
      const { data: sessions, error: fetchErr } = await supabase
        .from('sessions')
        .select('session_date, notes')
        .eq('status', 'complete')
        .order('session_date', { ascending: false })
        .limit(3)

      if (fetchErr) throw fetchErr
      if (!sessions || sessions.length === 0) {
        setError('No completed sessions found. Record and analyze some sessions first.')
        setLoading(false)
        return
      }

      setSessionCount(sessions.length)

      // Build notes summary for Claude
      const notesContext = sessions.map((s, i) => {
        const date = new Date(s.session_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        const n = s.notes as any
        return `Session ${i + 1} (${date}):
Summary: ${n?.summary || 'N/A'}
Key Themes: ${(n?.keyThemes || []).join(', ') || 'N/A'}
Working On: ${(n?.workingOn || []).join('; ') || 'N/A'}
Action Items: ${(n?.actionItems || []).join('; ') || 'N/A'}
Breakthroughs: ${(n?.breakthroughs || []).join('; ') || 'N/A'}
Bring Up Next: ${(n?.bringUpNext || []).join('; ') || 'N/A'}
Emotional Patterns: ${(n?.emotionalPatterns || []).join('; ') || 'N/A'}`
      }).join('\n\n---\n\n')

      // Call our prep API
      const res = await fetch('/api/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notesContext }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate brief')
      }

      const data = await res.json()
      setBrief(data.brief)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generateBrief()
  }, [])

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/sessions" className="text-sm text-[#888] hover:text-white transition-colors">
            ← Sessions
          </Link>
          <span className="text-sm font-medium">Pre-session Brief</span>
          <button
            onClick={generateBrief}
            disabled={loading}
            className="text-sm text-[#888] hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating…' : '↻ Regenerate'}
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Your Pre-Session Brief</h1>
          <p className="text-[#666] text-sm">
            {sessionCount > 0 ? `Generated from your last ${sessionCount} session${sessionCount > 1 ? 's' : ''}` : 'Analyzing your session history…'}
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#666] text-sm">Analyzing your sessions…</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="bg-[#2a0a0a] border border-[#3a1515] rounded-2xl p-6 text-center">
            <p className="text-[#f87171] text-sm mb-4">{error}</p>
            {error.includes('No completed sessions') ? (
              <Link href="/record" className="inline-flex bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                Record a session →
              </Link>
            ) : (
              <button
                onClick={generateBrief}
                className="text-sm text-[#888] hover:text-white border border-[#2a2a2a] px-4 py-2 rounded-xl transition-all"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {brief && !loading && (
          <div className="space-y-8">
            {/* Last session recap */}
            {brief.lastSessionRecap && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Last Session Recap</h2>
                <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6">
                  <p className="text-[#ccc] text-sm leading-relaxed">{brief.lastSessionRecap}</p>
                </div>
              </section>
            )}

            {/* Patterns */}
            {brief.patterns && brief.patterns.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Patterns Across Sessions</h2>
                <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6 space-y-3">
                  {brief.patterns.map((p, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-[#888] flex-shrink-0 text-xs mt-1">◆</span>
                      <span className="text-[#ccc] text-sm leading-relaxed">{p}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Suggested agenda */}
            {brief.suggestedAgenda && brief.suggestedAgenda.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Suggested Agenda</h2>
                <div className="bg-[#0d0d1a] border border-[#1a1a3a] rounded-2xl p-6 space-y-3">
                  {brief.suggestedAgenda.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-[#818cf8] font-mono text-xs flex-shrink-0 mt-1">{String(i + 1).padStart(2, '0')}.</span>
                      <span className="text-[#c7d2fe] text-sm leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Questions to explore */}
            {brief.questionsToExplore && brief.questionsToExplore.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Questions to Bring In</h2>
                <div className="space-y-3">
                  {brief.questionsToExplore.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 bg-[#0d1a0d] border border-[#1a3a1a] rounded-xl p-4">
                      <span className="text-[#4ade80] flex-shrink-0 text-sm">?</span>
                      <span className="text-[#86efac] text-sm leading-relaxed">{q}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
