import { Controller, Post, Body, HttpCode, HttpStatus, Get, Patch, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ✅ NEW: Admin endpoint to reassign merchant to a user (by email)
  @Patch('admin/users/by-email/:email/merchant')
  @UseGuards(HybridAuthGuard)
  async updateUserMerchantByEmail(
    @Param('email') email: string,
    @Body() body: { merchantId: string },
    @Req() req: any,
  ) {
    this.ensureAdmin(req);

    const user = await this.prisma.user.update({
      where: { email },
      data: { merchantId: body.merchantId },
    });

    return {
      message: 'User merchant updated successfully',
      user: {
        id: user.id,
        email: user.email,
        merchantId: user.merchantId,
      },
    };
  }

  // ----- helper -----
  private ensureAdmin(req: any) {
    if (req.user?.role !== 'GATEWAY_ADMIN' && req.user?.isAdmin !== true) {
      throw new UnauthorizedException('Admin access required');
    }
  }
}