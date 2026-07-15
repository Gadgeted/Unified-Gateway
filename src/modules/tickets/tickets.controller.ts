import { Controller, Get, Post, Patch, Delete, Body, Param, Headers, UnauthorizedException, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';

@Controller('v1/tickets')
@UseGuards(HybridAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Merchant creates a ticket (they will pass merchantId in body or from user context)
  @Post()
  async create(
    @Body() body: { merchantId: string; subject: string; description: string; category: string; priority?: string },
    @Headers('x-api-key') apiKey: string,
  ) {
    // You might want to validate that the merchantId matches the authenticated merchant
    return this.ticketsService.create(body.merchantId, body);
  }

  // Admin gets all tickets
  @Get()
  async findAll() {
    return this.ticketsService.findAll();
  }

  // Admin or merchant can get a specific ticket
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  // Admin updates ticket status/priority
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { status?: string; priority?: string; subject?: string; description?: string },
  ) {
    return this.ticketsService.update(id, body);
  }

  // Admin deletes ticket
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.ticketsService.delete(id);
  }
}