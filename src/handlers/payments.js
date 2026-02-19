/**
 * Lambda Handler: Payments Management
 * POST /payments/create-intent - Create Stripe PaymentIntent
 */

const { httpResponse, parseBody } = require('../utils/http');

/**
 * POST /payments/create-intent
 * Create a Stripe PaymentIntent for trail payment
 */
const createPaymentIntent = async (event) => {
  try {
    const body = parseBody(event);
    const { amount, currency = 'AUD', metadata } = body;

    // Validate request
    if (!amount) {
      return httpResponse.error('Missing amount in request body');
    }

    // Initialize Stripe
    let stripe;
    try {
      // Stripe will be installed via npm, check if it's available
      stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    } catch (error) {
      console.error('❌ Stripe not configured:', error);
      return httpResponse.error('Payment service is not configured. Please add STRIPE_SECRET_KEY to environment variables.', 500);
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount), // Amount in cents
      currency: currency.toLowerCase(),
      metadata: metadata || {
        type: 'trail',
        timestamp: new Date().toISOString(),
      },
    });

    return httpResponse.success({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error('❌ Error creating payment intent:', error);

    if (error.type === 'StripeInvalidRequestError') {
      return httpResponse.error(`Invalid payment request: ${error.message}`);
    }

    if (error.type === 'StripeAuthenticationError') {
      return httpResponse.error('Payment service authentication failed', 500);
    }

    return httpResponse.error('Unable to create PaymentIntent', 500);
  }
};

module.exports = {
  createPaymentIntent,
};
