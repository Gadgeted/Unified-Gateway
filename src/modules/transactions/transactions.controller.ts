// file: src/modules/transactions/transactions.controller.ts
import { Controller, Post, Body, Headers, UnauthorizedException, Get, HttpCode, HttpStatus, Param, Logger, UseGuards, Req } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreatePaymentDto } from './create-payment.dto';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Controller('v1/payments')
@UseGuards(HybridAuthGuard)
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async InitiatePayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Req() req: any,
    @Headers('x-api-key') apiKey: string,
  ) {
    this.logger.log(`Incoming payment request, API Key header: ${apiKey}`);
    this.logger.log(`User context from guard: ${JSON.stringify(req.user)}`);

    // Pass both userContext and apiKey to the service
    return this.transactionsService.processIncomingPayment(createPaymentDto, req.user, apiKey);
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

  @Get('status/:merchantRef')
  async checkPaymentStatus(
    @Param('merchantRef') merchantRef: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    if (!apiKey) throw new UnauthorizedException('API key missing.');
    return this.transactionsService.getTransactionStatusByMerchantRef(merchantRef, apiKey);
  }

  @Post('mpesa-callback')
  @HttpCode(HttpStatus.OK)
  async handleMpesaCallback(@Body() callbackPayload: any) {
    try {
      if (!callbackPayload?.Body?.stkCallback) {
        return { ResultCode: 1, ResultDesc: "Invalid payload format structure." };
      }

      const mpesaResponse = callbackPayload.Body.stkCallback;
      const checkoutRequestId = mpesaResponse.CheckoutRequestID;
      const resultCode = mpesaResponse.ResultCode;
      
      let carrierTransactionCode: string | null = null;
      const finalStatus = resultCode === 0 ? 'SUCCESS' : 'FAILED';

      if (resultCode === 0 && mpesaResponse.CallbackMetadata?.Item) {
        const items = mpesaResponse.CallbackMetadata.Item;
        const transactionItem = items.find((item: any) => item.Name === 'MpesaReceiptNumber');
        if (transactionItem) {
          carrierTransactionCode = transactionItem.Value;
        }
      }

      this.logger.log(`Webhook hook triggered for CheckoutRequestID [${checkoutRequestId}] -> Status: ${finalStatus}, Code: ${carrierTransactionCode}`);

      await this.transactionsService.updateTransactionByCheckoutId(
        checkoutRequestId, 
        finalStatus, 
        carrierTransactionCode
      );

      return { 
        ResultCode: 0, 
        ResultDesc: "Callback processed and database records synchronized successfully." 
      };
    } catch (error) {
      console.error("Exception captured inside M-Pesa webhook worker logic core:", error);
      return { ResultCode: 1, ResultDesc: "Internal system logging runtime handling error." };
    }
  }
}