import { Controller, Get, Post, Patch, Delete, Body, Param, Headers, UnauthorizedException, UseGuards, Req, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Controller('v1/tickets')
@UseGuards(HybridAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Merchant creates a ticket (merchantId taken from authenticated user)
  @Post()
  async create(
    @Body() body: { subject: string; description: string; category: string; priority?: string },
    @Req() req: any,
  ) {
    const merchantId = req.user?.merchant?.id || req.user?.merchantId;
    if (!merchantId) {
      throw new UnauthorizedException('Merchant not found.');
    }
    return this.ticketsService.create(merchantId, body);
  }

  // Get tickets – merchant sees only theirs, admin sees all (optionally filtered by merchantId)
  @Get()
  async findAll(@Req() req: any, @Query('merchantId') merchantId?: string) {
    const userRole = req.user?.role;
    if (userRole === 'STORE_OWNER') {
      // Merchant – use their own merchantId
      const ownMerchantId = req.user?.merchant?.id || req.user?.merchantId;
      if (!ownMerchantId) {
        throw new UnauthorizedException('Merchant not found.');
      }
      return this.ticketsService.findAll(ownMerchantId);
    }
    // Admin – filter by merchantId if provided, else all
    return this.ticketsService.findAll(merchantId);
  }

  // Get a single ticket (merchant can only see theirs, admin can see any)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const ticket = await this.ticketsService.findOne(id);
    const userRole = req.user?.role;
    if (userRole === 'STORE_OWNER') {
      const ownMerchantId = req.user?.merchant?.id || req.user?.merchantId;
      if (ticket.merchantId !== ownMerchantId) {
        throw new UnauthorizedException('You can only view your own tickets.');
      }
    }
    return ticket;
  }

  // Admin updates ticket
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { status?: string; priority?: string; subject?: string; description?: string },
    @Req() req: any,
  ) {
    // Only admin can update tickets (merchants cannot edit)
    if (req.user?.role !== 'GATEWAY_ADMIN') {
      throw new UnauthorizedException('Only admin can update tickets.');
    }
    return this.ticketsService.update(id, body);
  }

  // Admin deletes ticket
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    if (req.user?.role !== 'GATEWAY_ADMIN') {
      throw new UnauthorizedException('Only admin can delete tickets.');
    }
    return this.ticketsService.delete(id);
  }
}