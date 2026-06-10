import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PosCheckoutDto } from './pos-checkout.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/pos')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  // Helper method to look up merchant by header API key
  private async getMerchantId(apiKey: string): Promise<string> {
    if (!apiKey) throw new UnauthorizedException('Missing API key header.');
    const merchant = await this.prisma.merchant.findUnique({ where: { apiKey } });
    if (!merchant) throw new UnauthorizedException('Invalid API Key.');
    return merchant.id;
  }

  @Post('checkout')
  async handleCheckout(@Body() dto: PosCheckoutDto, @Headers('x-api-key') apiKey: string) {
    const merchantId = await this.getMerchantId(apiKey);
    return this.inventoryService.processPosSale(merchantId, dto);
  }

  @Post('expenses')
  async handleExpense(
    @Body() body: { title: string; amount: number; category: string },
    @Headers('x-api-key') apiKey: string,
  ) {
    const merchantId = await this.getMerchantId(apiKey);
    return this.inventoryService.logExpense(merchantId, body.title, body.amount, body.category);
  }

  @Post('salaries')
  async handleSalary(
    @Body() body: { employeeName: string; amount: number; status: string },
    @Headers('x-api-key') apiKey: string,
  ) {
    const merchantId = await this.getMerchantId(apiKey);
    return this.inventoryService.recordSalaryPayout(merchantId, body.employeeName, body.amount, body.status);
  }
}