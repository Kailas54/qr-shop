import path from 'path';
import { asyncHandler } from '../lib/asyncHandler';
import { getStorage } from '../lib/storage';
import {
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  listCategories,
  listMenuItems,
  setMenuItemAvailability,
  updateCategory,
  updateMenuItem,
} from '../services/menuService';

export const listCategoriesHandler = asyncHandler(async (req, res) => {
  const categories = await listCategories(req.admin!.restaurantId);
  res.json({ categories });
});

export const createCategoryHandler = asyncHandler(async (req, res) => {
  const category = await createCategory(req.admin!.restaurantId, req.body.name, req.body.sortOrder);
  res.status(201).json({ category });
});

export const updateCategoryHandler = asyncHandler(async (req, res) => {
  const category = await updateCategory(req.admin!.restaurantId, req.params.id, req.body);
  res.json({ category });
});

export const deleteCategoryHandler = asyncHandler(async (req, res) => {
  await deleteCategory(req.admin!.restaurantId, req.params.id);
  res.status(204).send();
});

export const listItemsHandler = asyncHandler(async (req, res) => {
  const items = await listMenuItems(req.admin!.restaurantId);
  res.json({ items });
});

export const createItemHandler = asyncHandler(async (req, res) => {
  const item = await createMenuItem(req.admin!.restaurantId, req.body);
  res.status(201).json({ item });
});

export const updateItemHandler = asyncHandler(async (req, res) => {
  const item = await updateMenuItem(req.admin!.restaurantId, req.params.id, req.body);
  res.json({ item });
});

export const deleteItemHandler = asyncHandler(async (req, res) => {
  await deleteMenuItem(req.admin!.restaurantId, req.params.id);
  res.status(204).send();
});

export const toggleAvailabilityHandler = asyncHandler(async (req, res) => {
  const item = await setMenuItemAvailability(req.admin!.restaurantId, req.params.id, req.body.isAvailable);
  res.json({ item });
});

export const uploadItemImageHandler = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Image file is required' } });
    return;
  }

  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const objectKey = `restaurants/${req.admin!.restaurantId}/menu/${req.params.id}/${Date.now()}${ext}`;
  const stored = await getStorage().save(objectKey, file.buffer, file.mimetype);
  const item = await updateMenuItem(req.admin!.restaurantId, req.params.id, { imageUrl: stored.url });
  res.json({ item });
});
