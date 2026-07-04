import prisma, { Staff, StaffRole } from '../config/prisma';

export class StaffRepository {
  public static async findById(id: string): Promise<Staff | null> {
    return prisma.staff.findUnique({
      where: { id },
    });
  }

  public static async findByEmail(email: string): Promise<Staff | null> {
    return prisma.staff.findUnique({
      where: { email },
    });
  }

  public static async findByHospital(hospitalId: string): Promise<Staff[]> {
    return prisma.staff.findMany({
      where: { hospitalId },
    });
  }

  public static async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role?: StaffRole;
    hospitalId: string;
  }): Promise<Staff> {
    return prisma.staff.create({
      data,
    });
  }

  public static async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      passwordHash?: string;
      role?: StaffRole;
    }
  ): Promise<Staff> {
    return prisma.staff.update({
      where: { id },
      data,
    });
  }
}
