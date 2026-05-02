import { NextResponse } from 'next/server'
import { AssemblyAI } from 'assemblyai'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(request: Request) {
  // Verify authenticated user
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createServiceRoleClient()
  const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })

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

    // Verify ownership — prevent IDOR
    if (note.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
