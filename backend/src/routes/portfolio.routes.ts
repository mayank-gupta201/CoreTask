import { Router } from 'express';
import { 
    portfolioController, 
    createPortfolioSchema, 
    updatePortfolioSchema,
    createProgramSchema,
    addProjectToProgramSchema
} from '../controllers/portfolio.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';

export const portfolioRouter = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

portfolioRouter.use(authenticate as any);

// -- Portfolios --
portfolioRouter.post('/', validate(createPortfolioSchema), asyncHandler(portfolioController.createPortfolio.bind(portfolioController)));
portfolioRouter.get('/', asyncHandler(portfolioController.getPortfolios.bind(portfolioController)));
portfolioRouter.get('/:id', asyncHandler(portfolioController.getPortfolio.bind(portfolioController)));
portfolioRouter.patch('/:id', validate(updatePortfolioSchema), asyncHandler(portfolioController.updatePortfolio.bind(portfolioController)));
portfolioRouter.delete('/:id', asyncHandler(portfolioController.deletePortfolio.bind(portfolioController)));
portfolioRouter.get('/:id/dashboard', asyncHandler(portfolioController.getPortfolioDashboard.bind(portfolioController)));
portfolioRouter.get('/:id/roadmap', asyncHandler(portfolioController.getPortfolioRoadmap.bind(portfolioController)));

// -- Programs --
portfolioRouter.post('/:id/programs', validate(createProgramSchema), asyncHandler(portfolioController.createProgram.bind(portfolioController)));
portfolioRouter.get('/:id/programs', asyncHandler(portfolioController.getPrograms.bind(portfolioController)));

// -- Program Projects (Workspaces) --
// Note: nesting uses portfolioId (:id), programId (:programId)
portfolioRouter.post('/:id/programs/:programId/projects', validate(addProjectToProgramSchema), asyncHandler(portfolioController.addProjectToProgram.bind(portfolioController)));
portfolioRouter.delete('/:id/programs/:programId/projects/:workspaceId', asyncHandler(portfolioController.removeProjectFromProgram.bind(portfolioController)));
