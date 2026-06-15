import { Controller, Get, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  // Route 1: Core Summary & Chart Analytics Data Base
  @Get('dashboard')
  async fetchDashboardMetrics(@Headers('x-api-key') apiKey: string) {
    const merchant = await this.validateMerchantKey(apiKey);
    return this.analyticsService.getMerchantDashboard(merchant.id);
  }

  // Route 2: Real-time Live Transaction Feed Grid (Your Step 2 Code 🚀)
  @Get('recent-transactions')
  async fetchRecentTransactions(
    @Headers('x-api-key') apiKey: string,
    @Query('limit') limit = '10',
  ) {
    const merchant = await this.validateMerchantKey(apiKey);
    const parsedLimit = parseInt(limit, 10) || 10;
    
    return this.analyticsService.getRecentMerchantTransactions(merchant.id, parsedLimit);
  }

  // Private helper to avoid repeating auth logic across different dashboard paths
  private async validateMerchantKey(apiKey: string) {
    if (!apiKey) throw new UnauthorizedException('API key header is required.');

    const merchant = await this.prisma.merchant.findUnique({
      where: { apiKey },
    });

    if (!merchant) throw new UnauthorizedException('Invalid API key provided.');
    
    return merchant;
  }
}