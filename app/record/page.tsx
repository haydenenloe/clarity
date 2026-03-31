'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RecordingState = 'idle' | 'recording' | 'stopped'
type ProcessingState = 'uploading' | 'transcribing' | 'analyzing' | 'complete' | 'error' | null

export default function RecordPage() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [processingState, setProcessingState] = useState<ProcessingState>(null)
  const [timer, setTimer] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [planLoading, setPlanLoading] = useState(true)
  const [canRecord, setCanRecord] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const router = useRouter()

  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  // Check payment gating on mount
  useEffect(() => {
    async function checkAccess() {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        setPlanLoading(false)
        router.replace('/')
        return
      }

      const { data: profile } = await sb
        .from('profiles')
        .select('plan, sessions_this_month')
        .eq('id', user.id)
        .single()

      if (!profile) {
        setCanRecord(true)
      } else if (profile.plan === 'monthly') {
        setCanRecord(true)
      } else if (profile.plan === 'per_session') {
        setShowPricingModal(true)
      } else {
        if ((profile.sessions_this_month ?? 0) === 0) {
          setCanRecord(true)
        } else {
          setShowPricingModal(true)
        }
      }

      setPlanLoading(false)
    }
    checkAccess()
  }, [])

  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [recordingState])

  // Realtime subscription for session status
  useEffect(() => {
    if (!sessionId || !processingState) return
    if (processingState === 'complete' || processingState === 'error') return

    const sb = getSupabase()
    const channel = sb
      .channel(`session-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const newStatus = (payload.new as any).status as ProcessingState
        setProcessingState(newStatus)
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [sessionId, processingState])

  // Poll every 5 seconds as fallback while processing
  useEffect(() => {
    if (!sessionId || !processingState) return
    if (processingState === 'complete' || processingState === 'error') return

    const interval = setInterval(async () => {
      const sb = getSupabase()
      const { data } = await sb
        .from('sessions')
        .select('status')
        .eq('id', sessionId)
        .single()
      if (data?.status) setProcessingState(data.status as ProcessingState)
    }, 5000)

    return () => clearInterval(interval)
  }, [sessionId, processingState])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        setWakeLockActive(true)
        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false)
        })
      } catch (e) {
        // Wake lock not supported or denied — continue anyway
      }
    }
  }

  async function releaseWakeLock() {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release()
      wakeLockRef.current = null
      setWakeLockActive(false)
    }
  }

  async function handleCheckout(priceId: string) {
    setCheckoutLoading(priceId)
    try {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId: user.id, userEmail: user.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error(err)
    } finally {
      setCheckoutLoading(null)
    }
  }

  async function startRecording() {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }

      mr.start(1000)
      setRecordingState('recording')
      setTimer(0)
      await acquireWakeLock()
    } catch (err: any) {
      setErrorMsg('Microphone access denied. Please allow mic access and try again.')
    }
  }

  async function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setRecordingState('stopped')
      await releaseWakeLock()
    }
  }

  // File drag & drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelected(file)
  }

  function handleFileSelected(file: File) {
    setUploadedFile(file)
    setErrorMsg(null)
  }

  async function uploadAndAnalyze(blob: Blob) {
    setProcessingState('uploading')
    setErrorMsg(null)

    try {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create session row
      const { data: session, error: sessionError } = await sb
        .from('sessions')
        .insert([{ user_id: user.id, status: 'uploading' }])
        .select()
        .single()
      if (sessionError) throw sessionError

      const sid = session.id
      setSessionId(sid)

      // Determine extension from blob type or file name
      let ext = 'webm'
      if (blob.type.includes('mp4') || blob.type.includes('m4a')) ext = 'mp4'
      else if (blob.type.includes('mp3') || blob.type.includes('mpeg')) ext = 'mp3'
      else if (blob.type.includes('wav')) ext = 'wav'
      else if (blob.type.includes('ogg')) ext = 'ogg'
      else if (blob.type.includes('flac')) ext = 'flac'
      // For uploaded files, try to get ext from name
      if (blob instanceof File && (blob as File).name) {
        const nameParts = (blob as File).name.split('.')
        if (nameParts.length > 1) ext = nameParts[nameParts.length - 1].toLowerCase()
      }

      const path = `${user.id}/${sid}.${ext}`
      const { error: uploadError } = await sb.storage
        .from('session-audio')
        .upload(path, blob, { contentType: blob.type || 'audio/mpeg' })
      if (uploadError) throw uploadError

      // Update status to transcribing
      await sb.from('sessions').update({ audio_path: path, status: 'transcribing' }).eq('id', sid)
      setProcessingState('transcribing')

      // Increment sessions_this_month
      const { data: profileData } = await sb
        .from('profiles')
        .select('sessions_this_month')
        .eq('id', user.id)
        .single()
      const currentCount = (profileData as any)?.sessions_this_month ?? 0
      await sb.from('profiles').upsert({
        id: user.id,
        sessions_this_month: currentCount + 1,
      }, { onConflict: 'id' })

      // Trigger processing
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Processing failed')
      }
    } catch (err: any) {
      console.error(err)
      setProcessingState('error')
      setErrorMsg(err?.message || 'Something went wrong during upload.')
    }
  }

  const processingLabels: Record<string, string> = {
    uploading: 'Uploading audio…',
    transcribing: 'Transcribing session…',
    analyzing: 'Analyzing with AI…',
    complete: 'Done! Notes are ready.',
    error: 'Something went wrong.',
  }

  if (planLoading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/sessions" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Clarity</span>
            <span className="text-xs text-[#888] bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#2a2a2a]">beta</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/sessions" className="text-sm text-[#888] hover:text-white transition-colors">Sessions</Link>
            <Link href="/record" className="text-sm text-white transition-colors">Record</Link>
            <Link href="/journal" className="text-sm text-[#888] hover:text-white transition-colors">Journal</Link>
            <Link href="/chat" className="text-sm text-[#888] hover:text-white transition-colors">Chat</Link>
            <Link href="/prep" className="text-sm text-[#888] hover:text-white transition-colors">Prep</Link>
            <Link href="/billing" className="text-sm text-[#888] hover:text-white transition-colors">Billing</Link>
          </div>
          {wakeLockActive && (
            <span className="text-xs text-[#4ade80] bg-[#0f2318] border border-[#1a3a25] px-2 py-0.5 rounded-full">
              🔒 Screen on
            </span>
          )}
        </div>
      </nav>

      {/* Pricing Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="w-full max-w-lg bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="text-center mb-6">
              <div className="text-2xl mb-3">🔒</div>
              <h2 className="text-xl font-bold mb-2">Your free session is used up.</h2>
              <p className="text-[#666] text-sm">Choose a plan to keep recording.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {/* Per session */}
              <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5 flex flex-col">
                <div className="text-sm font-semibold text-[#888] uppercase tracking-widest mb-2">Pay as you go</div>
                <div className="text-3xl font-bold text-white mb-1">$2.99</div>
                <div className="text-xs text-[#555] mb-4">per session</div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {['Pay only when you record', 'Full AI analysis', 'Great for monthly therapy'].map(f => (
                    <li key={f} className="text-xs text-[#666] flex items-center gap-1.5">
                      <span className="text-[#4ade80]">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_PER_SESSION_PRICE_ID || 'price_per_session')}
                  disabled={!!checkoutLoading}
                  className="w-full text-sm font-medium text-[#888] hover:text-white border border-[#2a2a2a] hover:border-[#444] py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                  {checkoutLoading === (process.env.NEXT_PUBLIC_STRIPE_PER_SESSION_PRICE_ID || 'price_per_session') ? 'Redirecting…' : 'Pay $2.99'}
                </button>
              </div>

              {/* Monthly — highlighted */}
              <div className="bg-[#13122a] border-2 border-[#6366f1] rounded-xl p-5 flex flex-col relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs font-semibold bg-[#6366f1] text-white px-2.5 py-0.5 rounded-full">Best value</span>
                </div>
                <div className="text-sm font-semibold text-[#a78bfa] uppercase tracking-widest mb-2">Unlimited</div>
                <div className="text-3xl font-bold text-white mb-1">$9.99</div>
                <div className="text-xs text-[#888] mb-4">per month</div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {['Unlimited sessions', 'Full AI analysis', 'Prep briefs before each session', 'Best for weekly therapy'].map(f => (
                    <li key={f} className="text-xs text-[#aaa] flex items-center gap-1.5">
                      <span className="text-[#a78bfa]">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID || 'price_monthly')}
                  disabled={!!checkoutLoading}
                  className="w-full text-sm font-semibold bg-[#6366f1] hover:bg-[#818cf8] text-white py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {checkoutLoading === (process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID || 'price_monthly') ? 'Redirecting…' : 'Subscribe $9.99/mo'}
                </button>
              </div>
            </div>

            <button
              onClick={() => router.push('/sessions')}
              className="w-full text-xs text-[#555] hover:text-[#888] py-2 transition-colors"
            >
              Go back to sessions
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-16 flex flex-col items-center text-center">
        {processingState ? (
          /* Processing UI */
          <div className="w-full max-w-md">
            <div className="mb-8">
              {processingState === 'complete' ? (
                <div className="w-20 h-20 rounded-full bg-[#0f2318] border border-[#1a3a25] flex items-center justify-center mx-auto mb-6 text-3xl">
                  ✓
                </div>
              ) : processingState === 'error' ? (
                <div className="w-20 h-20 rounded-full bg-[#2a0a0a] border border-[#3a1515] flex items-center justify-center mx-auto mb-6 text-3xl">
                  ✕
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin mx-auto mb-6" />
              )}

              <h2 className="text-xl font-semibold mb-2">
                {processingLabels[processingState] ?? 'Processing…'}
              </h2>

              {/* Progress steps */}
              <div className="flex items-center justify-center gap-2 mt-6">
                {['uploading', 'transcribing', 'analyzing', 'complete'].map((step, i) => {
                  const steps = ['uploading', 'transcribing', 'analyzing', 'complete']
                  const currentIdx = steps.indexOf(processingState)
                  const stepIdx = steps.indexOf(step)
                  const done = stepIdx < currentIdx
                  const active = stepIdx === currentIdx

                  return (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full transition-all ${
                        done ? 'bg-[#4ade80]' : active ? 'bg-[#6366f1]' : 'bg-[#2a2a2a]'
                      }`} />
                      {i < 3 && <div className={`w-6 h-px ${done ? 'bg-[#4ade80]' : 'bg-[#2a2a2a]'}`} />}
                    </div>
                  )
                })}
              </div>
            </div>

            {processingState === 'complete' && sessionId && (
              <Link
                href={`/sessions/${sessionId}`}
                className="inline-flex bg-[#6366f1] hover:bg-[#818cf8] text-white font-medium px-6 py-3 rounded-xl transition-colors"
              >
                View session notes →
              </Link>
            )}

            {processingState === 'error' && (
              <div>
                <p className="text-[#f87171] text-sm mb-4">{errorMsg}</p>
                <button
                  onClick={() => { setProcessingState(null); setRecordingState('idle'); setAudioBlob(null); setAudioUrl(null); setUploadedFile(null) }}
                  className="text-sm text-[#888] hover:text-white border border-[#2a2a2a] px-4 py-2 rounded-xl transition-all"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        ) : recordingState === 'stopped' && audioBlob ? (
          /* Preview + Upload UI */
          <div className="w-full max-w-md">
            <div className="text-4xl mb-4">🎙️</div>
            <h2 className="text-xl font-semibold mb-2">Recording complete</h2>
            <p className="text-[#666] text-sm mb-6">Duration: {formatTime(timer)}</p>

            {audioUrl && (
              <audio controls src={audioUrl} className="w-full mb-6 rounded-xl" />
            )}

            <button
              onClick={() => uploadAndAnalyze(audioBlob)}
              className="w-full bg-[#6366f1] hover:bg-[#818cf8] text-white font-medium py-4 rounded-xl transition-colors text-base"
            >
              Upload & Analyze →
            </button>
            <button
              onClick={() => { setRecordingState('idle'); setAudioBlob(null); setAudioUrl(null); setTimer(0) }}
              className="mt-3 w-full text-sm text-[#666] hover:text-[#888] py-2 transition-colors"
            >
              Discard and record again
            </button>
          </div>
        ) : (
          /* Record UI */
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold mb-2">Record session</h1>
            <p className="text-[#666] text-sm mb-10">
              {recordingState === 'recording'
                ? 'Recording in progress…'
                : 'Upload an existing recording or record live.'}
            </p>

            {recordingState === 'idle' && (
              <>
                {/* File upload section */}
                <div className="mb-8">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-4">Upload a recording</p>

                  {uploadedFile ? (
                    /* File selected state */
                    <div className="border border-[#2a2a2a] rounded-2xl p-5 bg-[#111] text-left">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">📁</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{uploadedFile.name}</p>
                          <p className="text-xs text-[#666] mt-0.5">{formatFileSize(uploadedFile.size)}</p>
                        </div>
                        <button
                          onClick={() => setUploadedFile(null)}
                          className="text-[#555] hover:text-[#888] text-sm transition-colors flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                      <button
                        onClick={() => uploadAndAnalyze(uploadedFile)}
                        className="mt-4 w-full bg-[#6366f1] hover:bg-[#818cf8] text-white font-medium py-3 rounded-xl transition-colors text-sm"
                      >
                        Upload & Analyze →
                      </button>
                    </div>
                  ) : (
                    /* Drop zone */
                    <div
                      className={`border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all ${
                        isDragOver
                          ? 'border-[#6366f1] bg-[#1a1730]'
                          : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#0f0f0f]'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="text-3xl mb-3">📁</div>
                      <p className="text-sm font-medium text-[#ccc] mb-1">
                        Upload a recording from Voice Memos or any audio app
                      </p>
                      <p className="text-xs text-[#555] mb-3">Drag & drop or tap to select</p>
                      <p className="text-xs text-[#444]">Supports .m4a, .mp3, .wav, .mp4, .webm, .ogg, .flac</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".m4a,.mp3,.wav,.mp4,.webm,.ogg,.flac,audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileSelected(file)
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1 h-px bg-[#1f1f1f]" />
                  <span className="text-xs text-[#555]">— or record live —</span>
                  <div className="flex-1 h-px bg-[#1f1f1f]" />
                </div>
              </>
            )}

            {/* Big record button */}
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={recordingState === 'idle' ? startRecording : stopRecording}
                className={`w-32 h-32 rounded-full flex items-center justify-center text-white transition-all shadow-lg ${
                  recordingState === 'recording'
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse shadow-red-900/50'
                    : 'bg-[#6366f1] hover:bg-[#818cf8] shadow-indigo-900/50'
                }`}
              >
                {recordingState === 'recording' ? (
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0012.95 2.21A7.1 7.1 0 0019 11h-2zm-5 7a7 7 0 01-7-7H3a9 9 0 009 9v2h-3v2h8v-2h-3v-2a9 9 0 009-9h-2a7 7 0 01-7 7z" />
                  </svg>
                )}
              </button>

              {recordingState === 'recording' && (
                <div className="text-3xl font-mono font-bold text-red-400">
                  {formatTime(timer)}
                </div>
              )}

              <p className="text-[#555] text-sm">
                {recordingState === 'recording' ? 'Tap to stop recording' : 'Tap to start recording'}
              </p>
            </div>

            {errorMsg && (
              <p className="mt-6 text-red-400 text-sm">{errorMsg}</p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
