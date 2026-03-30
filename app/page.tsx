import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './login/LoginForm'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/sessions')
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Clarity</span>
            <span className="text-xs text-[#888] bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#2a2a2a]">
              beta
            </span>
          </div>
          <a
            href="https://github.com/haydenenloe/clarity"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#888] hover:text-white transition-colors"
          >
            GitHub →
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs text-[#a78bfa] bg-[#1a1730] border border-[#312e81] px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
          Your therapy co-pilot
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight text-balance mb-6">
          Make every therapy
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#818cf8] to-[#a78bfa]">
            session count.
          </span>
        </h1>

        <p className="text-lg text-[#999] max-w-2xl mx-auto leading-relaxed mb-4 text-balance">
          Record sessions. Get structured notes. Walk in prepared.
        </p>
        <p className="text-sm text-[#666] max-w-lg mx-auto mb-12">
          Clarity turns your session recordings into structured notes, action items, and a prep brief for next time.{' '}
          <span className="text-white font-medium">100% private.</span>
        </p>

        {/* Login form */}
        <div className="max-w-md mx-auto">
          <LoginForm />
        </div>

        {/* GitHub CTA */}
        <div className="mt-6">
          <a
            href="https://github.com/haydenenloe/clarity"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#888] hover:text-white border border-[#2a2a2a] hover:border-[#444] rounded-xl px-4 py-2.5 transition-all"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            Self-host for free →
          </a>
        </div>
      </section>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="border-t border-[#1a1a1a]" />
      </div>
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { emoji: '🎙️', title: 'Auto-structured notes', body: 'Record your session → get structured notes automatically. No manual journaling.' },
            { emoji: '📋', title: 'Capture what matters', body: 'Action items, patterns, and breakthroughs — captured so you don\'t forget between sessions.' },
            { emoji: '🗂️', title: 'Walk in prepared', body: 'Every session prepared with an AI-generated agenda built from your history.' },
          ].map((f) => (
            <div key={f.title} className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6 hover:border-[#2a2a2a] transition-colors">
              <div className="text-3xl mb-4">{f.emoji}</div>
              <h3 className="font-semibold text-white mb-2 text-sm">{f.title}</h3>
              <p className="text-[#777] text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#555]">
          <span>Built by Hayden Enloe</span>
          <span className="hidden sm:block">·</span>
          <span>Free forever for self-hosters</span>
          <span className="hidden sm:block">·</span>
          <span>No therapy data stored without your consent</span>
        </div>
      </footer>
    </main>
  )
}
