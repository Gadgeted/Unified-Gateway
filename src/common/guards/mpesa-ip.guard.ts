import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';

@Injectable()
export class MpesaIpGuard implements CanActivate {
  private readonly logger = new Logger(MpesaIpGuard.name);

  // Official Safaricom Daraja callback IP ranges (Sandbox + Production environments)
  private readonly allowedIps = [
    '196.201.214.200',
    '196.201.214.206',
    '196.201.213.114',
    '196.201.214.207',
    '196.201.214.208',
    '196.46.255.24',
    '196.201.212.138', 
    '::ffff:196.201.214.200', // IPv6 mapped formats
    '::ffff:196.201.214.206',
    '::ffff:196.201.213.114'
  ];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Extract client IP address (taking proxies like Ngrok/Cloudflare into account)
    const clientIp = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    
    // Clean up IP string format if it contains ports or array strings
    const cleanIp = Array.isArray(clientIp) 
      ? clientIp[0].split(',')[0].trim() 
      : clientIp?.split(',')[0].trim();

    // Development backdoor: Let localhost/Ngrok test requests pass through cleanly
    if (process.env.NODE_ENV !== 'production' || cleanIp === '127.0.0.1' || cleanIp === '::1') {
      return true;
    }

    if (!this.allowedIps.includes(cleanIp)) {
      this.logger.error(`🛑 BLOCKED: Unauthorized callback attempt from malicious IP: ${cleanIp}`);
      throw new UnauthorizedException('Access denied. Unrecognized callback origin.');
    }

    return true;
  }
}