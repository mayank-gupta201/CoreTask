import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ProblemDetails } from '../errors';

export const validate = (schema: ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                return next(
                    new ProblemDetails({
                        title: 'Validation Error',
                        status: 400,
                        detail: 'Invalid request data',
                        instance: JSON.stringify((error as any).errors), // simple way to pass detail
                    })
                );
            }
            return next(error);
        }
    };
};
