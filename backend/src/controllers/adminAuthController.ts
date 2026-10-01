import type { Request, Response } from 'express';
import { getStaffProfile, loginStaff, refreshStaffSession } from '../services/authService';

export async function login(req: Request, res: Response): Promise<void> {
  const result = await loginStaff(req.body.email, req.body.password);
  res.json(result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const result = await refreshStaffSession(req.body.refreshToken);
  res.json(result);
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.admin) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  const profile = await getStaffProfile(req.admin.id);
  res.json({ admin: profile });
}
