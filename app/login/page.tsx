import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'

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
          <h1 className="text-2xl font-bold tracking-tight mb-2">Clarity</h1>
          <p className="text-[#888] text-sm">Your therapy co-pilot</p>
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-8">
          <h2 className="text-lg font-semibold mb-1">Sign in</h2>
          <p className="text-[#666] text-sm mb-6">Enter your email to receive a magic link.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
