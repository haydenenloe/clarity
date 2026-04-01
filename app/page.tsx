'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Brain, RefreshCw, ClipboardList, Mic, FileText, BookOpen, Check } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const featuresRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/sessions')
    })
  }, [router])

  function scrollToFeatures() {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Sticky Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#1f1f1f] px-6 py-4 backdrop-blur-md bg-[#0a0a0a]/80">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">Clarity</span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-[#888] hover:text-white transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-[#6366f1] hover:bg-[#818cf8] text-white font-medium px-4 py-2 rounded-xl transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#a78bfa] bg-[#1a1730] border border-[#312e81] px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
          Now in beta
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight text-balance mb-6">
          Stop forgetting what
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#818cf8] via-[#a78bfa] to-[#c4b5fd]">
            matters in therapy.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-[#888] max-w-2xl mx-auto leading-relaxed mb-12 text-balance">
          Clarity records your sessions, extracts the insights, and makes sure you walk into every appointment prepared.{' '}
          <span className="text-[#ccc]">Your therapist only has 50 minutes. Make them count.</span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link
            href="/signup"
            className="w-full sm:w-auto bg-[#6366f1] hover:bg-[#818cf8] text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base shadow-lg shadow-indigo-900/30"
          >
            Start free — no credit card
          </Link>
          <button
            onClick={scrollToFeatures}
            className="w-full sm:w-auto text-[#888] hover:text-white border border-[#2a2a2a] hover:border-[#444] font-medium px-8 py-4 rounded-xl transition-all text-base"
          >
            See how it works
          </button>
        </div>

        {/* Mockup card */}
        <div className="max-w-2xl mx-auto bg-[#111] border border-[#1f1f1f] rounded-2xl p-6 text-left shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Session Notes</div>
              <div className="text-sm font-semibold text-white">March 28, 2026</div>
            </div>
            <span className="text-xs text-[#4ade80] bg-[#0f2318] border border-[#1a3a25] px-2 py-0.5 rounded-full">Complete</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-[#6366f1] uppercase tracking-widest mb-2">Key Themes</div>
              <div className="flex flex-wrap gap-2">
                {['Anxiety around work', 'Boundary setting', 'Family dynamics'].map(t => (
                  <span key={t} className="text-xs text-[#aaa] bg-[#1a1a2e] border border-[#2a2a4a] px-2.5 py-1 rounded-lg">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#a78bfa] uppercase tracking-widest mb-2">Action Items</div>
              <ul className="space-y-1.5">
                {[
                  'Practice saying "no" to one non-urgent request this week',
                  'Journal about the conversation with mom on Sunday',
                  'Try the 5-4-3-2-1 grounding exercise before Monday standup',
                ].map(a => (
                  <li key={a} className="text-xs text-[#888] flex items-start gap-2">
                    <Check className="text-[#4ade80] mt-0.5 flex-shrink-0 w-3 h-3" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#f59e0b] uppercase tracking-widest mb-2">Breakthrough</div>
              <p className="text-xs text-[#888] leading-relaxed">
                &ldquo;I realized I&apos;ve been equating being busy with being worthy. That&apos;s the core of the overcommitment pattern.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Therapy is powerful.
            <span className="text-[#555]"> But the hour ends.</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: <Brain className="w-6 h-6 text-[#a78bfa]" />,
              text: 'You forget 80% of what you talked about by next week',
            },
            {
              icon: <RefreshCw className="w-6 h-6 text-[#818cf8]" />,
              text: 'You repeat the same issues session after session',
            },
            {
              icon: <ClipboardList className="w-6 h-6 text-[#6366f1]" />,
              text: 'Your therapist only knows what you tell them in the room',
            },
          ].map((p, i) => (
            <div key={i} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-6 hover:border-[#2a2a2a] transition-colors">
              <div className="mb-4">{p.icon}</div>
              <p className="text-[#888] text-sm leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section ref={featuresRef} id="features" className="max-w-5xl mx-auto px-6 py-24 border-t border-[#1a1a1a]">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">How it works</h2>
          <p className="text-[#666] text-lg">Three steps. No friction.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              icon: <Mic className="w-6 h-6 text-[#818cf8]" />,
              title: 'Record your session',
              body: "Use the app or your phone's voice recorder. Upload when you're done.",
            },
            {
              step: '02',
              icon: <FileText className="w-6 h-6 text-[#a78bfa]" />,
              title: 'Get your notes',
              body: 'AI analyzes the transcript and extracts key themes, action items, and breakthroughs.',
            },
            {
              step: '03',
              icon: <BookOpen className="w-6 h-6 text-[#c4b5fd]" />,
              title: 'Walk in prepared',
              body: 'Before your next session, get an AI brief on patterns, progress, and what to bring up.',
            },
          ].map((s) => (
            <div key={s.step} className="relative">
              <div className="text-xs font-bold text-[#333] mb-4">{s.step}</div>
              <div className="mb-4">{s.icon}</div>
              <h3 className="font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-[#666] text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 py-24 border-t border-[#1a1a1a]">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Simple pricing</h2>
          <p className="text-[#666] text-lg">Start free. Pay only when you need more.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Free */}
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-6 flex flex-col">
            <div className="mb-6">
              <div className="text-sm font-semibold text-[#888] uppercase tracking-widest mb-3">Free</div>
              <div className="text-4xl font-bold text-white mb-1">$0</div>
              <div className="text-sm text-[#555]">1 session, no credit card</div>
            </div>
            <ul className="space-y-2 mb-8 flex-1">
              {['1 free session', 'Full AI analysis', 'Session notes', 'No credit card needed'].map(f => (
                <li key={f} className="text-sm text-[#666] flex items-center gap-2">
                  <Check className="text-[#4ade80] w-3 h-3 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="w-full text-center text-sm font-medium text-[#888] hover:text-white border border-[#2a2a2a] hover:border-[#444] py-3 rounded-xl transition-all"
            >
              Get started free
            </Link>
          </div>

          {/* Pay per session */}
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-6 flex flex-col">
            <div className="mb-6">
              <div className="text-sm font-semibold text-[#888] uppercase tracking-widest mb-3">Pay per session</div>
              <div className="text-4xl font-bold text-white mb-1">$2.99</div>
              <div className="text-sm text-[#555]">per session</div>
            </div>
            <ul className="space-y-2 mb-8 flex-1">
              {['Unlimited sessions', 'Full AI analysis', 'Session notes + prep briefs', 'Perfect for monthly therapy'].map(f => (
                <li key={f} className="text-sm text-[#666] flex items-center gap-2">
                  <Check className="text-[#4ade80] w-3 h-3 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="w-full text-center text-sm font-medium text-[#888] hover:text-white border border-[#2a2a2a] hover:border-[#444] py-3 rounded-xl transition-all"
            >
              Get started free
            </Link>
          </div>

          {/* Monthly — highlighted */}
          <div className="bg-[#13122a] border-2 border-[#6366f1] rounded-2xl p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="text-xs font-semibold bg-[#6366f1] text-white px-3 py-1 rounded-full">Recommended</span>
            </div>
            <div className="mb-6">
              <div className="text-sm font-semibold text-[#a78bfa] uppercase tracking-widest mb-3">Monthly</div>
              <div className="text-4xl font-bold text-white mb-1">$9.99</div>
              <div className="text-sm text-[#888]">per month</div>
            </div>
            <ul className="space-y-2 mb-8 flex-1">
              {['Unlimited sessions', 'Full AI analysis', 'Session notes + prep briefs', 'Best for weekly therapy', 'Priority support'].map(f => (
                <li key={f} className="text-sm text-[#aaa] flex items-center gap-2">
                  <Check className="text-[#a78bfa] w-3 h-3 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="w-full text-center text-sm font-semibold bg-[#6366f1] hover:bg-[#818cf8] text-white py-3 rounded-xl transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] px-6 py-8">
        <div className="max-w-5xl mx-auto text-center text-xs text-[#444]">
          Built by Hayden Enloe · Free for self-hosters ·{' '}
          <a
            href="https://github.com/haydenenloe/clarity"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#888] transition-colors underline"
          >
            github.com/haydenenloe/clarity
          </a>
        </div>
      </footer>
    </div>
  )
}
