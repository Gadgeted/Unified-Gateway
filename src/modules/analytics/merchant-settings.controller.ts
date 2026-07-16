import { Controller, Get, Patch, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Controller('v1/merchant')
export class MerchantSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Fetch current settings securely
  @Get('settings')
  async getSettings(@Headers('x-api-key') apiKey: string) {
    const merchant = await this.validateKey(apiKey);
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

  // 2. Update Webhook URL
  @Patch('settings/webhook')
  async updateWebhook(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { webhookUrl: string },
  ) {
    const merchant = await this.validateKey(apiKey);
    const updated = await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { webhookUrl: body.webhookUrl },
      select: { webhookUrl: true },
    });
    return { message: 'Webhook destination updated successfully.', webhookUrl: updated.webhookUrl };
  }

  // 3. Roll / Regenerate API Key
  @Patch('settings/rotate-key')
  async rotateApiKey(@Headers('x-api-key') apiKey: string) {
    const merchant = await this.validateKey(apiKey);
    const newApiKey = `sg_live_${crypto.randomBytes(24).toString('hex')}`;
    await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { apiKey: newApiKey },
    });
    return { message: 'API key successfully rotated.', newApiKey };
  }

  // 4. Update fee percentages (for merchant)
  @Patch('settings/fees')
  async updateFees(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { mpesaFeePercent?: number; airtelFeePercent?: number; cardFeePercent?: number; cryptoFeePercent?: number },
  ) {
    const merchant = await this.validateKey(apiKey);
    const updated = await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        mpesaFeePercent: body.mpesaFeePercent ?? merchant.mpesaFeePercent,
        airtelFeePercent: body.airtelFeePercent ?? merchant.airtelFeePercent,
        cardFeePercent: body.cardFeePercent ?? merchant.cardFeePercent,
        cryptoFeePercent: body.cryptoFeePercent ?? merchant.cryptoFeePercent,
      },
      select: {
        mpesaFeePercent: true,
        airtelFeePercent: true,
        cardFeePercent: true,
        cryptoFeePercent: true,
      },
    });
    return { message: 'Fee settings updated successfully.', ...updated };
  }

  // Helper to validate API key
  private async validateKey(apiKey: string) {
    if (!apiKey) throw new UnauthorizedException('API key header is required.');
    const merchant = await this.prisma.merchant.findUnique({
      where: { apiKey },
      select: {
        id: true,
        businessName: true,
        apiKey: true,
        webhookUrl: true,
        mpesaFeePercent: true,
        airtelFeePercent: true,
        cardFeePercent: true,
        cryptoFeePercent: true,
      },
    });
    if (!merchant) throw new UnauthorizedException('Invalid API credentials.');
    return merchant;
  }
}