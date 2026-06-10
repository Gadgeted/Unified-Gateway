import * as crypto from 'crypto';

export class WebhookSecurity {
  /**
   * Verifies that the incoming payload matches the signature sent by the provider.
   * Prevents timing attacks by using crypto.timingSafeEqual.
   */
  static verifySignature(
    rawPayload: string, 
    incomingSignature: string, 
    secretKey: string
  ): boolean {
    if (!incomingSignature || !secretKey) return false;

    // Calculate the expected hash using SHA256 and your secret signing key
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(rawPayload)
      .digest('hex');

    const bufferExpected = Buffer.from(expectedSignature, 'utf8');
    const bufferIncoming = Buffer.from(incomingSignature, 'utf8');

    // Prevent timing attacks by checking lengths first, then comparing bytes safely
    if (bufferExpected.length !== bufferIncoming.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufferExpected, bufferIncoming);
  }
}