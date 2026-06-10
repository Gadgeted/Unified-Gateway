import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // 1. Fetch deep commercial metrics for a specific merchant
  async getMerchantDashboard(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) throw new NotFoundException('Merchant record not found.');

    // Fetch all successful transactions to compute real metrics
    const successfulTx = await this.prisma.transaction.findMany({
      where: {
        merchantId: merchantId,
        status: TransactionStatus.SUCCESS,
      },
    });

    // Run calculations across the ledger results
    const totalGrossVolume = successfulTx.reduce((sum, tx) => sum + tx.amountGross, 0);
    const totalPlatformFees = successfulTx.reduce((sum, tx) => sum + tx.processingFee, 0);
    const totalMerchantNet = successfulTx.reduce((sum, tx) => sum + tx.amountNet, 0);

    // Group transaction volumes by payment channel method
    const breakdown = {
      mpesa: successfulTx.filter(tx => tx.paymentMethod === 'MPESA').reduce((sum, tx) => sum + tx.amountGross, 0),
      airtel: successfulTx.filter(tx => tx.paymentMethod === 'AIRTEL').reduce((sum, tx) => sum + tx.amountGross, 0),
      card: successfulTx.filter(tx => tx.paymentMethod === 'CARD').reduce((sum, tx) => sum + tx.amountGross, 0),
      crypto: successfulTx.filter(tx => tx.paymentMethod === 'CRYPTO').reduce((sum, tx) => sum + tx.amountGross, 0),
    };

    // Pull operational metrics from POS tracking tables
    const totalExpenses = await this.prisma.expense.aggregate({
      where: { merchantId },
      _sum: { amount: true },
    });

    const totalSalaries = await this.prisma.salary.aggregate({
      where: { merchantId },
      _sum: { amount: true },
    });

    const expenseSum = totalExpenses._sum.amount || 0;
    const salarySum = totalSalaries._sum.amount || 0;

    return {
      businessName: merchant.businessName,
      metrics: {
        totalGrossVolume,
        platformFeesCollected: totalPlatformFees,
        withdrawableBalance: totalMerchantNet,
        totalBusinessExpenses: expenseSum,
        totalEmployeeSalaries: salarySum,
        netBusinessProfit: totalMerchantNet - (expenseSum + salarySum),
      },
      channelVolumeDistribution: breakdown,
      transactionCount: successfulTx.length,
    };
  }
}