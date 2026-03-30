'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || status === 'loading') return

    setStatus('loading')
    setMessage('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (error) throw error

      setStatus('success')
      setMessage(`Magic link sent to ${email} — check your inbox.`)
      setEmail('')
    } catch (err: any) {
      console.error(err)
      setStatus('error')
      setMessage(err?.message || 'Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-start gap-3 bg-[#0f1f0f] border border-[#1a3a1a] rounded-xl px-5 py-4 text-[#4ade80] text-sm">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <div>
          <p className="font-medium">Check your email</p>
          <p className="text-[#86efac] mt-1">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          disabled={status === 'loading'}
          className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-[#555] text-sm focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
        >
          {status === 'loading' ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending...
            </span>
          ) : (
            'Send magic link'
          )}
        </button>
      </form>
      {status === 'error' && (
        <p className="text-red-400 text-sm mt-3">{message}</p>
      )}
      <p className="text-[#555] text-xs mt-4">No password needed. We&apos;ll email you a sign-in link.</p>
    </div>
  )
}
