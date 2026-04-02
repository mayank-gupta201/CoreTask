import { Router } from 'express';
import { portfolioController, createPortfolioSchema } from '../controllers/portfolio.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';

export const portfolioRouter = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

portfolioRouter.use(authenticate as any);

portfolioRouter.post('/', validate(createPortfolioSchema), asyncHandler(portfolioController.createPortfolio));
portfolioRouter.get('/', asyncHandler(portfolioController.getPortfolios));
