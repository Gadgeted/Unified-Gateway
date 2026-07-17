import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class B2cService {
  private readonly logger = new Logger(B2cService.name);

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
      if (!response.ok) throw new Error(data.errorMessage);
      return data.access_token;
    } catch (error: any) {
      this.logger.error(`B2C Token Error: ${error.message}`);
      throw new InternalServerErrorException('Failed to authenticate B2C.');
    }
  }

  async sendMoney(amount: number, phone: string, merchantName: string) {
    const token = await this.getAccessToken();
    const url = 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest';
    const shortcode = process.env.MPESA_SHORTCODE || '174379';
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

    // Format phone: remove leading 0 or +254, ensure 254XXXXXXXXX
    let formattedPhone = phone.replace(/\s/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

    // ✅ Build callback URLs correctly – no double slashes
    const baseCallbackUrl = (process.env.MPESA_CALLBACK_URL || 'https://your-domain.com').replace(/\/+$/, '');
    const timeoutUrl = `${baseCallbackUrl}/v1/mpesa/b2c/timeout`;
    const resultUrl = `${baseCallbackUrl}/v1/mpesa/b2c/result`;

    const body = {
      InitiatorName: process.env.MPESA_INITIATOR_NAME || 'testapi',
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL || '',
      CommandID: 'BusinessPayment',
      Amount: Math.round(amount),
      PartyA: shortcode,
      PartyB: formattedPhone,
      Remarks: 'Withdrawal payout',
      QueueTimeOutURL: timeoutUrl,
      ResultURL: resultUrl,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (data.ResponseCode !== '0') {
      this.logger.error(`B2C failed: ${data.ResponseDescription}`);
      throw new Error(data.ResponseDescription || 'B2C request failed.');
    }
    return data;
  }
}