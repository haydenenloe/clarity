'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  plan: string
  sessions_this_month: number
}

export default function BillingPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }
      setUserId(user.id)
      setUserEmail(user.email ?? null)

      const { data } = await supabase
        .from('profiles')
        .select('plan, sessions_this_month')
        .eq('id', user.id)
        .single()

      setProfile(data ?? { plan: 'free', sessions_this_month: 0 })
      setLoading(false)
    }
    load()
  }, [])

  async function handleCheckout(priceId: string) {
    if (!userId || !userEmail) return
    setCheckingOut(priceId)

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, userId, userEmail }),
    })

    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert('Failed to start checkout. Please try again.')
      setCheckingOut(null)
    }
  }

  const perSessionPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PER_SESSION || 'price_1TGoiKGZb4SW2pSyD3KrfSOa'
  const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || 'price_1TGoiQGZb4SW2pSynUokdxNr'

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
            <Link href="/sessions" className="text-sm text-[#888] hover:text-white transition-colors">Sessions</Link>
            <Link href="/record" className="text-sm text-[#888] hover:text-white transition-colors">Record</Link>
            <Link href="/journal" className="text-sm text-[#888] hover:text-white transition-colors">Journal</Link>
            <Link href="/chat" className="text-sm text-[#888] hover:text-white transition-colors">Chat</Link>
            <Link href="/prep" className="text-sm text-[#888] hover:text-white transition-colors">Prep</Link>
            <Link href="/billing" className="text-sm text-white transition-colors">Billing</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold mb-2">Simple pricing</h1>
          <p className="text-[#666] text-sm">Pay for what you need, upgrade anytime.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Free tier banner */}
            <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 mb-6 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Free tier</p>
                <p className="text-[#666] text-xs mt-0.5">1 free session to try Clarity</p>
              </div>
              {profile?.plan === 'free' ? (
                <span className="text-xs bg-[#0f2318] text-[#4ade80] border border-[#1a3a25] px-3 py-1 rounded-full font-medium">
                  Current plan
                </span>
              ) : (
                <span className="text-xs text-[#555]">
                  {profile?.sessions_this_month ?? 0} session{(profile?.sessions_this_month ?? 0) !== 1 ? 's' : ''} this month
                </span>
              )}
            </div>

            {/* Pricing cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Per session */}
              <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold mb-1">Per session</h2>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">$2.99</span>
                    <span className="text-[#666] text-sm">/ session</span>
                  </div>
                  <p className="text-[#666] text-sm mt-2">Pay as you go. Perfect if you go monthly.</p>
                </div>

                <ul className="space-y-2 mb-6">
                  {['Full session recording', 'AI-powered notes', 'Action items & insights', 'No commitment'].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#aaa]">
                      <span className="text-[#4ade80] text-xs">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {profile?.plan === 'per_session' ? (
                  <div className="w-full text-center py-3 text-sm text-[#818cf8] bg-[#0d0d1a] border border-[#1a1a3a] rounded-xl">
                    Current plan · {profile.sessions_this_month} session{profile.sessions_this_month !== 1 ? 's' : ''} this month
                  </div>
                ) : profile?.plan === 'monthly' ? (
                  <div className="w-full text-center py-3 text-sm text-[#555] bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl">
                    You have monthly — no need for this
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckout(perSessionPriceId)}
                    disabled={!!checkingOut}
                    className="w-full bg-[#1a1a2e] hover:bg-[#252540] border border-[#2a2a5a] text-[#818cf8] font-medium py-3 rounded-xl transition-all text-sm disabled:opacity-50"
                  >
                    {checkingOut === perSessionPriceId ? 'Redirecting…' : 'Get started →'}
                  </button>
                )}
              </div>

              {/* Monthly — recommended */}
              <div className="bg-[#0d0d1a] border border-[#6366f1] rounded-2xl p-6 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#6366f1] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Recommended
                  </span>
                </div>

                <div className="mb-5">
                  <h2 className="text-lg font-semibold mb-1">Monthly</h2>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">$9.99</span>
                    <span className="text-[#666] text-sm">/ month</span>
                  </div>
                  <p className="text-[#666] text-sm mt-2">Unlimited sessions. Best for weekly therapy.</p>
                </div>

                <ul className="space-y-2 mb-6">
                  {['Unlimited sessions', 'AI-powered notes', 'Action items & insights', 'Pre-session prep briefs', 'Journal notes between sessions'].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#aaa]">
                      <span className="text-[#6366f1] text-xs">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {profile?.plan === 'monthly' ? (
                  <div className="w-full text-center py-3 text-sm text-[#4ade80] bg-[#0f2318] border border-[#1a3a25] rounded-xl font-medium">
                    You're on the monthly plan ✓
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckout(monthlyPriceId)}
                    disabled={!!checkingOut}
                    className="w-full bg-[#6366f1] hover:bg-[#818cf8] text-white font-medium py-3 rounded-xl transition-colors text-sm disabled:opacity-50"
                  >
                    {checkingOut === monthlyPriceId ? 'Redirecting…' : 'Get started →'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
