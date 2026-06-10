import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  async fetchDashboardMetrics(@Headers('x-api-key') apiKey: string) {
    if (!apiKey) throw new UnauthorizedException('API key header is required.');

    const merchant = await this.prisma.merchant.findUnique({
      where: { apiKey },
    });

    if (!merchant) throw new UnauthorizedException('Invalid API key provided.');

    return this.analyticsService.getMerchantDashboard(merchant.id);
  }
}