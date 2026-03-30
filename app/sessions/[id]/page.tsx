import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface SessionNotes {
  summary?: string
  keyThemes?: string[]
  workingOn?: string[]
  actionItems?: string[]
  breakthroughs?: string[]
  bringUpNext?: string[]
  emotionalPatterns?: string[]
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !session) notFound()
  if (session.status !== 'complete') redirect('/sessions')

  const notes: SessionNotes = session.notes || {}
  const date = new Date(session.session_date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/sessions" className="flex items-center gap-2 text-[#888] hover:text-white transition-colors text-sm">
            ← Sessions
          </Link>
          <Link href="/prep" className="text-sm text-[#888] hover:text-white transition-colors">
            Prep brief →
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[#666] text-sm mb-1">Session notes</p>
          <h1 className="text-3xl font-bold">{date}</h1>
        </div>

        <div className="space-y-8">
          {/* Summary */}
          {notes.summary && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Summary</h2>
              <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6">
                {notes.summary.split('\n\n').map((para, i) => (
                  <p key={i} className={`text-[#ccc] leading-relaxed text-sm ${i > 0 ? 'mt-3' : ''}`}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {/* Key Themes */}
          {notes.keyThemes && notes.keyThemes.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Key Themes</h2>
              <div className="flex flex-wrap gap-2">
                {notes.keyThemes.map((theme, i) => (
                  <span key={i} className="bg-[#1a1730] text-[#a78bfa] border border-[#312e81] px-3 py-1.5 rounded-full text-sm">
                    {theme}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Working On */}
          {notes.workingOn && notes.workingOn.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">What I&apos;m Working On</h2>
              <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6 space-y-3">
                {notes.workingOn.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-4 h-4 rounded border border-[#2a2a2a] mt-0.5 flex-shrink-0" />
                    <span className="text-[#ccc] text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Action Items */}
          {notes.actionItems && notes.actionItems.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Action Items</h2>
              <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6 space-y-3">
                {notes.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-4 h-4 rounded border border-[#2a2a2a] mt-0.5 flex-shrink-0 bg-[#1a1730] border-[#312e81]" />
                    <span className="text-[#ccc] text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Breakthroughs */}
          {notes.breakthroughs && notes.breakthroughs.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Breakthroughs & Insights</h2>
              <div className="space-y-3">
                {notes.breakthroughs.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#0d1a0d] border border-[#1a3a1a] rounded-xl p-4">
                    <span className="text-lg flex-shrink-0">💡</span>
                    <span className="text-[#86efac] text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bring Up Next Time */}
          {notes.bringUpNext && notes.bringUpNext.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Bring Up Next Time</h2>
              <div className="bg-[#0d0d1a] border border-[#1a1a3a] rounded-2xl p-6 space-y-3">
                {notes.bringUpNext.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[#818cf8] flex-shrink-0 mt-0.5">→</span>
                    <span className="text-[#c7d2fe] text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Emotional Patterns */}
          {notes.emotionalPatterns && notes.emotionalPatterns.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#666] mb-4">Emotional Patterns</h2>
              <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6 space-y-2">
                {notes.emotionalPatterns.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[#888] flex-shrink-0 text-xs mt-1">◆</span>
                    <span className="text-[#aaa] text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Bottom actions */}
        <div className="mt-12 pt-8 border-t border-[#1a1a1a] flex gap-3">
          <Link
            href="/sessions"
            className="text-sm text-[#888] hover:text-white border border-[#2a2a2a] hover:border-[#444] px-4 py-2 rounded-xl transition-all"
          >
            ← All sessions
          </Link>
          <Link
            href="/prep"
            className="text-sm bg-[#6366f1] hover:bg-[#818cf8] text-white font-medium px-4 py-2 rounded-xl transition-colors"
          >
            Prep for next session →
          </Link>
        </div>
      </div>
    </main>
  )
}
