import { successResponse } from '../utils/apiResponse.js';
export const createExtractionController = (service) => ({
  extract: async (req, res, next) => { try { return successResponse(res, 200, 'Content extracted successfully.', await service.extractContent(req.body)); } catch (error) { next(error); } }
});
