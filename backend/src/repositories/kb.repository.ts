import prisma, { KnowledgeBaseArticle } from '../config/prisma';

export class KBRepository {
  public static async findById(id: string): Promise<KnowledgeBaseArticle | null> {
    return prisma.knowledgeBaseArticle.findUnique({
      where: { id },
    });
  }

  public static async findByHospital(hospitalId: string): Promise<KnowledgeBaseArticle[]> {
    return prisma.knowledgeBaseArticle.findMany({
      where: { hospitalId, isActive: true },
    });
  }

  public static async create(data: {
    category: string;
    question: string;
    answer: string;
    hospitalId: string;
  }): Promise<KnowledgeBaseArticle> {
    return prisma.knowledgeBaseArticle.create({
      data,
    });
  }

  public static async update(
    id: string,
    data: {
      category?: string;
      question?: string;
      answer?: string;
      isActive?: boolean;
    }
  ): Promise<KnowledgeBaseArticle> {
    return prisma.knowledgeBaseArticle.update({
      where: { id },
      data,
    });
  }
}
