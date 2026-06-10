export class PosItemDto {
  sku!: string;        // Barcode / Stock Keeping Unit
  quantity!: number;   // Number of items bought
}

export class PosCheckoutDto {
  items!: PosItemDto[]; // Array of products bought in this sale
  paymentMethod!: 'MPESA' | 'AIRTEL' | 'CARD' | 'CRYPTO';
  customerIdentifier!: string; // Customer's phone number or reference
}