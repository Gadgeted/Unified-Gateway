import { Controller, Get, Patch, Body, Headers, UnauthorizedException, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Controller('v1/merchant')
@UseGuards(HybridAuthGuard)
export class MerchantSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('settings')
  async getSettings(@Req() req: any) {
    const merchant = this.getMerchantFromRequest(req);
    return {
      id: merchant.id,
      businessName: merchant.businessName,
      apiKey: merchant.apiKey,
      webhookUrl: merchant.webhookUrl || '',
    };
  }

  @Patch('settings/webhook')
  async updateWebhook(
    @Req() req: any,
    @Body() body: { webhookUrl: string },
  ) {
    const merchant = this.getMerchantFromRequest(req);
    const updated = await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { webhookUrl: body.webhookUrl },
      select: { webhookUrl: true },
    });
    return { message: 'Webhook destination updated successfully.', webhookUrl: updated.webhookUrl };
  }

  @Patch('settings/rotate-key')
  async rotateApiKey(@Req() req: any) {
    const merchant = this.getMerchantFromRequest(req);
    const newApiKey = `tg_live_${crypto.randomBytes(24).toString('hex')}`;
    await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { apiKey: newApiKey },
    });
    return { message: 'API key successfully rotated.', newApiKey };
  }

  private getMerchantFromRequest(req: any) {
    if (req.user?.merchant) {
      return req.user.merchant;
    }
    if (req.user?.merchantId) {
      // fetch from DB
      return this.prisma.merchant.findUnique({ where: { id: req.user.merchantId } });
    }
    throw new UnauthorizedException('Merchant not found');
  }
}