import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/db.js';
import { commentary } from '../db/schema.js';
import { matchIdParamSchema } from '../validation/matches.js';
import {
    createCommentarySchema,
    listCommentaryQuerySchema,
} from '../validation/commentary.js';

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            error: 'Invalid match ID',
            details: paramsResult.error.issues,
        });
    }

    const queryResult = listCommentaryQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
        return res.status(400).json({
            error: 'Invalid query parameters',
            details: queryResult.error.issues,
        });
    }

    try {
        const { id } = paramsResult.data;
        const limit = queryResult.data.limit ?? 10;

        const results = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, id))
            .orderBy(desc(commentary.createdAt))
            .limit(limit);

        res.status(200).json({ data: results });
    } catch (error) {
        console.error('Failed to fetch commentary', error);
        res.status(500).json({ message: 'Failed to fetch commentary' });
    }
});

commentaryRouter.post('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            error: 'Invalid match ID',
            details: paramsResult.error.issues,
        });
    }

    const bodyResult = createCommentarySchema.safeParse(req.body);

    if (!bodyResult.success) {
        return res.status(400).json({
            error: 'Invalid commentary payload',
            details: bodyResult.error.issues,
        });
    }

    try {
        const { minute, ...rest } = bodyResult.data;
        const [result] = await db
            .insert(commentary)
            .values({
                matchId: paramsResult.data.id,
                minute,
                ...rest,
            })
            .returning();

        if (res.app.locals.broadcastCommentary) {
            res.app.locals.broadcastCommentary(result.matchId, result);
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Failed to create commentary', error);
        res.status(500).json({ message: 'Failed to create commentary' });
    }
});
