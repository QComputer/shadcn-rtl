import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export class MessagingService {
  async createConversation(userId: string, participantIds: string[]) {
    // Add current user to participants
    const allParticipants = [...new Set([userId, ...participantIds])];

    // Check if direct conversation already exists
    if (allParticipants.length === 2) {
      const existing = await prisma.conversationParticipant.findMany({
        where: {
          userId: { in: allParticipants },
        },
        include: {
          conversation: {
            include: {
              participants: true,
            },
          },
        },
      });

      // Find conversation where both users are participants
      const conversationMap = new Map();
      for (const participant of existing) {
        const existingConv = conversationMap.get(participant.conversationId);
        if (existingConv) {
          // Direct conversation already exists
          return participant.conversation;
        }
        conversationMap.set(participant.conversationId, participant);
      }
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        type: allParticipants.length > 2 ? "group" : "direct",
        participants: {
          create: allParticipants.map((uid) => ({
            userId: uid,
            role: uid === allParticipants[0] ? "admin" : "member",
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    revalidatePath(`/messages`);
    return conversation;
  }

  async getConversation(id: string, userId: string) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId,
        },
      },
    });

    if (!participant) {
      throw new Error("Conversation not found");
    }

    return prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  async getConversations(userId: string, params: {
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 20 } = params;

    const participantConversations = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    const conversationIds = participantConversations.map(p => p.conversationId);

    const [data, total] = await Promise.all([
      prisma.conversation.findMany({
        where: { id: { in: conversationIds } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.conversation.count({
        where: { id: { in: conversationIds } },
      }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    // Verify sender is participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
      },
    });

    if (!participant) {
      throw new Error("Not a participant in this conversation");
    }

    // Get receiver(s)
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const receiver = conversation.participants.find(p => p.userId !== senderId);

    const message = await prisma.message.create({
      data: {
        content,
        senderId,
        receiverId: receiver?.userId ?? senderId,
        conversationId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Update conversation's last message
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content.substring(0, 100),
        lastMessageAt: new Date(),
      },
    });

    revalidatePath(`/messages/${conversationId}`);
    return message;
  }

  async markAsRead(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    if (message.receiverId !== userId) {
      throw new Error("Unauthorized");
    }

    return prisma.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async getUnreadCount(userId: string) {
    return prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });
  }
}

export const messagingService = new MessagingService();
