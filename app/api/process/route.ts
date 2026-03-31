import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

const SYSTEM_PROMPT = `You are a therapy session analyst. Analyze this therapy session transcript and return a JSON object with these exact keys:
{
  "summary": "2-3 paragraph summary of the session",
  "keyThemes": ["theme1", "theme2"],
  "workingOn": ["item1", "item2"],
  "actionItems": ["action1", "action2"],
  "breakthroughs": ["insight1"],
  "bringUpNext": ["topic1", "topic2"],
  "emotionalPatterns": ["pattern1"]
}
Return only valid JSON, no markdown.`

async function transcribeWithAssemblyAI(audioBuffer: Buffer, contentType: string): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) throw new Error('No AssemblyAI API key')

  // Upload audio
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': contentType },
    body: audioBuffer as unknown as BodyInit,
  })
  if (!uploadRes.ok) throw new Error(`AssemblyAI upload failed: ${uploadRes.status}`)
  const { upload_url } = await uploadRes.json()

  // Submit transcription job
  const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url }),
  })
  if (!submitRes.ok) throw new Error(`AssemblyAI submit failed: ${submitRes.status}`)
  const { id: transcriptId } = await submitRes.json()

  // Poll for completion
  const maxAttempts = 100
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: apiKey },
    })
    if (!pollRes.ok) throw new Error(`AssemblyAI poll failed: ${pollRes.status}`)
    const result = await pollRes.json()

    if (result.status === 'completed') return result.text
    if (result.status === 'error') throw new Error(`AssemblyAI error: ${result.error}`)
  }
  throw new Error('Transcription timed out')
}

async function transcribeWithWhisper(audioBuffer: Buffer, contentType: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('No OpenAI API key for Whisper fallback')

  const formData = new FormData()
  const blob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: contentType })
  const ext = contentType.includes('mp4') ? 'mp4' : 'webm'
  formData.append('file', blob, `audio.${ext}`)
  formData.append('model', 'whisper-1')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: formData,
  })
  if (!res.ok) throw new Error(`Whisper failed: ${res.status}`)
  const { text } = await res.json()
  return text
}

export async function POST(request: Request) {
  const supabase = createServiceRoleClient()

  let sessionId: string | undefined
  try {
    const body = await request.json()
    sessionId = body.sessionId
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    // Fetch session
    const { data: session, error: fetchErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    if (fetchErr || !session) throw new Error('Session not found')

    const { audio_path, user_id } = session
    if (!audio_path) throw new Error('No audio_path on session')

    // Download audio from storage
    const { data: audioData, error: dlErr } = await supabase.storage
      .from('session-audio')
      .download(audio_path)
    if (dlErr || !audioData) throw new Error('Failed to download audio')

    const audioBuffer = Buffer.from(await audioData.arrayBuffer())
    const ext = audio_path.split('.').pop()?.toLowerCase() ?? 'webm'
    const contentTypeMap: Record<string, string> = {
      'm4a': 'audio/mp4',
      'mp4': 'audio/mp4',
      'webm': 'audio/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
    }
    const contentType = contentTypeMap[ext] ?? 'audio/mp4'

    // Transcribe
    let transcript: string
    try {
      transcript = await transcribeWithAssemblyAI(audioBuffer, contentType)
    } catch (err) {
      console.error('AssemblyAI failed, trying Whisper:', err)
      transcript = await transcribeWithWhisper(audioBuffer, contentType)
    }

    // Update transcript, set status to analyzing
    await supabase
      .from('sessions')
      .update({ transcript, status: 'analyzing' })
      .eq('id', sessionId)

    // Analyze with Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Here is the therapy session transcript:\n\n${transcript}`,
        },
      ],
      system: SYSTEM_PROMPT,
    })

    const rawContent = message.content[0]
    if (rawContent.type !== 'text') throw new Error('Unexpected Claude response type')

    let notes: Record<string, unknown>
    try {
      const cleaned = rawContent.text.replace(/^```json\n?/, '').replace(/```$/, '').trim()
      notes = JSON.parse(cleaned)
    } catch {
      throw new Error('Failed to parse Claude JSON response')
    }

    // Save notes, mark complete
    await supabase
      .from('sessions')
      .update({ notes, status: 'complete', updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    return NextResponse.json({ success: true, sessionId })
  } catch (err: any) {
    console.error('Processing error:', err)
    if (sessionId) {
      try {
        await createServiceRoleClient()
          .from('sessions')
          .update({ status: 'error', updated_at: new Date().toISOString() })
          .eq('id', sessionId)
      } catch {}
    }
    return NextResponse.json({ error: err?.message || 'Processing failed' }, { status: 500 })
  }
}
