import { Router } from 'express';
import multer from 'multer';
import { validate } from '../middleware/validate.js';
import { brandKitSchema, idParamSchema } from '../validators/requests.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

export const createBrandRoutes = (controller) => Router()
  .get('/brand-kit', controller.get)
  .put('/brand-kit', validate(brandKitSchema), controller.save)
  .post('/brand-kit/logo', upload.single('logo'), controller.uploadLogo)
  .delete('/brand-kit/logo', controller.removeLogo)
  .get('/brand-assets/:id', validate(idParamSchema, 'params'), controller.asset);
