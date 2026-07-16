import { Controller, Get, Patch, Body, Headers, UnauthorizedException, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Controller('v1/merchant')
@UseGuards(HybridAuthGuard) // ✅ Guard handles both API key and JWT
export class MerchantSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('settings')
  async getSettings(@Req() req: any) {
    const merchant = await this.getMerchantFromRequest(req);
    return {
      id: merchant.id,
      businessName: merchant.businessName,
      apiKey: merchant.apiKey,
      webhookUrl: merchant.webhookUrl || '',
      mpesaFeePercent: merchant.mpesaFeePercent,
      airtelFeePercent: merchant.airtelFeePercent,
      cardFeePercent: merchant.cardFeePercent,
      cryptoFeePercent: merchant.cryptoFeePercent,
    };
  }

  @Patch('settings/webhook')
  async updateWebhook(@Req() req: any, @Body() body: { webhookUrl: string }) {
    const merchant = await this.getMerchantFromRequest(req);
    const updated = await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { webhookUrl: body.webhookUrl },
      select: { webhookUrl: true },
    });
    return { message: 'Webhook destination updated successfully.', webhookUrl: updated.webhookUrl };
  }

  @Patch('settings/rotate-key')
  async rotateApiKey(@Req() req: any) {
    const merchant = await this.getMerchantFromRequest(req);
    const newApiKey = `sg_live_${crypto.randomBytes(24).toString('hex')}`;
    await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { apiKey: newApiKey },
    });
    return { message: 'API key successfully rotated.', newApiKey };
  }

  // Helper to extract merchant from req.user (set by HybridAuthGuard)
  private async getMerchantFromRequest(req: any) {
    let merchant = req.user?.merchant;
    if (!merchant && req.user?.merchantId) {
      merchant = await this.prisma.merchant.findUnique({
        where: { id: req.user.merchantId },
      });
    }
    if (!merchant) {
      throw new UnauthorizedException('Merchant not found.');
    }
    return merchant;
  }
}