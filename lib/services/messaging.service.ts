import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api-guards";

const MAX_CONVERSATION_PARTICIPANTS = 20;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_PAGE_SIZE = 50;

type PaginationInput = {
  page?: number | string | null;
  pageSize?: number | string | null;
};

function normalizePositiveInt(value: number | string | null | undefined, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function normalizeMessageContent(content: unknown) {
  if (typeof content !== "string") {
    throw new ApiError(400, "Message content is required");
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new ApiError(400, "Message content is required");
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(400, `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
  }

  return trimmed;
}

export class MessagingService {
  async createConversation(userId: string, participantIds: string[]) {
    const uniqueParticipants = [...new Set([userId, ...participantIds].filter(Boolean))];

    if (uniqueParticipants.length < 2) {
      throw new ApiError(400, "At least one other participant is required");
    }

    if (uniqueParticipants.length > MAX_CONVERSATION_PARTICIPANTS) {
      throw new ApiError(400, `Conversations can include at most ${MAX_CONVERSATION_PARTICIPANTS} participants`);
    }

    const activeUsers = await prisma.user.findMany({
      where: {
        id: { in: uniqueParticipants },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    const activeUserIds = new Set(activeUsers.map((user) => user.id));
    const missingParticipants = uniqueParticipants.filter((id) => !activeUserIds.has(id));

    if (missingParticipants.length > 0) {
      throw new ApiError(400, "One or more participants are invalid or inactive");
    }

    // Return an existing direct conversation only when exactly both users are participants.
    if (uniqueParticipants.length === 2) {
      const directConversations = await prisma.conversation.findMany({
        where: {
          type: "direct",
          participants: {
            every: { userId: { in: uniqueParticipants } },
            some: { userId: uniqueParticipants[0] },
          },
        },
        include: {
          participants: true,
        },
      });

      const existing = directConversations.find((conversation) => {
        const ids = conversation.participants.map((participant) => participant.userId).sort();
        return ids.length === 2 && ids.join(":") === [...uniqueParticipants].sort().join(":");
      });

      if (existing) {
        return this.getConversation(existing.id, userId);
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: uniqueParticipants.length > 2 ? "group" : "direct",
        participants: {
          create: uniqueParticipants.map((uid) => ({
            userId: uid,
            role: uid === userId ? "admin" : "member",
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
      throw new ApiError(404, "Conversation not found");
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

  async getConversations(userId: string, params: PaginationInput) {
    const page = normalizePositiveInt(params.page, 1, 100000);
    const pageSize = normalizePositiveInt(params.pageSize, 20, MAX_PAGE_SIZE);

    const participantConversations = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    const conversationIds = participantConversations.map((p) => p.conversationId);

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

  async sendMessage(conversationId: string, senderId: string, rawContent: unknown) {
    const content = normalizeMessageContent(rawContent);

    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
      },
    });

    if (!participant) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    const receiver = conversation.participants.find((p) => p.userId !== senderId);

    const message = await prisma.$transaction(async (tx) => {
      const createdMessage = await tx.message.create({
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

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: content.substring(0, 100),
          lastMessageAt: new Date(),
        },
      });

      return createdMessage;
    });

    revalidatePath(`/messages/${conversationId}`);
    return message;
  }

  async markAsRead(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new ApiError(404, "Message not found");
    }

    if (message.receiverId !== userId) {
      throw new ApiError(403, "Unauthorized");
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
