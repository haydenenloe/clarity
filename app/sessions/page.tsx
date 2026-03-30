import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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

export default async function SessionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, session_date, status, notes, created_at')
    .order('session_date', { ascending: false })

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
          <div className="flex items-center gap-3">
            <Link href="/prep" className="text-sm text-[#888] hover:text-white transition-colors">
              Prep brief
            </Link>
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
        {error && (
          <div className="bg-[#2a0a0a] border border-[#3a1515] rounded-xl p-4 text-[#f87171] text-sm mb-6">
            Failed to load sessions. Please refresh.
          </div>
        )}

        {(!sessions || sessions.length === 0) ? (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">🎙️</div>
            <h2 className="text-xl font-semibold mb-2">No sessions yet</h2>
            <p className="text-[#666] text-sm mb-6">Record your first therapy session to get started.</p>
            <Link
              href="/record"
              className="inline-flex bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors"
            >
              Record a session
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const summary = s.notes?.summary as string | undefined
              const firstLine = summary ? summary.split('.')[0] + '.' : null
              return (
                <Link
                  key={s.id}
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
                      <svg className="w-5 h-5 text-[#555] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
