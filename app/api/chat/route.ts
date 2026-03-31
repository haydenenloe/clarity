import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function formatSessionNotes(sessions: any[]): string {
  if (!sessions || sessions.length === 0) return 'No session notes available yet.'

  return sessions
    .map((s) => {
      const date = new Date(s.session_date).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
      const notes = s.notes as Record<string, any> | null
      if (!notes) return `[${date}] — No notes`

      const parts: string[] = [`[${date}]`]
      if (notes.summary) parts.push(`Summary: ${notes.summary}`)
      if (notes.keyThemes?.length) parts.push(`Key themes: ${notes.keyThemes.join(', ')}`)
      if (notes.workingOn?.length) parts.push(`Working on: ${notes.workingOn.join('; ')}`)
      if (notes.actionItems?.length) parts.push(`Action items: ${notes.actionItems.join('; ')}`)
      if (notes.breakthroughs?.length) parts.push(`Breakthroughs: ${notes.breakthroughs.join('; ')}`)
      if (notes.emotionalPatterns?.length) parts.push(`Emotional patterns: ${notes.emotionalPatterns.join(', ')}`)
      if (notes.bringUpNext?.length) parts.push(`To bring up next: ${notes.bringUpNext.join('; ')}`)

      return parts.join('\n')
    })
    .join('\n\n---\n\n')
}

function formatJournalNotes(notes: any[]): string {
  if (!notes || notes.length === 0) return 'No journal entries available yet.'

  return notes
    .map((n) => {
      const date = new Date(n.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
      const text = n.transcript || n.content || '(no transcript)'
      return `[${date}]\n${text}`
    })
    .join('\n\n---\n\n')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { message, history, conversationId } = body as { message: string; history: ChatMessage[]; conversationId?: string }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 })
    }

    // Verify user via cookie-based auth
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()

    // Fetch all completed sessions sorted by date (oldest first)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('session_date, notes')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .order('session_date', { ascending: true })

    // Fetch recent journal notes
    const { data: journalNotes } = await supabase
      .from('journal_notes')
      .select('transcript, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const sessionContext = formatSessionNotes(sessions ?? [])
    const journalContext = formatJournalNotes(journalNotes ?? [])

    const systemPrompt = `You are a compassionate, insightful therapy co-pilot. You have access to the user's therapy session notes and journal entries below. Use this context to answer questions thoughtfully and help them reflect on their progress, patterns, and growth.

Be warm but concise. Don't over-explain. If you notice patterns across sessions, call them out. If asked what to focus on next, give specific, actionable suggestions based on the actual notes.

Never give clinical diagnoses or replace professional therapy. You're a reflection tool, not a therapist.

--- SESSION HISTORY ---
${sessionContext}

--- RECENT JOURNAL NOTES ---
${journalContext}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Build messages array: history + new message
    const conversationMessages: Anthropic.MessageParam[] = [
      ...(history ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationMessages,
    })

    const rawContent = response.content[0]
    if (rawContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    return NextResponse.json({ reply: rawContent.text })
  } catch (err: any) {
    console.error('Chat API error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to get response' },
      { status: 500 }
    )
  }
}
