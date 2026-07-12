// file: src/modules/transactions/transactions.service.ts
import { Injectable, UnauthorizedException, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './create-payment.dto';
import { PaymentMethod, TransactionStatus } from '@prisma/client';
import { MpesaService } from '../mpesa/mpesa.service';
import { AirtelService } from '../airtel/airtel.service';
import { CardService } from '../cards/card.service';
import { CryptoService } from '../crypto/crypto.service'; 

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private mpesaService: MpesaService,
    private airtelService: AirtelService,
    private cardService: CardService,
    private cryptoService: CryptoService, 
  ) {}

  async processIncomingPayment(dto: CreatePaymentDto, userContext: any) {
  // If userContext.merchant exists, use it directly
  let merchant = userContext.merchant;
  if (!merchant && userContext.merchantId) {
    // fallback: fetch merchant from DB if only id provided
    merchant = await this.prisma.merchant.findUnique({ where: { id: userContext.merchantId } });
  }
  if (!merchant) throw new UnauthorizedException('Merchant not found');

    let feePercent = 0;
    switch (dto.paymentMethod) {
      case PaymentMethod.MPESA: feePercent = merchant.mpesaFeePercent; break;
      case PaymentMethod.AIRTEL: feePercent = merchant.airtelFeePercent; break;
      case PaymentMethod.CARD: feePercent = merchant.cardFeePercent; break;
      case PaymentMethod.CRYPTO: feePercent = merchant.cryptoFeePercent; break;
      default: throw new BadRequestException('Unsupported payment method.');
    }

    const processingFee = (dto.amount * feePercent) / 100;
    const amountNet = dto.amount - processingFee;

    // Capture the merchantReference directly from your POS tracking engine context
    const transaction = await this.prisma.transaction.create({
      data: {
        merchantId: merchant.id,
        amountGross: dto.amount,
        processingFee: processingFee,
        amountNet: amountNet,
        currency: dto.currency || 'KES',
        paymentMethod: dto.paymentMethod,
        status: TransactionStatus.PENDING,
        customerIdentifier: dto.customerIdentifier,
        merchantReference: dto.merchantReference,
      },
    });

    if (dto.isSandbox) {
      return this.simulateSandboxPayment(transaction.id, dto.paymentMethod);
    }

    // --- LIVE PRODUCTION GATEWAY ROUTING ENGINE ---
    switch (dto.paymentMethod) {
      case PaymentMethod.MPESA:
        const mpesaResponse = await this.mpesaService.triggerStkPush(transaction);
        if (mpesaResponse.ResponseCode === '0') {
          await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { gatewayReference: mpesaResponse.CheckoutRequestID },
          });
        }
        return {
          mode: 'LIVE',
          message: 'M-Pesa STK Push initiated successfully.',
          transactionId: transaction.id,
          gatewayStatus: mpesaResponse.ResponseDescription,
          checkoutRequestId: mpesaResponse.CheckoutRequestID,
        };

      case PaymentMethod.AIRTEL:
        const airtelResponse = await this.airtelService.triggerAirtelPush(transaction);
        if (airtelResponse.status?.success === true) {
          await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { gatewayReference: airtelResponse.transaction?.id },
          });
        }
        return {
          mode: 'LIVE',
          message: 'Airtel Money payment request initiated.',
          transactionId: transaction.id,
          gatewayStatus: airtelResponse.status?.message,
        };

      case PaymentMethod.CARD:
        const cardResponse = await this.cardService.processCardPayment(transaction, dto.cardToken);
        if (cardResponse.status === 'succeeded') {
          const updatedCardTx = await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: TransactionStatus.SUCCESS, gatewayReference: cardResponse.id },
          });

          if (merchant.webhookUrl) {
            await this.dispatchWebhookNotification(merchant.webhookUrl, updatedCardTx);
          }
        }
        return {
          mode: 'LIVE',
          message: 'Card transaction charged successfully.',
          transactionId: transaction.id,
          gatewayReference: cardResponse.id,
          status: TransactionStatus.SUCCESS,
        };

      case PaymentMethod.CRYPTO:
        const cryptoDetails = await this.cryptoService.generateDepositAddress(transaction);
        
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { gatewayReference: cryptoDetails.trackingHash },
        });

        return {
          mode: 'LIVE',
          message: 'Blockchain tracking layer successfully initialized.',
          transactionId: transaction.id,
          depositAddress: cryptoDetails.depositAddress,
          paymentNetwork: 'Ethereum Sepolia (Or Chosen Chain)',
          instructions: `Send exactly ${transaction.amountGross} ${transaction.currency || 'USDT'} to the assigned depositAddress.`,
          trackingHash: cryptoDetails.trackingHash,
        };

      default:
        return transaction;
    }
  }

  private async simulateSandboxPayment(transactionId: string, method: PaymentMethod) {
    const mockGatewayRef = `SANDBOX_MOCK_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { gatewayReference: mockGatewayRef },
    });

    setTimeout(async () => {
      try {
        const finalStatus = Math.random() > 0.15 ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;
        const finalRef = finalStatus === TransactionStatus.SUCCESS ? `MOCK_TX_${Math.random().toString(36).substring(2, 12).toUpperCase()}` : mockGatewayRef;

        const updatedTx = await this.prisma.transaction.update({
          where: { id: transactionId },
          data: { status: finalStatus, gatewayReference: finalRef },
        });

        this.logger.log(`[SANDBOX] Auto-processed simulation for TX ${transactionId}. Status resolved to: ${finalStatus}`);

        const merchant = await this.prisma.merchant.findUnique({ where: { id: updatedTx.merchantId } });
        if (merchant?.webhookUrl) {
          await this.dispatchWebhookNotification(merchant.webhookUrl, updatedTx);
        }
      } catch (err: any) {
        this.logger.error(`[SANDBOX] Background simulation error: ${err.message}`);
      }
    }, 3000);

    return {
      mode: 'SANDBOX',
      message: `${method} payment simulated. Verification webhook loop initialized.`,
      transactionId: transactionId,
      gatewayReference: mockGatewayRef,
      expectedResolution: 'Status will resolve asynchronously within 3 seconds.'
    };
  }

  // Fixed Callback Worker mapping cleanly via 'gatewayReference' field
  async updateTransactionByCheckoutId(checkoutRequestId: string, finalStatus: 'SUCCESS' | 'FAILED', carrierCode: string | null) {
    this.logger.log(`Prisma updating Ledger for Checkout Request ID: ${checkoutRequestId} -> target: ${finalStatus}`);
    
    const transaction = await this.prisma.transaction.findFirst({
      where: { gatewayReference: checkoutRequestId },
    });

    if (!transaction) {
      this.logger.error(`Transaction record matching gatewayReference [${checkoutRequestId}] missing from tracking index.`);
      throw new NotFoundException('Transaction reference mismatch.');
    }

    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { 
        status: finalStatus === 'SUCCESS' ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
        gatewayReference: carrierCode || transaction.gatewayReference
      },
    });

    const merchant = await this.prisma.merchant.findUnique({ where: { id: transaction.merchantId } });
    if (merchant?.webhookUrl) {
      await this.dispatchWebhookNotification(merchant.webhookUrl, updatedTransaction);
    }

    return updatedTransaction;
  }

  // Retain legacy method format for structural tracking modules referencing it elsewhere
  async updateTransactionByGatewayRef(checkoutRequestId: string, finalStatus: 'SUCCESS' | 'FAILED') {
    return this.updateTransactionByCheckoutId(checkoutRequestId, finalStatus, null);
  }

  // POS Shared Reference Query Mapping Anchor
  async getTransactionStatusByMerchantRef(merchantRef: string, apiKey: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { apiKey },
    });
    if (!merchant) throw new UnauthorizedException('Access denied.');

    const transaction = await this.prisma.transaction.findFirst({
      where: { 
        merchantReference: merchantRef,
        merchantId: merchant.id
      },
      select: {
        merchantReference: true,
        gatewayReference: true,
        amountGross: true,
        status: true,
        paymentMethod: true,
        updatedAt: true
      }
    });

    if (!transaction) {
      throw new NotFoundException(`No transactional record found for reference anchor: ${merchantRef}`);
    }

    return transaction;
  }

  // Automated instant status propagation engine
  private async dispatchWebhookNotification(url: string, transaction: any) {
    try {
      this.logger.log(`Dispatching transactional sync state event payload to merchant webhook: ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment.synchronized',
          merchantReference: transaction.merchantReference,
          gatewayReference: transaction.gatewayReference,
          status: transaction.status,
          paymentMethod: transaction.paymentMethod,
          amount: transaction.amountGross
        })
      });
      this.logger.log(`Webhook endpoint responded with status code: ${response.status}`);
    } catch (err) {
      this.logger.error(`Failed to pass synchronized webhook state forward to ${url}:`, err);
    }
  }
}