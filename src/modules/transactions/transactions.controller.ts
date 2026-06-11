import { Controller, Post, Body, Headers, UnauthorizedException, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreatePaymentDto } from './create-payment.dto';

@Controller('v1/payments')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async InitiatePayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Headers('x-api-key') apiKey: string,
  ) {
    if (!apiKey) {
      throw new UnauthorizedException('API key is missing.');
    }
    return this.transactionsService.processIncomingPayment(createPaymentDto, apiKey);
  }

  @Get('test')
  async verifyConnection(@Headers('x-api-key') apiKey: string) {
    const validKey = process.env.MERCHANT_API_KEY || 'tg_live_secret_key_abc123';

    if (!apiKey || apiKey !== validKey) {
      throw new UnauthorizedException('Invalid merchant configuration credentials signature.');
    }

    return {
      status: 'CONNECTED',
      timestamp: new Date().toISOString(),
      engine: 'PostgreSQL Link Stable',
    };
  }

  // Add this inside src/modules/transactions/transactions.controller.ts

@Get('status/:merchantRef')
async checkPaymentStatus(
  @Param('merchantRef') merchantRef: string,
  @Headers('x-api-key') apiKey: string,
) {
  if (!apiKey) throw new UnauthorizedException('API key missing.');
  return this.transactionsService.getTransactionStatusByMerchantRef(merchantRef, apiKey);
}

  // 👈 NEW: Asynchronous Safaricom Daraja M-Pesa Callback Webhook Endroute
  @Post('mpesa-callback')
  @HttpCode(HttpStatus.OK) // Explicitly respond with an HTTP 200 OK so Safaricom doesn't retry retries
  async handleMpesaCallback(@Body() callbackPayload: any) {
    try {
      // 1. Defend perimeter checks to ensure structural format matches Safaricom's callback wrapper
      if (!callbackPayload || !callbackPayload.Body || !callbackPayload.Body.stkCallback) {
        return { ResultCode: 1, ResultDesc: "Invalid payload format structure." };
      }

      const mpesaResponse = callbackPayload.Body.stkCallback;
      const checkoutRequestId = mpesaResponse.CheckoutRequestID; // Maps to gatewayReference in Prisma
      const resultCode = mpesaResponse.ResultCode; // 0 means operational absolute success

      // 2. Transpile numerical M-Pesa codes into our PostgreSQL database enum states
      // ResultCode 0 = Success. Anything else (e.g., 1032 for cancelled by user) is marked as FAILED
      const finalStatus = resultCode === 0 ? 'SUCCESS' : 'FAILED';

      console.log(`📡 Callback hook triggered for Reference [${checkoutRequestId}] -> Status Determined: ${finalStatus}`);

      // 3. Delegate execution flow control down to your database logic service
      await this.transactionsService.updateTransactionByGatewayRef(checkoutRequestId, finalStatus);

      // 4. Safaricom requires this exact response block to successfully close out the callback lifecycle loop
      return { 
        ResultCode: 0, 
        ResultDesc: "Callback processed and database records synchronized successfully." 
      };

    } catch (error) {
      console.error("❌ Exception captured inside M-Pesa webhook worker logic core:", error);
      // Even if internal code fails, we gracefully return to keep the stream moving
      return { ResultCode: 1, ResultDesc: "Internal system logging runtime handling error." };
    }
  }
}