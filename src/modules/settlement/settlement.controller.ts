import { Controller, Post, Body, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/settlement')
export class SettlementController {
  constructor(
    private readonly settlementService: SettlementService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('withdraw')
  async requestWithdrawal(
    @Body() body: { amount: number; phone: string },
    @Headers('x-api-key') apiKey: string,
  ) {
    if (!apiKey) throw new UnauthorizedException('Missing merchant authorization API key.');
    if (!body.amount || body.amount <= 0) throw new BadRequestException('Invalid withdrawal amount.');
    if (!body.phone) throw new BadRequestException('Destination phone number required.');

    const merchant = await this.prisma.merchant.findUnique({
      where: { apiKey },
    });

    if (!merchant) throw new UnauthorizedException('Invalid API Key.');

    return this.settlementService.triggerMerchantPayout(merchant.id, body.amount, body.phone);
  }
}