import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        fullName: dto.fullName,
        role: dto.role || 'STORE_OWNER',
      },
    });

    // ✅ Explicitly type merchant as any to avoid null inference issues
    let merchant: any = null;

    // If STORE_OWNER and businessName provided, create merchant and link
    if (user.role === 'STORE_OWNER' && dto.businessName) {
      const apiKey = `tg_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      merchant = await this.prisma.merchant.create({
        data: {
          businessName: dto.businessName,
          email: dto.email,
          apiKey,
          users: { connect: { id: user.id } },
        },
      });
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        merchantId: merchant?.id || user.merchantId,
        merchant: merchant, // ✅ Send the merchant object
      },
    };
  }

  async login(dto: LoginDto) {
    // ✅ Cast to 'any' to access merchant
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { merchant: true },
    }) as any;

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        merchantId: user.merchant?.id,
        merchant: user.merchant, // ✅ Include merchant
      },
    };
  }
}