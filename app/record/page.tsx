'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

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

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
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
    } catch (err: any) {
      setErrorMsg('Microphone access denied. Please allow mic access and try again.')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setRecordingState('stopped')
    }
  }

  async function uploadAndAnalyze() {
    if (!audioBlob) return
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

      // Upload audio
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
      const path = `${user.id}/${sid}.${ext}`
      const { error: uploadError } = await sb.storage
        .from('session-audio')
        .upload(path, audioBlob, { contentType: audioBlob.type })
      if (uploadError) throw uploadError

      // Update status to transcribing
      await sb.from('sessions').update({ audio_path: path, status: 'transcribing' }).eq('id', sid)
      setProcessingState('transcribing')

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

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/sessions" className="text-sm text-[#888] hover:text-white transition-colors">
            ← Sessions
          </Link>
          <span className="text-sm text-[#666]">New session</span>
        </div>
      </nav>

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
                  onClick={() => { setProcessingState(null); setRecordingState('idle'); setAudioBlob(null); setAudioUrl(null) }}
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
              onClick={uploadAndAnalyze}
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
            <p className="text-[#666] text-sm mb-12">
              {recordingState === 'recording'
                ? 'Recording in progress…'
                : 'Press the button below to start recording your therapy session.'}
            </p>

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
