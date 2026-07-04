import prisma, { CallLog } from '../config/prisma';

export class CallLogRepository {
  public static async findById(id: string): Promise<CallLog | null> {
    return prisma.callLog.findUnique({
      where: { id },
      include: {
        messages: true,
        patient: true,
      },
    });
  }

  public static async findByCallSid(twilioCallSid: string): Promise<CallLog | null> {
    return prisma.callLog.findUnique({
      where: { twilioCallSid },
    });
  }

  public static async findByHospital(hospitalId: string, limit: number = 50): Promise<CallLog[]> {
    return prisma.callLog.findMany({
      where: { hospitalId },
      include: {
        patient: true,
        appointment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  public static async create(data: {
    twilioCallSid: string;
    hospitalId: string;
    callStatus: string;
    patientId?: string;
  }): Promise<CallLog> {
    return prisma.callLog.create({
      data,
    });
  }

  public static async update(
    id: string,
    data: {
      callDuration?: number;
      callStatus?: string;
      summary?: string;
      actionTaken?: string;
      handedOverToHuman?: boolean;
      patientId?: string;
    }
  ): Promise<CallLog> {
    return prisma.callLog.update({
      where: { id },
      data,
    });
  }
}
