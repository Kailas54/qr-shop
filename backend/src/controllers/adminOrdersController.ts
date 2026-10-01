import type { OrderStatus } from '@prisma/client';
import { asyncHandler } from '../lib/asyncHandler';
import {
  confirmAdminOrder,
  getAdminOrderDetail,
  listAdminOrders,
  updateAdminOrderStatus,
} from '../services/adminOrderService';

export const list = asyncHandler(async (req, res) => {
  const result = await listAdminOrders(req.admin!.restaurantId, {
    status: req.query.status as OrderStatus | undefined,
    tableNumber: req.query.table as string | undefined,
    from: req.query.from ? new Date(req.query.from as string) : undefined,
    to: req.query.to ? new Date(req.query.to as string) : undefined,
    boardOnly: Boolean((req.query as { board?: boolean }).board),
    limit: Number(req.query.limit ?? 50),
    offset: Number(req.query.offset ?? 0),
  });
  res.json(result);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const order = await updateAdminOrderStatus(
    req.admin!.restaurantId,
    req.params.id,
    req.body.status,
    req.admin!.id,
    req.admin!.role,
  );
  res.json({ order });
});

export const confirm = asyncHandler(async (req, res) => {
  const order = await confirmAdminOrder(
    req.admin!.restaurantId,
    req.params.id,
    req.admin!.id,
    req.admin!.role,
  );
  res.json({ order });
});

export const detail = asyncHandler(async (req, res) => {
  const result = await getAdminOrderDetail(req.admin!.restaurantId, req.params.id, req.admin!.role);
  res.json(result);
});
