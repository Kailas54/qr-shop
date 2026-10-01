import fs from 'fs';
import path from 'path';
import { Router } from 'express';

export const openapiRouter = Router();

const specPath = path.resolve(__dirname, '../../openapi.yaml');

openapiRouter.get('/openapi.yaml', (_req, res, next) => {
  try {
    const spec = fs.readFileSync(specPath, 'utf8');
    res.type('application/yaml').send(spec);
  } catch (error) {
    next(error);
  }
});
