import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'
import Link from 'next/link'

export default async function LoginPage() {
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
          <h1 className="text-2xl font-bold tracking-tight mb-1">Welcome back</h1>
          <p className="text-[#666] text-sm mb-6">Enter your email to receive a magic link.</p>
          <LoginForm />
        </div>

        <p className="text-center text-sm text-[#555] mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-[#a78bfa] hover:text-[#c4b5fd] transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  )
}
