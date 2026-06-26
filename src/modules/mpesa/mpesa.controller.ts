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

      // 5. 🚀 THE BRIDGE: Fire the webhook back to your Express POS Endpoint
      try {
        this.logger.log(`Communicating validation data back to POS backend for invoice: ${transaction.merchantReference}`);
        
        // This hits the working Express route you just shared
        const posResponse = await fetch('http://localhost:5000/api/mpesa/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoice_reference: transaction.merchantReference, // Matches your resolvedInvoiceReference
            mpesa_code: mpesaReceiptNumber,                  // Matches your resolvedTransactionCode
            payment_channel: 'mpesa'                          // Matches your resolvedPaymentChannel
          }),
        });

        if (posResponse.ok) {
          this.logger.log(`[POS Synced] Express POS DB successfully updated for invoice ${transaction.merchantReference}`);
        } else {
          const errText = await posResponse.text();
          this.logger.error(`[POS Sync Failed] POS server rejected sync payload: ${errText}`);
        }
      } catch (posError: any) {
        this.logger.error(`[POS Connection Error] Could not connect to POS server: ${posError.message}`);
      }
      
      // Tell Safaricom we received the data perfectly
      return { ResultCode: 0, ResultDesc: 'Callback processed successfully' };

    } catch (error: any) {
      this.logger.error(`Error processing M-Pesa callback: ${error.message}`);
      // Even if something goes wrong internally, we respond with a success frame to stop Safaricom from hammering us with retries
      return { ResultCode: 0, ResultDesc: 'Acknowledged with internal log catch' };
    }
  }
}