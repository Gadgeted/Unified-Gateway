import { Controller, Post, Body, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';
import { MpesaIpGuard } from '../../common/guards/mpesa-ip.guard';

@Controller('v1/mpesa')
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('callback')
  @HttpCode(HttpStatus.OK) // Safaricom expects a standard HTTP 200 OK acknowledgment
  @UseGuards(MpesaIpGuard)
  async handleMpesaCallback(@Body() callbackPayload: any) {
    this.logger.log('Incoming M-Pesa Callback payload intercepted.');

    try {
      const stkCallback = callbackPayload.Body.stkCallback;
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;

      // 1. Locate the pending ledger item matching this checkout event
      const transaction = await this.prisma.transaction.findUnique({
        where: { gatewayReference: checkoutRequestId },
      });

      if (!transaction) {
        this.logger.error(`Transaction record matching CheckoutRequestID ${checkoutRequestId} not found.`);
        return { ResultCode: 1, ResultDesc: 'Transaction reference mapping error' };
      }

      // 2. Check if the payment failed or was cancelled by the user
      if (resultCode !== 0) {
        this.logger.warn(`Payment failed or cancelled. Reason: ${resultDesc}`);
        
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: TransactionStatus.FAILED },
        });

        return { ResultCode: 0, ResultDesc: 'Failure recorded successfully' };
      }

      // 3. Payment is successful! Extract Metadata parameters (Receipt Number)
      const callbackMetadataItems = stkCallback.CallbackMetadata.Item;
      let mpesaReceiptNumber = '';

      for (const item of callbackMetadataItems) {
        if (item.Name === 'MpesaReceiptNumber') {
          mpesaReceiptNumber = item.Value;
          break;
        }
      }

      // 4. Clean update of our unified ledger table to SUCCESS
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.SUCCESS,
          gatewayReference: mpesaReceiptNumber, // Swap the CheckoutRequestID with the permanent M-Pesa Receipt Number
        },
      });

      this.logger.log(`Transaction ${transaction.id} successfully completed. Receipt: ${mpesaReceiptNumber}`);
      
      // Tell Safaricom we received the data perfectly
      return { ResultCode: 0, ResultDesc: 'Callback processed successfully' };

    } catch (error: any) {
      this.logger.error(`Error processing M-Pesa callback: ${error.message}`);
      // Even if something goes wrong internally, we respond with a success frame to stop Safaricom from hammering us with retries
      return { ResultCode: 0, ResultDesc: 'Acknowledged with internal log catch' };
    }
  }
}