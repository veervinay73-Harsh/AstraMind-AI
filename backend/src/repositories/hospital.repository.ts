import prisma, { Hospital } from '../config/prisma';

export class HospitalRepository {
  public static async findById(id: string): Promise<Hospital | null> {
    return prisma.hospital.findUnique({
      where: { id },
    });
  }

  public static async create(data: {
    name: string;
    address?: string;
    phone?: string;
    timezone?: string;
    twilioConfig?: any;
    aiConfig?: any;
  }): Promise<Hospital> {
    return prisma.hospital.create({
      data,
    });
  }

  public static async update(
    id: string,
    data: {
      name?: string;
      address?: string;
      phone?: string;
      timezone?: string;
      twilioConfig?: any;
      aiConfig?: any;
    }
  ): Promise<Hospital> {
    return prisma.hospital.update({
      where: { id },
      data,
    });
  }

  public static async delete(id: string): Promise<Hospital> {
    return prisma.hospital.delete({
      where: { id },
    });
  }
}
