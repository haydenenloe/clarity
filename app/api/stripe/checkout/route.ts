import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Verify authenticated user — never trust client-supplied identity for billing
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

    const { priceId } = await request.json()

    if (!priceId) {
      return NextResponse.json({ error: 'Missing priceId' }, { status: 400 })
    }

    // Use verified session identity — not client-supplied values
    const userId = user.id
    const userEmail = user.email

    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Create or retrieve customer by email
    let customerId: string
    const existing = await stripe.customers.list({ email: userEmail, limit: 1 })
    if (existing.data.length > 0) {
      customerId = existing.data[0].id
    } else {
      const customer = await stripe.customers.create({ email: userEmail })
      customerId = customer.id
    }

    // Determine if this is a subscription or one-time payment
    const price = await stripe.prices.retrieve(priceId)
    const mode = price.recurring ? 'subscription' : 'payment'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://getclarityapp.app'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/record?upgraded=true`,
      cancel_url: `${appUrl}/record`,
      client_reference_id: userId,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create checkout session' }, { status: 500 })
  }
}
