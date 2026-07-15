import { Controller, Get, Post, Patch, Delete, Body, Param, Req, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Controller('v1/tickets')
@UseGuards(HybridAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const merchantId = req.user?.merchant?.id || req.user?.merchantId;
    if (!merchantId) throw new Error('Merchant not found');
    return this.ticketsService.create(merchantId, body);
  }

  @Get()
  async findAll(@Req() req: any, @Query('merchantId') merchantId?: string) {
    if (req.user?.role === 'STORE_OWNER') {
      const ownId = req.user?.merchant?.id || req.user?.merchantId;
      return this.ticketsService.findAll(ownId);
    }
    return this.ticketsService.findAll(merchantId);
  }

  // ✅ MOVED notifications routes BEFORE the :id routes
  @Get('notifications')
  async getNotifications(@Req() req: any) {
    return this.ticketsService.getNotifications(req.user?.id);
  }

  @Patch('notifications/:id/read')
  async markNotificationRead(@Param('id') id: string) {
    return this.ticketsService.markNotificationRead(id);
  }

  // ✅ Now :id routes come AFTER the specific ones
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const ticket = await this.ticketsService.findOneWithMessages(id);
    if (req.user?.role === 'STORE_OWNER') {
      const ownId = req.user?.merchant?.id || req.user?.merchantId;
      if (ticket.merchantId !== ownId) throw new Error('Unauthorized');
    }
    return ticket;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (req.user?.role !== 'GATEWAY_ADMIN') throw new Error('Admin only');
    return this.ticketsService.update(id, body);
  }

  @Post(':id/messages')
  async addMessage(@Param('id') id: string, @Body() body: { message: string }, @Req() req: any) {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const senderType = role === 'GATEWAY_ADMIN' ? 'ADMIN' : 'MERCHANT';
    if (!userId) throw new UnauthorizedException('User not authenticated');
    return this.ticketsService.addMessage(id, userId, senderType, body.message);
  }
}