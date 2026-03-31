import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { AssemblyAI } from 'assemblyai'

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

async function transcribeWithAssemblyAI(audioBuffer: Buffer): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) throw new Error('No AssemblyAI API key configured')

  const client = new AssemblyAI({ apiKey })

  // Upload audio buffer as a file
  const uploadUrl = await client.files.upload(audioBuffer)

  // Transcribe
  const transcript = await client.transcripts.transcribe({
    audio_url: uploadUrl,
  })

  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription error: ${transcript.error}`)
  }

  if (!transcript.text) throw new Error('AssemblyAI returned empty transcript')
  return transcript.text
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

    // Transcribe via AssemblyAI SDK
    const transcript = await transcribeWithAssemblyAI(audioBuffer)

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
