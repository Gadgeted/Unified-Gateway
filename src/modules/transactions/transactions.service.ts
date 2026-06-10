import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './create-payment.dto';
import { PaymentMethod, TransactionStatus } from '@prisma/client';
import { MpesaService } from '../mpesa/mpesa.service';
import { AirtelService } from '../airtel/airtel.service';
import { CardService } from '../cards/card.service';
import { CryptoService } from '../crypto/crypto.service'; // ◄ Import crypto service

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private mpesaService: MpesaService,
    private airtelService: AirtelService,
    private cardService: CardService,
    private cryptoService: CryptoService, // ◄ Inject Crypto Service
  ) {}

  async processIncomingPayment(dto: CreatePaymentDto, apiKey: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { apiKey },
    });

    if (!merchant) throw new UnauthorizedException('Invalid API Key provided.');

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
          await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: TransactionStatus.SUCCESS, gatewayReference: cardResponse.id },
          });
        }
        return {
          mode: 'LIVE',
          message: 'Card transaction charged successfully.',
          transactionId: transaction.id,
          gatewayReference: cardResponse.id,
          status: TransactionStatus.SUCCESS,
        };

      case PaymentMethod.CRYPTO:
        // Execute the Web3 dynamic assignment logic
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

        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: { status: finalStatus, gatewayReference: finalRef },
        });
        this.logger.log(`[SANDBOX] Auto-processed simulation for TX ${transactionId}. Status resolved to: ${finalStatus}`);
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
}