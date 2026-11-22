import Stripe from 'stripe';

const CUSTOMER_LIMIT = 10;

async function findCustomer(email: string, userId: string, stripe: Stripe): Promise<Stripe.Customer | null> {
    const customers = await stripe.customers.list({ email, limit: CUSTOMER_LIMIT });

    return customers.data.find(customer => customer.metadata.user_id === userId) ?? null;
}

function getStripe(): Stripe | null {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) return null;

    return new Stripe(secretKey);
}

export { findCustomer, getStripe };
