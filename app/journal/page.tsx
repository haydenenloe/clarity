'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type RecordingState = 'idle' | 'recording' | 'stopped'

interface JournalNote {
  id: string
  transcript: string | null
  content: string | null
  created_at: string
}

const MAX_SECONDS = 3 * 60 // 3 minutes

export default function JournalPage() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [timer, setTimer] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [notes, setNotes] = useState<JournalNote[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  // Load past notes on mount
  useEffect(() => {
    async function loadNotes() {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const { data } = await sb
        .from('journal_notes')
        .select('id, transcript, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      setNotes(data ?? [])
    }
    loadNotes()
  }, [])

  // Timer management
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setTimer((t) => {
          if (t + 1 >= MAX_SECONDS) {
            stopRecording()
            return MAX_SECONDS
          }
          return t + 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [recordingState])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  async function startRecording() {
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()) }

      mr.start(1000)
      setRecordingState('recording')
      setTimer(0)
    } catch {
      setErrorMsg('Microphone access denied. Please allow mic access and try again.')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setRecordingState('stopped')
      // Process after short delay to let onstop collect all chunks
      setTimeout(() => uploadNote(), 500)
    }
  }

  async function uploadNote() {
    if (chunksRef.current.length === 0) return
    setUploading(true)
    setErrorMsg(null)

    try {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const timestamp = Date.now()
      const path = `${user.id}/journal/${timestamp}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await sb.storage
        .from('session-audio')
        .upload(path, blob, { contentType: mimeType })
      if (uploadError) throw uploadError

      // Create journal note row
      const { data: note, error: noteError } = await sb
        .from('journal_notes')
        .insert([{ user_id: user.id, audio_path: path }])
        .select()
        .single()
      if (noteError) throw noteError

      setUploading(false)
      setProcessing(true)

      // Trigger transcription
      const res = await fetch('/api/journal/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: note.id }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Transcription failed')
      }

      const data = await res.json()

      // Update local notes list
      setNotes((prev) => [{
        id: note.id,
        transcript: data.transcript ?? null,
        content: data.transcript ?? null,
        created_at: note.created_at,
      }, ...prev])

      setSuccessMsg('Note saved!')
      setRecordingState('idle')
      setTimer(0)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err?.message || 'Failed to save note')
      setRecordingState('idle')
    } finally {
      setUploading(false)
      setProcessing(false)
      chunksRef.current = []
    }
  }

  const firstLine = (text: string | null | undefined) => {
    if (!text) return null
    return text.split('.')[0] + (text.includes('.') ? '.' : '')
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

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
            <Link href="/record" className="text-sm text-[#888] hover:text-white transition-colors">Record</Link>
            <Link href="/journal" className="text-sm text-white transition-colors">Journal</Link>
            <Link href="/chat" className="text-sm text-[#888] hover:text-white transition-colors">Chat</Link>
            <Link href="/prep" className="text-sm text-[#888] hover:text-white transition-colors">Prep</Link>
            <Link href="/billing" className="text-sm text-[#888] hover:text-white transition-colors">Billing</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold mb-1">Journal</h1>
          <p className="text-[#666] text-sm">Quick voice notes between sessions</p>
        </div>

        {/* Recorder */}
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-8 mb-8 flex flex-col items-center text-center">
          {uploading || processing ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-10 h-10 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#888] text-sm">{uploading ? 'Uploading…' : 'Transcribing…'}</p>
            </div>
          ) : (
            <>
              <p className="text-[#666] text-sm mb-6">What's on your mind? (tap to record)</p>

              <button
                onClick={recordingState === 'idle' ? startRecording : stopRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all shadow-lg mb-4 ${
                  recordingState === 'recording'
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse shadow-red-900/50'
                    : 'bg-[#6366f1] hover:bg-[#818cf8] shadow-indigo-900/50'
                }`}
              >
                {recordingState === 'recording' ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0012.95 2.21A7.1 7.1 0 0019 11h-2zm-5 7a7 7 0 01-7-7H3a9 9 0 009 9v2h-3v2h8v-2h-3v-2a9 9 0 009-9h-2a7 7 0 01-7 7z" />
                  </svg>
                )}
              </button>

              {recordingState === 'recording' && (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-2xl font-mono font-bold text-red-400">{formatTime(timer)}</div>
                  <p className="text-[#555] text-xs">Max 3:00 · tap to stop</p>
                  <div className="w-48 h-1 bg-[#1f1f1f] rounded-full mt-2">
                    <div
                      className="h-1 bg-red-600 rounded-full transition-all"
                      style={{ width: `${(timer / MAX_SECONDS) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {recordingState === 'idle' && (
                <p className="text-[#555] text-xs">Tap to start · max 3 minutes</p>
              )}
            </>
          )}

          {successMsg && (
            <p className="mt-4 text-[#4ade80] text-sm">{successMsg}</p>
          )}
          {errorMsg && (
            <p className="mt-4 text-[#f87171] text-sm">{errorMsg}</p>
          )}
        </div>

        {/* Past notes */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-4">Past notes</h2>
          {notes.length === 0 ? (
            <p className="text-[#444] text-sm text-center py-8">No notes yet. Tap to record your first one.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4">
                  <p className="text-[#555] text-xs mb-2">{formatDate(note.created_at)}</p>
                  <p className="text-[#aaa] text-sm leading-relaxed">
                    {firstLine(note.transcript || note.content) ?? <span className="italic text-[#444]">Transcribing…</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
