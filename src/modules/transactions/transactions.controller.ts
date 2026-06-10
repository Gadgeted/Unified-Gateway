import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreatePaymentDto } from './create-payment.dto';

@Controller('v1/payments')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async InitiatePayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Headers('x-api-key') apiKey: string, // Shopkeepers pass their unique secret key here
  ) {
    if (!apiKey) {
      throw new UnauthorizedException('API key is missing.');
    }
    return this.transactionsService.processIncomingPayment(createPaymentDto, apiKey);
  }
}