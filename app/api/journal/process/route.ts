import { NextResponse } from 'next/server'
import { AssemblyAI } from 'assemblyai'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

export async function POST(request: Request) {
  const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { noteId } = await request.json()
    if (!noteId) {
      return NextResponse.json({ error: 'Missing noteId' }, { status: 400 })
    }

    // Fetch the note
    const { data: note, error: noteError } = await supabase
      .from('journal_notes')
      .select('id, audio_path, user_id')
      .eq('id', noteId)
      .single()

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    if (!note.audio_path) {
      return NextResponse.json({ error: 'No audio path on note' }, { status: 400 })
    }

    // Get a signed URL for the audio
    const { data: signedData, error: signedError } = await supabase.storage
      .from('session-audio')
      .createSignedUrl(note.audio_path, 300) // 5 min expiry

    if (signedError || !signedData?.signedUrl) {
      throw new Error('Failed to get signed URL for audio')
    }

    // Transcribe with AssemblyAI
    const transcript = await assemblyai.transcripts.transcribe({
      audio_url: signedData.signedUrl,
    })

    if (transcript.status === 'error') {
      throw new Error(`AssemblyAI error: ${transcript.error}`)
    }

    const text = transcript.text ?? ''

    // Save transcript to DB
    await supabase
      .from('journal_notes')
      .update({ transcript: text, content: text })
      .eq('id', noteId)

    return NextResponse.json({ transcript: text })
  } catch (err: any) {
    console.error('Journal process error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to process note' }, { status: 500 })
  }
}
