import { Controller, Post, Body, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';
import { MpesaIpGuard } from '../../common/guards/mpesa-ip.guard';

@Controller('v1/mpesa')
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 1. EXISTING STK PUSH CALLBACK (unchanged)
  // ============================================================
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(MpesaIpGuard)
  async handleMpesaCallback(@Body() callbackPayload: any) {
    this.logger.log('Incoming M-Pesa Callback payload intercepted.');

    try {
      const stkCallback = callbackPayload.Body.stkCallback;
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;

      const transaction = await this.prisma.transaction.findUnique({
        where: { gatewayReference: checkoutRequestId },
      });

      if (!transaction) {
        this.logger.error(`Transaction record matching CheckoutRequestID ${checkoutRequestId} not found.`);
        return { ResultCode: 1, ResultDesc: 'Transaction reference mapping error' };
      }

      if (resultCode !== 0) {
        this.logger.warn(`Payment failed or cancelled. Reason: ${resultDesc}`);
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: TransactionStatus.FAILED },
        });
        return { ResultCode: 0, ResultDesc: 'Failure recorded successfully' };
      }

      const callbackMetadataItems = stkCallback.CallbackMetadata.Item;
      let mpesaReceiptNumber = '';
      for (const item of callbackMetadataItems) {
        if (item.Name === 'MpesaReceiptNumber') {
          mpesaReceiptNumber = item.Value;
          break;
        }
      }

      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.SUCCESS,
          gatewayReference: mpesaReceiptNumber,
        },
      });

      this.logger.log(`Transaction ${transaction.id} successfully completed. Receipt: ${mpesaReceiptNumber}`);

      // Fire POS webhook (optional, keep as is)
      try {
        this.logger.log(`Communicating validation data back to POS backend for invoice: ${transaction.merchantReference}`);
        const posResponse = await fetch('http://localhost:5000/api/mpesa/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_reference: transaction.merchantReference,
            mpesa_code: mpesaReceiptNumber,
            payment_channel: 'mpesa',
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

      return { ResultCode: 0, ResultDesc: 'Callback processed successfully' };
    } catch (error: any) {
      this.logger.error(`Error processing M-Pesa callback: ${error.message}`);
      return { ResultCode: 0, ResultDesc: 'Acknowledged with internal log catch' };
    }
  }

  // ============================================================
  // 2. NEW: B2C RESULT CALLBACK
  // ============================================================
  @Post('b2c/result')
  @HttpCode(HttpStatus.OK)
  async handleB2cResult(@Body() body: any) {
    this.logger.log('📩 B2C Result Callback received', body);
    try {
      const result = body.Result || body;
      const resultCode = body.ResultCode; // 0 = success
      const transactionId = body.TransactionID;
      const resultDesc = body.ResultDesc;

      if (resultCode === 0) {
        this.logger.log(`✅ B2C payout successful: ${transactionId}`);
        // Optionally update payout status in DB (you need to store ConversationID or link to payout)
        // For now we just log.
      } else {
        this.logger.error(`❌ B2C failed: ${resultDesc} (code ${resultCode})`);
        // Optionally mark payout as FAILED
      }

      return { ResultCode: 0, ResultDesc: 'Accepted' };
    } catch (error) {
      this.logger.error('B2C result processing error', error);
      return { ResultCode: 1, ResultDesc: 'Internal error' };
    }
  }

  // ============================================================
  // 3. NEW: B2C TIMEOUT CALLBACK
  // ============================================================
  @Post('b2c/timeout')
  @HttpCode(HttpStatus.OK)
  async handleB2cTimeout(@Body() body: any) {
    this.logger.warn('⏱️ B2C Timeout Callback received', body);
    // Optionally mark the payout as FAILED
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}