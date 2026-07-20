import { Controller, Get, Patch, Body, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Controller('v1/settings')
@UseGuards(HybridAuthGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('fees/global')
  async getGlobalFees(@Req() req: any) {
    this.ensureAdmin(req);
    return this.settingsService.getGlobalFeeSettings();
  }

  @Patch('fees/global')
  async updateGlobalFees(@Body() body: { mpesa: number; airtel: number; card: number; crypto: number }, @Req() req: any) {
    this.ensureAdmin(req);
    return this.settingsService.updateGlobalFeeSettings(body);
  }

  private ensureAdmin(req: any) {
    if (req.user?.role !== 'GATEWAY_ADMIN' && req.user?.isAdmin !== true) {
      throw new UnauthorizedException('Admin access required');
    }
  }
}