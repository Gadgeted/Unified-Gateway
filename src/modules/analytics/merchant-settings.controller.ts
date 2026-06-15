import { Controller, Get, Patch, Body, Headers, UnauthorizedException } from '@nestjs/common';
// PrismaService is in src/prisma; go up two directories to reach it
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
      apiKey: merchant.apiKey, // In production, you might mask this, but we'll return it for the UI copy feature
      webhookUrl: merchant.webhookUrl || '',
    };
  }

  // 2. Update Webhook URL Endpoint
  @Patch('settings/webhook')
  async updateWebhook(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { webhookUrl: string },
  ) {
    const merchant = await this.validateKey(apiKey);

    const updated = await (this.prisma.merchant as any).update({
      where: { id: merchant.id },
      data: { webhookUrl: body.webhookUrl },
      select: { webhookUrl: true },
    }) as { webhookUrl?: string | null };

    return { message: 'Webhook destination updated successfully.', webhookUrl: updated.webhookUrl };
  }

  // 3. Roll / Regenerate API Key Endpoint
  @Patch('settings/rotate-key')
  async rotateApiKey(@Headers('x-api-key') apiKey: string) {
    const merchant = await this.validateKey(apiKey);

    // Generate a fresh, secure random api key string matching your schema requirements
    const newApiKey = `sg_live_${crypto.randomBytes(24).toString('hex')}`;

    await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { apiKey: newApiKey },
    });

    return { message: 'API key successfully rotated.', newApiKey };
  }

  private async validateKey(apiKey: string) {
    if (!apiKey) throw new UnauthorizedException('API key header is required.');
    const merchant = await (this.prisma.merchant as any).findUnique({
      where: { apiKey },
      select: { id: true, businessName: true, apiKey: true, webhookUrl: true },
    }) as { id: string; businessName: string; apiKey: string; webhookUrl?: string | null };
    if (!merchant) throw new UnauthorizedException('Invalid API credentials.');
    return merchant;
  }
}