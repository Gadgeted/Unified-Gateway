import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PosCheckoutDto } from './pos-checkout.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // 1. Process POS Counter Sale & Deduct Inventory
  async processPosSale(merchantId: string, dto: PosCheckoutDto) {
    let grandTotal = 0;
    const itemsWithReceiptDetails: any[] = [];

    // Loop through each item to verify stock levels and calculate prices
    for (const item of dto.items) {
      const product = await this.prisma.inventory.findUnique({
        where: { sku: item.sku },
      });

      if (!product || product.merchantId !== merchantId) {
        throw new NotFoundException(`Product with SKU ${item.sku} not found.`);
      }

      if (product.stockCount < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.itemName}. Only ${product.stockCount} left.`);
      }

      const itemTotal = product.price * item.quantity;
      grandTotal += itemTotal;

      itemsWithReceiptDetails.push({
        name: product.itemName,
        qty: item.quantity,
        pricePerUnit: product.price,
        total: itemTotal,
      });

      // Deduct the quantity from the shopkeeper's stock count
      await this.prisma.inventory.update({
        where: { sku: item.sku },
        data: { stockCount: product.stockCount - item.quantity },
      });
    }

    // Generate a structured format optimized for standard 58mm/80mm thermal printers
    const thermalPrintPayload = {
      header: 'RECEIPT OF PAYMENT',
      timestamp: new Date().toLocaleString(),
      items: itemsWithReceiptDetails,
      summary: {
        subtotal: grandTotal,
        tax: grandTotal * 0.16, // Example 16% local VAT
        total: grandTotal,
      },
      footer: 'Thank you for shopping with us! Powered by Unified API',
    };

    return {
      success: true,
      totalCharged: grandTotal,
      printData: thermalPrintPayload, // This goes directly to the thermal print client
    };
  }

  // 2. Track Business Expenses
  async logExpense(merchantId: string, title: string, amount: number, category: string) {
    return this.prisma.expense.create({
      data: { merchantId, title, amount, category },
    });
  }

  // 3. Track Employee Salaries
  async recordSalaryPayout(merchantId: string, employeeName: string, amount: number, status: string) {
    return this.prisma.salary.create({
      data: { merchantId, employeeName, amount, status },
    });
  }
}