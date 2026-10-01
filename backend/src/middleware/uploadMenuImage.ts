import multer from 'multer';
import { HttpError } from '../lib/errors';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadMenuImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new HttpError(400, 'INVALID_FILE', 'Only JPEG, PNG, and WebP images are allowed'));
      return;
    }
    cb(null, true);
  },
});
