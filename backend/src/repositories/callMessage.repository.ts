import prisma, { CallMessage, MessageRole } from '../config/prisma';

export class CallMessageRepository {
  public static async create(data: {
    callLogId: string;
    role: MessageRole;
    content: string;
  }): Promise<CallMessage> {
    return prisma.callMessage.create({
      data,
    });
  }

  public static async findByCallLog(callLogId: string): Promise<CallMessage[]> {
    return prisma.callMessage.findMany({
      where: { callLogId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
