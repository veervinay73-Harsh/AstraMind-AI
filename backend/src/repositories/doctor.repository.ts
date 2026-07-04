import prisma, { Doctor } from '../config/prisma';

export class DoctorRepository {
  public static async findById(id: string): Promise<Doctor | null> {
    return prisma.doctor.findUnique({
      where: { id },
    });
  }

  public static async findByHospital(hospitalId: string): Promise<Doctor[]> {
    return prisma.doctor.findMany({
      where: { hospitalId, isActive: true },
    });
  }

  public static async findBySpecialization(specialization: string): Promise<Doctor[]> {
    return prisma.doctor.findMany({
      where: {
        specialization: { contains: specialization, mode: 'insensitive' },
        isActive: true,
      },
    });
  }

  public static async create(data: {
    name: string;
    specialization: string;
    email?: string;
    phone?: string;
    hospitalId: string;
  }): Promise<Doctor> {
    return prisma.doctor.create({
      data,
    });
  }

  public static async update(
    id: string,
    data: {
      name?: string;
      specialization?: string;
      email?: string;
      phone?: string;
      isActive?: boolean;
    }
  ): Promise<Doctor> {
    return prisma.doctor.update({
      where: { id },
      data,
    });
  }
}
