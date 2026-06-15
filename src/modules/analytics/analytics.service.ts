import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Existing or upgraded dashboard statistics calculation method
  async getMerchantDashboard(merchantId: string) {
    // Fetch aggregate metrics for successful transactions matching this merchant
    const successfulAggregates = await this.prisma.transaction.aggregate({
      where: {
        merchantId: merchantId,
        status: 'SUCCESS',
      },
      _sum: {
        amountGross: true,
        processingFee: true,
        amountNet: true,
      },
      _count: {
        id: true,
      },
    });

    const failureCount = await this.prisma.transaction.count({
      where: { 
        merchantId: merchantId,
        status: 'FAILED',
      },
    });

    const totalAttempts = (successfulAggregates._count.id || 0) + failureCount;
    const successRate = totalAttempts > 0 
      ? ((successfulAggregates._count.id || 0) / totalAttempts) * 100 
      : 0;

    // Generate rolling 7-day trend history chart coordinates
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const checkouts = await this.prisma.transaction.findMany({
      where: {
        merchantId: merchantId,
        status: 'SUCCESS',
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        amountGross: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const dailyVolumeMap: { [key: string]: number } = {};
    checkouts.forEach((tx) => {
      const dateKey = new Date(tx.createdAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      dailyVolumeMap[dateKey] = (dailyVolumeMap[dateKey] || 0) + tx.amountGross;
    });

    const chartData = Object.keys(dailyVolumeMap).map((date) => ({
      date,
      volume: dailyVolumeMap[date],
    }));

    return {
      metrics: {
        totalGrossVolume: successfulAggregates._sum.amountGross || 0,
        totalFeesCollected: successfulAggregates._sum.processingFee || 0,
        totalNetPayout: successfulAggregates._sum.amountNet || 0,
        successfulTransactions: successfulAggregates._count.id || 0,
        failedTransactions: failureCount,
        successRate: parseFloat(successRate.toFixed(1)),
      },
      chartData,
    };
  }

  // 2. Step 2 Execution Engine: Pulls scrolling real-time system logs
  async getRecentMerchantTransactions(merchantId: string, limit: number) {
    return this.prisma.transaction.findMany({
      where: { merchantId: merchantId },
      take: limit,
      orderBy: { createdAt: 'desc' }, // Keeps freshest transactions on top
    });
  }
}