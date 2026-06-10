import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { WebhookSecurity } from '../utils/crypto.util';

@Injectable()
export class WebhookGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // 1. Extract the signature header sent by the provider
    const incomingSignature = request.headers['x-api-signature'] || request.headers['verif-hash'];
    
    if (!incomingSignature) {
      throw new UnauthorizedException('Missing webhook verification signature.');
    }

    // 2. Grab your secret webhook token from your environment variables
    const secretKey = process.env.WEBHOOK_SECRET_KEY;
    
    // 3. Extract the raw request body string
    const rawBody = JSON.stringify(request.body);

    // 4. Verify authenticity
    // Using ?? '' ensures TypeScript knows a string is ALWAYS passed, clearing the error!
    const isValid = WebhookSecurity.verifySignature(
      rawBody, 
      (incomingSignature as string) ?? '', 
      secretKey ?? ''
    );

    if (!isValid) {
      console.error('⚠️ ALERT: Unauthorized webhook attempt blocked!');
      throw new UnauthorizedException('Invalid webhook signature integrity.');
    }

    return true; // Request is authentic, let it pass through to the controller!
  }
}