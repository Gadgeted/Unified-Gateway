import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';

@Injectable()
export class AirtelService {
  private readonly logger = new Logger(AirtelService.name);

  // Helper 1: Fetch Authentication Token from Airtel Money Gateway
  private async getAccessToken(): Promise<string> {
    const url = 'https://openapi.airtel.africa/auth/oauth2/token'; // Sandbox base url route
    const requestBody = {
      client_id: process.env.AIRTEL_CLIENT_ID,
      client_secret: process.env.AIRTEL_CLIENT_SECRET,
      grant_type: 'client_credentials',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error_description || 'Failed to fetch token');

      return data.access_token;
    } catch (error: any) {
      this.logger.error(`Airtel Auth Error: ${error.message}`);
      throw new InternalServerErrorException('Failed to authenticate with Airtel Money server.');
    }
  }

  // Helper 2: Fire the USSD PIN prompt request directly to the phone
  async triggerAirtelPush(transaction: Transaction): Promise<any> {
    const accessToken = await this.getAccessToken();
    const url = 'https://openapi.airtel.africa/merchant/v1/payments/';

    // Format phone number string cleanly for Airtel requirement (remove local leading 0)
    let phone = transaction.customerIdentifier.replace(/[\s+]/g, '');
    if (phone.startsWith('254')) phone = phone.substring(3);
    if (phone.startsWith('0')) phone = phone.substring(1);

    const requestBody = {
      reference: transaction.merchantReference,
      subscriber: {
        country: 'KE',
        currency: transaction.currency || 'KES',
        msisdn: phone,
      },
      transaction: {
        amount: transaction.amountGross,
        id: transaction.id, // Pass our system transactional entry ID for reference tracking
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Country': 'KE',
          'X-Currency': transaction.currency || 'KES',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      this.logger.error(`Airtel Payment Push Error: ${error.message}`);
      throw new InternalServerErrorException('Failed to initiate Airtel Money prompt execution.');
    }
  }
}