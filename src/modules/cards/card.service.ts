import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';

@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  async processCardPayment(transaction: Transaction, cardToken: string | undefined): Promise<any> {
    // If a live transaction comes through without a tokenized card token reference, block it instantly
    if (!cardToken) {
      throw new BadRequestException('Card processing requires a secure token reference. Raw card details are prohibited.');
    }

    this.logger.log(`Initiating secure vault charge for transaction: ${transaction.id}`);

    // In a live production environment, this fetch communicates directly with your downstream banking provider (e.g., Flutterwave or Stripe)
    const url = 'https://api.stripe.com/v1/charges'; // Mocking production standard endpoint structure
    
    const requestBody = new URLSearchParams({
      amount: Math.round(transaction.amountGross * 100).toString(), // Card systems expect amounts in cents/minor units (e.g., 2500 KES = 250000 cents)
      currency: transaction.currency?.toLowerCase() || 'kes',
      source: cardToken, // The secure token from your UI screen (image_1e5436.jpg)
      description: `Unified Gateway payment for Ref: ${transaction.merchantReference}`,
    });

    try {
      // For sandbox verification, we simulate a successful call if the key is a test key
      if (process.env.CARD_SECRET_KEY?.startsWith('sk_test')) {
        return {
          id: `ch_mock_${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
          status: 'succeeded',
          outcome: { network_status: 'approved_by_network', type: 'authorized' }
        };
      }

      // Real network call executed if keys are production ready
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CARD_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody.toString(),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Card authorization declined.');

      return data;
    } catch (error: any) {
      this.logger.error(`Visa/Mastercard Processing Error: ${error.message}`);
      throw new InternalServerErrorException(error.message || 'Failed to authorize credit card transactional funds.');
    }
  }
}