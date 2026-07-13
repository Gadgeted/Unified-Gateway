import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class HybridAuthGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const authHeader = request.headers['authorization'];
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 1. Try API key (for POS)
    if (apiKey) {
      // Check admin key
      const adminKey = process.env.ADMIN_API_KEY;
      if (adminKey && apiKey === adminKey) {
        request.user = { role: 'GATEWAY_ADMIN', isAdmin: true };
        return true;
      }

      const merchant = await this.prisma.merchant.findUnique({
        where: { apiKey: apiKey as string },
      });
      if (merchant) {
        request.user = { merchant, role: 'STORE_OWNER' };
        return true;
      }
    }

    // 2. Try JWT (for web dashboard)
    if (token) {
      try {
        const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET || 'super_secret_gateway_key_for_development_2026' });
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          include: { merchant: true },
        });
        if (user) {
          request.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            merchant: user.merchant,
            merchantId: user.merchantId,
          };
          return true;
        }
      } catch (error) {
        // JWT invalid, ignore
      }
    }

    throw new UnauthorizedException('Invalid credentials');
  }
}