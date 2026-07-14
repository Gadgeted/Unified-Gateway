import { Controller, Get, Headers, UnauthorizedException, Query, UseGuards, Req } from '@nestjs/common';
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
    // JWT or API key – we get merchant from req.user
    const merchant = this.getMerchantFromRequest(req);
    return this.analyticsService.getMerchantDashboard(merchant.id);
  }

  // Route 2: Real-time Live Transaction Feed
  @Get('recent-transactions')
  async fetchRecentTransactions(
    @Req() req: any,
    @Query('limit') limit = '10',
  ) {
    const merchant = this.getMerchantFromRequest(req);
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

  // ----- private helpers -----

  private getMerchantFromRequest(req: any) {
    // If user is from JWT (has merchant attached)
    if (req.user?.merchant) {
      return req.user.merchant;
    }
    // If user is from API key (merchant directly attached)
    if (req.user?.merchant) {
      return req.user.merchant;
    }
    // Fallback: if user has merchantId, fetch it
    if (req.user?.merchantId) {
      return this.prisma.merchant.findUnique({ where: { id: req.user.merchantId } });
    }
    throw new UnauthorizedException('Merchant not found in request context');
  }

  private ensureAdmin(req: any) {
    if (req.user?.role !== 'GATEWAY_ADMIN') {
      throw new UnauthorizedException('Admin access required');
    }
    // Also allow if user is admin via API key (isAdmin flag)
    if (req.user?.isAdmin === true) {
      return;
    }
    // If no admin role, reject
    if (!req.user || req.user.role !== 'GATEWAY_ADMIN') {
      throw new UnauthorizedException('Admin access required');
    }
  }
}