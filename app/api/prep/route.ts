import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const PREP_SYSTEM_PROMPT = `You are a therapy co-pilot helping someone prepare for their next therapy session. 
Based on notes from their recent sessions, generate a pre-session brief.
Return a JSON object with these exact keys:
{
  "lastSessionRecap": "1-2 sentence recap of the most recent session",
  "patterns": ["pattern1", "pattern2", "pattern3"],
  "suggestedAgenda": ["agenda item 1", "agenda item 2", "agenda item 3"],
  "questionsToExplore": ["question1", "question2", "question3"]
}
Return only valid JSON, no markdown.`

export async function POST(request: Request) {
  try {
    const { notesContext } = await request.json()
    if (!notesContext) {
      return NextResponse.json({ error: 'Missing notesContext' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Here are my recent therapy session notes:\n\n${notesContext}\n\nPlease generate my pre-session brief.`,
        },
      ],
      system: PREP_SYSTEM_PROMPT,
    })

    const rawContent = message.content[0]
    if (rawContent.type !== 'text') throw new Error('Unexpected Claude response type')

    let brief: Record<string, unknown>
    try {
      const cleaned = rawContent.text.replace(/^```json\n?/, '').replace(/```$/, '').trim()
      brief = JSON.parse(cleaned)
    } catch {
      throw new Error('Failed to parse Claude JSON response')
    }

    return NextResponse.json({ brief })
  } catch (err: any) {
    console.error('Prep API error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to generate brief' }, { status: 500 })
  }
}
