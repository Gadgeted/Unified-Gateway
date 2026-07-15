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

    // Notify all admin users
    await this.createNotification(null, ticket.id, `New ticket from merchant: ${ticket.subject}`, 'TICKET_CREATED');

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
      // Notify merchant if status changed
      await this.createNotification(updated.merchantId, id, `Ticket "${updated.subject}" status updated to ${data.status}`, 'TICKET_UPDATED');
    }

    return updated;
  }

  async addMessage(ticketId: string, senderId: string, senderType: 'ADMIN' | 'MERCHANT', message: string) {
    // First, create the message
    const msg = await this.prisma.ticketMessage.create({
      data: { ticketId, senderId, senderType, message },
    });

    // Fetch the ticket to get merchantId and subject
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { merchant: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Determine the recipient userId
    let recipientUserId: string | null = null;
    if (senderType === 'ADMIN') {
      // Notify the merchant who owns the ticket
      recipientUserId = ticket.merchantId;
    } else {
      // Notify all admins (or a specific admin user – we'll use the first admin found)
      const adminUser = await this.prisma.user.findFirst({
        where: { role: 'GATEWAY_ADMIN' },
      });
      if (adminUser) {
        recipientUserId = adminUser.id;
      }
    }

    // Create notification for the recipient
    if (recipientUserId) {
      await this.createNotification(recipientUserId, ticketId, `New message on ticket "${ticket.subject}"`, 'NEW_MESSAGE');
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

  // Internal helper to create a notification
  private async createNotification(userId: string | null, ticketId: string | null, message: string, type: string) {
    if (!userId) {
      // If no specific userId, notify all admin users (for ticket creation)
      const admins = await this.prisma.user.findMany({ where: { role: 'GATEWAY_ADMIN' } });
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