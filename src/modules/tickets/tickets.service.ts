import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async create(merchantId: string, data: { subject: string; description: string; category: string; priority?: string }) {
    const ticket = await this.prisma.ticket.create({
      data: {
        merchantId,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority || 'MEDIUM',
        status: 'OPEN',
      },
    });

    // ✅ Call the class method – NOT defined inside!
    await this.createNotification(
      null,  // null = notify all admins
      ticket.id,
      `New ticket from merchant: ${ticket.subject}`,
      'TICKET_CREATED'
    );

    return ticket;
  }

  async findAll(merchantId?: string) {
    return this.prisma.ticket.findMany({
      where: merchantId ? { merchantId } : undefined,
      include: { merchant: { select: { businessName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneWithMessages(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        merchant: { select: { businessName: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async update(id: string, data: { status?: string; priority?: string; subject?: string; description?: string }) {
    const updated = await this.prisma.ticket.update({
      where: { id },
      data,
      include: { merchant: true },
    });

    if (data.status) {
      await this.createNotification(
        updated.merchantId,
        id,
        `Ticket "${updated.subject}" status updated to ${data.status}`,
        'TICKET_UPDATED'
      );
    }

    return updated;
  }

  async addMessage(ticketId: string, senderId: string, senderType: 'ADMIN' | 'MERCHANT', message: string) {
    const msg = await this.prisma.ticketMessage.create({
      data: { ticketId, senderId, senderType, message },
    });

    const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },  // ✅ CORRECT – use 'id'
        });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    let recipientUserId: string | null = null;
    if (senderType === 'ADMIN') {
      recipientUserId = ticket.merchantId;
    } else {
      const adminUser = await this.prisma.user.findFirst({
        where: { role: 'GATEWAY_ADMIN' },
      });
      if (adminUser) {
        recipientUserId = adminUser.id;
      }
    }

    if (recipientUserId) {
      await this.createNotification(
        recipientUserId,
        ticketId,
        `New message on ticket "${ticket.subject}"`,
        'NEW_MESSAGE'
      );
    }

    return msg;
  }

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markNotificationRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  // ✅ The helper method – defined once at the class level
  public async createNotification(userId: string | null, ticketId: string | null, message: string, type: string) {
    console.log(`Creating notification: userId=${userId}, ticketId=${ticketId}, type=${type}`);
    if (!userId) {
      const admins = await this.prisma.user.findMany({ where: { role: 'GATEWAY_ADMIN' } });
      console.log(`Found ${admins.length} admins to notify`);
      for (const admin of admins) {
        await this.prisma.notification.create({
          data: { userId: admin.id, ticketId, message, type },
        });
      }
      return;
    }
    await this.prisma.notification.create({
      data: { userId, ticketId, message, type },
    });
  }
}