import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async create(merchantId: string, data: { subject: string; description: string; category: string; priority?: string }) {
    return this.prisma.ticket.create({
      data: {
        merchantId,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority || 'MEDIUM',
        status: 'OPEN',
      },
    });
  }

  async findAll(merchantId?: string) {
    return this.prisma.ticket.findMany({
      where: merchantId ? { merchantId } : undefined,
      include: { merchant: { select: { businessName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { merchant: { select: { businessName: true, email: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async update(id: string, data: { status?: string; priority?: string; subject?: string; description?: string }) {
    return this.prisma.ticket.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.ticket.delete({ where: { id } });
  }
}