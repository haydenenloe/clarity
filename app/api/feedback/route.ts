import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const { type, message, email, url } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Save to DB
  await supabase.from('feedback').insert({
    type: type || 'general',
    message,
    email: email || null,
    page_url: url || null,
    created_at: new Date().toISOString(),
  })

  // TODO: Add DISCORD_WEBHOOK_URL to Vercel env to enable Discord notifications
  // Discord webhook notification
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**New Clarity Feedback**\n**Type:** ${type || 'general'}\n**From:** ${email || 'anonymous'}\n**Page:** ${url || 'unknown'}\n\n${message}`,
      }),
    })
  }

  return NextResponse.json({ ok: true })
}
