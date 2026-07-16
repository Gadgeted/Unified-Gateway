import { Controller, Get, Headers, UnauthorizedException, Query, Param, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Controller('v1/analytics')
@UseGuards(HybridAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  // Route 1: Core Summary & Chart Analytics Data Base
  @Get('dashboard')
  async fetchDashboardMetrics(@Req() req: any) {
    const merchant = await this.getMerchantFromRequest(req);
    return this.analyticsService.getMerchantDashboard(merchant.id);
  }

  // Route 2: Real-time Live Transaction Feed
  @Get('recent-transactions')
  async fetchRecentTransactions(
    @Req() req: any,
    @Query('limit') limit = '10',
  ) {
    const merchant = await this.getMerchantFromRequest(req);
    const parsedLimit = parseInt(limit, 10) || 10;
    return this.analyticsService.getRecentMerchantTransactions(merchant.id, parsedLimit);
  }

  // Route 3: Gateway administrator overview (ADMIN ONLY)
  @Get('admin/overview')
  async fetchAdminOverview(@Req() req: any) {
    this.ensureAdmin(req);
    return this.analyticsService.getAdminOverview();
  }

  // Alias for admin overview
  @Get('overview-admin')
  async fetchAdminOverviewAlias(@Req() req: any) {
    return this.fetchAdminOverview(req);
  }

  // Route 4: Gateway administrator tenant list (ADMIN ONLY)
  @Get('admin/tenants')
  async fetchAdminTenants(@Req() req: any) {
    this.ensureAdmin(req);
    return this.analyticsService.getAdminTenants();
  }

  // Alias for tenant list
  @Get('tenants-list')
  async fetchAdminTenantsAlias(@Req() req: any) {
    return this.fetchAdminTenants(req);
  }

  @Get('admin/merchant/:merchantId/transactions')
  async getMerchantTransactions(
    @Param('merchantId') merchantId: string,
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    if (req.user?.role !== 'GATEWAY_ADMIN') {
      throw new UnauthorizedException('Admin access required.');
    }
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.analyticsService.getMerchantTransactions(merchantId, parsedLimit);
  }

  // ----- private helpers -----

  private async getMerchantFromRequest(req: any) {
    // 1️⃣ First, try to get merchant from the API key (highest priority)
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { apiKey: apiKey as string },
      });
      if (merchant) {
        return merchant;
      }
    }

    // 2️⃣ Fallback: if API key not provided, use the merchant from JWT
    if (req.user?.merchant) {
      return req.user.merchant;
    }

    if (req.user?.merchantId) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: req.user.merchantId },
      });
      if (merchant) return merchant;
    }

    throw new UnauthorizedException('Merchant not found');
  }

  private ensureAdmin(req: any) {
    if (req.user?.role !== 'GATEWAY_ADMIN' && req.user?.isAdmin !== true) {
      throw new UnauthorizedException('Admin access required');
    }
  }
}