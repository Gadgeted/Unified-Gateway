import { Controller, Post, Body, Headers, UnauthorizedException, BadRequestException, Get, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';
import { B2cService } from '../mpesa/b2c.service';

@Controller('v1/settlement')
@UseGuards(HybridAuthGuard)
export class SettlementController {
  constructor(
    private readonly settlementService: SettlementService,
    private readonly prisma: PrismaService,
    private readonly b2cService: B2cService,
  ) {}

  // Merchant requests withdrawal (creates PENDING payout)
  @Post('withdraw')
  async requestWithdrawal(
    @Body() body: { amount: number; phone: string },
    @Req() req: any,
  ) {
    const merchant = await this.getMerchantFromRequest(req);
    if (!body.amount || body.amount <= 0) throw new BadRequestException('Invalid amount.');
    if (!body.phone) throw new BadRequestException('Destination phone required.');

    // Check available balance
    const successfulTx = await this.prisma.transaction.aggregate({
      where: { merchantId: merchant.id, status: 'SUCCESS' },
      _sum: { amountNet: true },
    });
    const totalEarned = successfulTx._sum.amountNet || 0;

    const priorPayouts = await this.prisma.payout.aggregate({
      where: { merchantId: merchant.id, status: 'SUCCESS' },
      _sum: { amount: true },
    });
    const totalWithdrawn = priorPayouts._sum.amount || 0;
    const available = totalEarned - totalWithdrawn;

    if (body.amount > available) {
      throw new BadRequestException(`Insufficient balance. Available: KES ${available}`);
    }

    // Create pending payout
    const payout = await this.prisma.payout.create({
      data: {
        merchantId: merchant.id,
        amount: body.amount,
        destination: body.phone,
        status: 'PENDING',
      },
    });

    return { message: 'Withdrawal request submitted.', payout };
  }

  // Admin: get all pending payouts
  @Get('pending')
  async getPendingPayouts(@Req() req: any) {
    this.ensureAdmin(req);
    return this.prisma.payout.findMany({
      where: { status: 'PENDING' },
      include: { merchant: { select: { businessName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Admin: approve or reject payout
 @Patch('payouts/:id')
  async updatePayoutStatus(
    @Param('id') id: string,
    @Body() body: { status: 'SUCCESS' | 'FAILED' },
    @Req() req: any,
  ) {
    this.ensureAdmin(req);
    const payout = await this.prisma.payout.findUnique({
      where: { id },
      include: { merchant: true },
    });
    if (!payout) throw new BadRequestException('Payout not found');

    if (body.status === 'SUCCESS') {
      // Trigger B2C
      try {
        await this.b2cService.sendMoney(payout.amount, payout.destination, payout.merchant.businessName);
        await this.prisma.payout.update({
          where: { id },
          data: { status: 'SUCCESS' },
        });
        return { message: 'Payout approved and sent to merchant.' };
      } catch (err) {
        // If B2C fails, keep as PENDING or mark FAILED
        await this.prisma.payout.update({
          where: { id },
          data: { status: 'FAILED' },
        });
        throw new BadRequestException('B2C failed. Payout marked FAILED.');
      }
    } else {
      await this.prisma.payout.update({
        where: { id },
        data: { status: 'FAILED' },
      });
      return { message: 'Payout rejected.' };
    }
  }

  // Merchant: get their payouts
  @Get('history')
  async getMerchantPayouts(@Req() req: any) {
    const merchant = await this.getMerchantFromRequest(req);
    return this.prisma.payout.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- helpers ----

  private async getMerchantFromRequest(req: any) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      const merchant = await this.prisma.merchant.findUnique({ where: { apiKey } });
      if (merchant) return merchant;
    }
    if (req.user?.merchant) return req.user.merchant;
    if (req.user?.merchantId) {
      const merchant = await this.prisma.merchant.findUnique({ where: { id: req.user.merchantId } });
      if (merchant) return merchant;
    }
    throw new UnauthorizedException('Merchant not found');
  }

  private ensureAdmin(req: any) {
    if (req.user?.role !== 'GATEWAY_ADMIN' && req.user?.isAdmin !== true) {
      throw new UnauthorizedException('Admin access required');
    }
  }
  @Get('balance')
  async getBalance(@Req() req: any) {
    const merchant = await this.getMerchantFromRequest(req);
    return this.settlementService.getBalance(merchant.id);
  }
}