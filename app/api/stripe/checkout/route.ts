import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(request: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

    const { priceId, userId, userEmail } = await request.json()

    if (!priceId || !userId || !userEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://clarity-web-delta.vercel.app/record?upgraded=true',
      cancel_url: 'https://clarity-web-delta.vercel.app/record',
      client_reference_id: userId,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create checkout session' }, { status: 500 })
  }
}
