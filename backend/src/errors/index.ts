export class ProblemDetails extends Error {
    public type: string;
    public title: string;
    public status: number;
    public detail: string;
    public instance?: string;

    constructor({
        type = 'about:blank',
        title,
        status = 500,
        detail,
        instance,
    }: {
        type?: string;
        title: string;
        status?: number;
        detail: string;
        instance?: string;
    }) {
        super(detail);
        this.type = type;
        this.title = title;
        this.status = status;
        this.detail = detail;
        this.instance = instance;
    }
}

import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof ProblemDetails) {
        req.log?.error(err, 'ProblemDetails Error');
        return res.status(err.status).type('application/problem+json').json({
            type: err.type,
            title: err.title,
            status: err.status,
            detail: err.detail,
            instance: err.instance || req.originalUrl,
        });
    }

    req.log?.error(err, 'Unhandled Error');
    return res.status(500).type('application/problem+json').json({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: err.message || 'An unexpected error occurred.',
        instance: req.originalUrl,
    });
};
