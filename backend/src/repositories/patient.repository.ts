import prisma, { Patient } from '../config/prisma';

export class PatientRepository {
  public static async findById(id: string): Promise<Patient | null> {
    return prisma.patient.findUnique({
      where: { id },
    });
  }

  public static async findByPhone(hospitalId: string, phone: string): Promise<Patient | null> {
    return prisma.patient.findUnique({
      where: {
        hospitalId_phone: {
          hospitalId,
          phone,
        },
      },
    });
  }

  public static async create(data: {
    name: string;
    phone: string;
    email?: string;
    dob?: Date;
    age?: number;
    gender?: string;
    isNewPatient?: boolean;
    insuranceDetails?: string;
    hospitalId: string;
  }): Promise<Patient> {
    return prisma.patient.create({
      data,
    });
  }

  public static async update(
    id: string,
    data: {
      name?: string;
      phone?: string;
      email?: string;
      dob?: Date;
      age?: number;
      gender?: string;
      isNewPatient?: boolean;
      insuranceDetails?: string;
    }
  ): Promise<Patient> {
    return prisma.patient.update({
      where: { id },
      data,
    });
  }
}
