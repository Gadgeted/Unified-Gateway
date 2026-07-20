import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  // Helper 1: Fetch short-lived OAuth Access Token from Safaricom
  private async getAccessToken(): Promise<string> {
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const buffer = Buffer.from(`${key}:${secret}`).toString('base64');

    const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Basic ${buffer}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessage || 'Failed to fetch token');
      
      return data.access_token;
    } catch (error: any) {
      this.logger.error(`OAuth Token Error: ${error.message}`);
      throw new InternalServerErrorException('Failed to authenticate with M-Pesa server.');
    }
  }

  // Helper 2: Trigger the actual STK Push prompt to customer phone
  async triggerStkPush(transaction: Transaction): Promise<any> {
    const accessToken = await this.getAccessToken();
    const url = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    // Format phone number to standard 254XXXXXXXXX format
    let phone = transaction.customerIdentifier.replace(/[\s+]/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.substring(1);

    // Generate Daraja cryptographic credentials
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
    const shortcode = process.env.MPESA_SHORTCODE || '174379';
    const passkey = process.env.MPESA_PASSKEY || '';
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // 👈 DYNAMIC CALLBACK CONFIGURATION ROUTING
    // Automatically uses your fresh ngrok domain and points to our new endpoint route
    // const liveNgrokTunnel = 'https://woozy-saggy-unzip.ngrok-free.dev';
    // const callbackUrl = `${liveNgrokTunnel}/v1/payments/mpesa-callback`;
    // const callbackUrl = process.env.MPESA_CALLBACK_URL;
    const baseUrl = (process.env.MPESA_CALLBACK_URL || 'https://unified-gateway.onrender.com').replace(/\/+$/, '');
    const callbackUrl = `${baseUrl}/v1/mpesa/callback`;

    this.logger.log(`Routing M-Pesa response lifecycle tracking to Callback URL: ${callbackUrl}`);

    const requestBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline', // CustomBuyGoodsOnline for Till numbers
      Amount: Math.round(transaction.amountGross),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl, // ◄ Safaricom will now hit your live tunnel
      AccountReference: transaction.merchantReference,
      TransactionDesc: `Payment for Order ${transaction.merchantReference}`,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      this.logger.error(`STK Push API Error: ${error.message}`);
      throw new InternalServerErrorException('Failed to initiate M-Pesa STK Push execution.');
    }
  }
}