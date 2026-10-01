import archiver from 'archiver';
import { asyncHandler } from '../lib/asyncHandler';
import { renderTableQr } from '../services/qrService';
import {
  createTable,
  getTableForRestaurant,
  listTables,
  listTablesWithTokens,
  updateTable,
} from '../services/tableService';

export const list = asyncHandler(async (req, res) => {
  const tables = await listTables(req.admin!.restaurantId);
  res.json({ tables });
});

export const create = asyncHandler(async (req, res) => {
  const table = await createTable(req.admin!.restaurantId, req.body.tableNumber, req.body.isActive);
  res.status(201).json({ table });
});

export const update = asyncHandler(async (req, res) => {
  const table = await updateTable(req.admin!.restaurantId, req.params.id, req.body);
  res.json({ table });
});

export const qr = asyncHandler(async (req, res) => {
  const row = await getTableForRestaurant(req.admin!.restaurantId, req.params.id);
  const format = req.query.format === 'svg' ? 'svg' : 'png';
  const rendered = await renderTableQr(row.qrToken, format);
  if (format === 'svg') {
    res.type('image/svg+xml').send(rendered);
    return;
  }
  res.type('image/png').send(rendered);
});

export const bulkQrZip = asyncHandler(async (req, res) => {
  const tables = await listTablesWithTokens(req.admin!.restaurantId);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="table-qr-codes.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (error) => {
    throw error;
  });
  archive.pipe(res);

  for (const table of tables) {
    const png = await renderTableQr(table.qrToken, 'png');
    const safeName = table.tableNumber.replace(/[^\w.-]+/g, '_');
    archive.append(png, { name: `table-${safeName}.png` });
  }

  await archive.finalize();
});
