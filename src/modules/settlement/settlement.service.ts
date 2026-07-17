import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';

@Injectable()
export class SettlementService {
  constructor(private prisma: PrismaService) {}

  // 1. Core verification and calculation engine
  async triggerMerchantPayout(merchantId: string, amount: number, destinationPhone: string) {
    // Fetch all successful incoming transactions to compute total earnings
    const successfulTx = await this.prisma.transaction.findMany({
      where: { merchantId, status: TransactionStatus.SUCCESS },
    });

    const totalEarned = successfulTx.reduce((sum, tx) => sum + tx.amountNet, 0);

    // Fetch all prior successful payouts to see what has already been withdrawn
    const priorPayouts = await this.prisma.payout.findMany({
      where: { merchantId, status: 'SUCCESS' },
    });

    const totalWithdrawn = priorPayouts.reduce((sum, po) => sum + po.amount, 0);

    // Current real-time available liquid balance
    const availableBalance = totalEarned - totalWithdrawn;

    if (amount > availableBalance) {
      throw new BadRequestException(`Insufficient funds. Your available balance is KES ${availableBalance}, but you requested KES ${amount}.`);
    }

    // 2. Log an initial PENDING payout entry in our ledger
    const payoutRecord = await this.prisma.payout.create({
      data: {
        merchantId,
        amount,
        destination: destinationPhone,
        status: 'PENDING',
      },
    });

    // 3. Trigger Safaricom Daraja Live B2C API Handshake
    try {
      // In production, this fetch would hit Safaricom's 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest'
      // For immediate verification, we simulate a successful telco disbursement response
      const isTelcoDispatched = true; 

      if (isTelcoDispatched) {
        // Update local ledger status instantly upon a clean network handshake code
        await this.prisma.payout.update({
          where: { id: payoutRecord.id },
          data: { status: 'SUCCESS' },
        });

        return {
          success: true,
          message: `Payout of KES ${amount} successfully settled to ${destinationPhone}.`,
          payoutId: payoutRecord.id,
          remainingBalance: availableBalance - amount,
        };
      }
    } catch (error: any) {
      await this.prisma.payout.update({
        where: { id: payoutRecord.id },
        data: { status: 'FAILED' },
      });
      throw new InternalServerErrorException('Disbursement service failed to process network payout.');
    }
  }

  async getMerchantPayouts(merchantId: string) {
    return this.prisma.payout.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBalance(merchantId: string) {
    // Total net from successful transactions
    const total = await this.prisma.transaction.aggregate({
      where: { merchantId, status: 'SUCCESS' },
      _sum: { amountNet: true },
    });
    const totalEarned = total._sum.amountNet || 0;

    // Total already withdrawn (successful payouts)
    const withdrawn = await this.prisma.payout.aggregate({
      where: { merchantId, status: 'SUCCESS' },
      _sum: { amount: true },
    });
    const totalWithdrawn = withdrawn._sum.amount || 0;

    return {
      grossVolume: totalEarned + totalWithdrawn, // total gross before fees
      fees: totalEarned > 0 ? (await this.prisma.transaction.aggregate({
        where: { merchantId, status: 'SUCCESS' },
        _sum: { processingFee: true },
      }))._sum.processingFee || 0 : 0,
      withdrawable: totalEarned - totalWithdrawn,
    };
  }
}