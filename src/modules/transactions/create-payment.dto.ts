import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  amount!: number;               // Gross amount to charge (e.g., 2500)
  currency!: string;             // e.g., "KES"
  paymentMethod!: PaymentMethod; // Must strictly be: 'MPESA', 'AIRTEL', 'CARD', or 'CRYPTO'
  customerIdentifier!: string;   // Phone number (for mobile money) or wallet address/card details
  merchantReference!: string;    // The shopkeeper's internal order/invoice ID
  isSandbox?: boolean;           // ◄ Added as an optional flag (defaults to false if not provided)
  cardToken?: string;        // tokenized Visa/Mastercard processing For CARD payments, this would be a tokenized card reference from the frontend 
}