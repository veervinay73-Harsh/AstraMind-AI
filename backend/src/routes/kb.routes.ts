import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { Logger } from '../utils/logger';

const router = Router();

// ── Helper: resolve hospitalId ────────────────────────────────────────────────
async function resolveHospitalId(hospitalId?: string): Promise<string | null> {
  if (hospitalId) return hospitalId;
  const first = await prisma.hospital.findFirst();
  return first?.id ?? null;
}

/**
 * GET /api/kb
 * Returns paginated, filtered, sorted list of knowledge base articles.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      hospitalId,
      search,
      isActive,
      category,
      sort = 'updatedAt',
      page = '1',
      limit = '10',
    } = req.query;

    const activeHospitalId = await resolveHospitalId(hospitalId as string);
    if (!activeHospitalId) {
      res.status(400).json({ error: 'No hospitals exist in the database.' });
      return;
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: any = { hospitalId: activeHospitalId };

    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (category && category !== '') {
      where.category = { equals: category as string, mode: 'insensitive' };
    }

    if (search) {
      const s = search as string;
      where.OR = [
        { question: { contains: s, mode: 'insensitive' } },
        { answer: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
      ];
    }

    const orderBy: any =
      sort === 'category'
        ? { category: 'asc' }
        : { updatedAt: 'desc' };

    const [articles, total] = await Promise.all([
      prisma.knowledgeBaseArticle.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.knowledgeBaseArticle.count({ where }),
    ]);

    res.status(200).json({
      articles,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    Logger.error('Failed to query knowledge base articles', error, 'KB_API');
    res.status(500).json({ error: 'Internal server error while fetching KB articles.' });
  }
});

/**
 * GET /api/kb/categories
 * Returns the distinct category list for the hospital (for filter dropdowns).
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { hospitalId } = req.query;
    const activeHospitalId = await resolveHospitalId(hospitalId as string);
    if (!activeHospitalId) {
      res.status(400).json({ error: 'No hospitals exist in the database.' });
      return;
    }

    const rows = await prisma.knowledgeBaseArticle.findMany({
      where: { hospitalId: activeHospitalId },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    res.status(200).json({ categories: rows.map((r) => r.category) });
  } catch (error) {
    Logger.error('Failed to fetch KB categories', error, 'KB_API');
    res.status(500).json({ error: 'Internal server error while fetching categories.' });
  }
});

/**
 * POST /api/kb
 * Creates a new knowledge base article.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { hospitalId, category, question, answer } = req.body;

    if (!category || !question || !answer) {
      res.status(400).json({ error: 'Fields category, question, and answer are all required.' });
      return;
    }

    const activeHospitalId = await resolveHospitalId(hospitalId);
    if (!activeHospitalId) {
      res.status(400).json({ error: 'No hospitals exist in the database.' });
      return;
    }

    const article = await prisma.knowledgeBaseArticle.create({
      data: {
        category: category.trim(),
        question: question.trim(),
        answer: answer.trim(),
        hospitalId: activeHospitalId,
        isActive: true,
      },
    });

    Logger.info(`KB article created: "${article.question.slice(0, 50)}"`, 'KB_API');
    res.status(201).json(article);
  } catch (error) {
    Logger.error('Failed to create KB article', error, 'KB_API');
    res.status(500).json({ error: 'Internal server error while creating KB article.' });
  }
});

/**
 * PUT /api/kb/:id
 * Updates an existing knowledge base article (category, question, answer, isActive).
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { category, question, answer, isActive } = req.body;

    const existing = await prisma.knowledgeBaseArticle.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Knowledge base article not found.' });
      return;
    }

    const updated = await prisma.knowledgeBaseArticle.update({
      where: { id },
      data: {
        ...(category !== undefined && { category: category.trim() }),
        ...(question !== undefined && { question: question.trim() }),
        ...(answer !== undefined && { answer: answer.trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    Logger.info(`KB article updated: ${id}`, 'KB_API');
    res.status(200).json(updated);
  } catch (error) {
    Logger.error('Failed to update KB article', error, 'KB_API');
    res.status(500).json({ error: 'Internal server error while updating KB article.' });
  }
});

/**
 * PATCH /api/kb/:id/toggle
 * Toggles the isActive status of an article (activate / deactivate).
 */
router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.knowledgeBaseArticle.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Knowledge base article not found.' });
      return;
    }

    const updated = await prisma.knowledgeBaseArticle.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    Logger.info(`KB article toggled: ${id} → isActive=${updated.isActive}`, 'KB_API');
    res.status(200).json(updated);
  } catch (error) {
    Logger.error('Failed to toggle KB article', error, 'KB_API');
    res.status(500).json({ error: 'Internal server error while toggling KB article.' });
  }
});

/**
 * DELETE /api/kb/:id
 * Permanently deletes a knowledge base article.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.knowledgeBaseArticle.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Knowledge base article not found.' });
      return;
    }

    await prisma.knowledgeBaseArticle.delete({ where: { id } });

    Logger.info(`KB article deleted: ${id}`, 'KB_API');
    res.status(200).json({ success: true, deletedId: id });
  } catch (error) {
    Logger.error('Failed to delete KB article', error, 'KB_API');
    res.status(500).json({ error: 'Internal server error while deleting KB article.' });
  }
});

export default router;
