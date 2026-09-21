import { successResponse } from '../utils/apiResponse.js';
export const createGenerationController = (service) => ({
  generate: async (req, res, next) => { try { return successResponse(res, 201, 'Carousel generated successfully.', await service.generate({ ...req.body, userId: req.user.id, plan: req.user.plan })); } catch (error) { next(error); } }
});
