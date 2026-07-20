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

  async getAdminOverview() {
    const totalMerchants = await this.prisma.merchant.count();
    const totalTransactions = await this.prisma.transaction.count();
    const successfulTransactions = await this.prisma.transaction.count({
      where: { status: 'SUCCESS' },
    });

    const transactionAggregates = await this.prisma.transaction.aggregate({
      _sum: {
        amountGross: true,
        processingFee: true,
        amountNet: true,
      },
    });

    const successRate = totalTransactions > 0
      ? (successfulTransactions / totalTransactions) * 100
      : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSuccesses = await this.prisma.transaction.findMany({
      where: {
        status: 'SUCCESS',
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        amountGross: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const dailyVolumeMap: { [date: string]: number } = {};
    recentSuccesses.forEach((tx) => {
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
      totalMerchants,
      totalTransactions,
      totalGrossVolume: transactionAggregates._sum.amountGross || 0,
      totalFeesCollected: transactionAggregates._sum.processingFee || 0,
      totalNetPayout: transactionAggregates._sum.amountNet || 0,
      activeMerchants: totalMerchants,
      successRate: parseFloat(successRate.toFixed(1)),
      chartData,
    };
  }

  async getAdminTenants() {
    const transactionTotals = await this.prisma.transaction.groupBy({
      by: ['merchantId'],
      _count: { id: true },
      _sum: { amountGross: true },
    });

    const totalsByMerchant = transactionTotals.reduce((map, item) => {
      map[item.merchantId] = {
        totalVolume: item._sum.amountGross || 0,
        totalTransactions: item._count.id,
      };
      return map;
    }, {} as Record<string, { totalVolume: number; totalTransactions: number }>);

    const merchants = await this.prisma.merchant.findMany({
      select: {
        id: true,
        businessName: true,
        email: true,
        apiKey: true,
        createdAt: true,
        mpesaFeePercent: true,
        airtelFeePercent: true,
        cardFeePercent: true,
        cryptoFeePercent: true,
      },
    });

    return merchants.map((merchant) => ({
      id: merchant.id,
      businessName: merchant.businessName,
      email: merchant.email,
      apiKey: merchant.apiKey,
      createdAt: merchant.createdAt,
      mpesaFeePercent: merchant.mpesaFeePercent,
      airtelFeePercent: merchant.airtelFeePercent,
      cardFeePercent: merchant.cardFeePercent,
      cryptoFeePercent: merchant.cryptoFeePercent,
      totalVolume: totalsByMerchant[merchant.id]?.totalVolume || 0,
      totalTransactions: totalsByMerchant[merchant.id]?.totalTransactions || 0,
      isActive: (totalsByMerchant[merchant.id]?.totalTransactions || 0) > 0,
    }));
  }

  async getMerchantTransactions(merchantId: string, limit: number = 50) {
    return this.prisma.transaction.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      // no select – returns all fields
    });
  }

  async getAllTransactions(limit: number = 100) {
    return this.prisma.transaction.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { merchant: { select: { businessName: true } } },
    });
  }
  // async getMerchantTransactions(merchantId: string, limit: number = 50) {
  //   return this.prisma.transaction.findMany({
  //     where: { merchantId },
  //     orderBy: { createdAt: 'desc' },
  //     take: limit,
  //     select: {
  //       id: true,
  //       merchantReference: true,
  //       paymentMethod: true,
  //       amountGross: true,
  //       amountNet: true,
  //       processingFee: true,
  //       status: true,
  //       createdAt: true,
  //       gatewayReference: true,
  //     },
  //   });
  // }

}
