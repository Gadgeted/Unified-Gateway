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

  // Route 3: Gateway administrator overview
  @Get('admin/overview')
  async fetchAdminOverview(@Headers('x-api-key') apiKey: string) {
    this.validateAdminKey(apiKey);
    return this.analyticsService.getAdminOverview();
  }

  // Alias route: some hosting platforms block paths containing `/admin`.
  // Provide a safe alternate path that can be used by the frontend if /admin/* 404s.
  @Get('overview-admin')
  async fetchAdminOverviewAlias(@Headers('x-api-key') apiKey: string) {
    return this.fetchAdminOverview(apiKey);
  }

  // Route 4: Gateway administrator tenant list
  @Get('admin/tenants')
  async fetchAdminTenants(@Headers('x-api-key') apiKey: string) {
    this.validateAdminKey(apiKey);
    return this.analyticsService.getAdminTenants();
  }

  // Alias route for tenant list to avoid hosting providers that rewrite/deny `/admin` paths
  @Get('tenants-list')
  async fetchAdminTenantsAlias(@Headers('x-api-key') apiKey: string) {
    return this.fetchAdminTenants(apiKey);
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

  private validateAdminKey(apiKey: string) {
    if (!apiKey) throw new UnauthorizedException('Admin API key is required.');

    const adminApiKey = process.env.ADMIN_API_KEY || 'tg_admin_secret_key_abc123';
    if (apiKey !== adminApiKey) {
      throw new UnauthorizedException('Invalid admin API key provided.');
    }

    return true;
  }
}