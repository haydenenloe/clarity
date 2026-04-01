import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignupForm from './SignupForm'
import Link from 'next/link'

export default async function SignupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/sessions')
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="" className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tight">Clarity</span>
          </Link>
        </div>

        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Get started free</h1>
          <p className="text-[#a78bfa] text-sm mb-6">Your first session is on us. No credit card needed.</p>
          <SignupForm />
        </div>

        <p className="text-center text-sm text-[#555] mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-[#a78bfa] hover:text-[#c4b5fd] transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
