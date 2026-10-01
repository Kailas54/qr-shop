import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '../../../shared/i18n/index.tsx';
import { useAuth } from '../auth/AuthContext';
import { AdminLayout } from '../components/AdminLayout';
import { ApiRequestError, resolveMediaUrl } from '../lib/api';
import {
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  fetchCategories,
  fetchMenuItems,
  setMenuItemAvailability,
  updateCategory,
  updateMenuItem,
  uploadMenuItemImage,
  type MenuCategory,
  type MenuItem,
} from '../lib/menu';
import { canManageMenuAndTables } from '../lib/permissions';

function paiseToRupees(paise: number) {
  return (paise / 100).toFixed(2);
}

function rupeesToPaise(value: string) {
  const n = Number.parseFloat(value.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.round(n * 100);
}

export function MenuPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canEdit = canManageMenuAndTables(user?.role);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string | 'all'>('all');

  const [categoryModal, setCategoryModal] = useState<null | { mode: 'create' } | { mode: 'edit'; category: MenuCategory }>(
    null,
  );
  const [itemModal, setItemModal] = useState<null | { mode: 'create' } | { mode: 'edit'; item: MenuItem }>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    const [cats, menuItems] = await Promise.all([fetchCategories(), fetchMenuItems()]);
    setCategories(cats);
    setItems(menuItems);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('admin.menuLoadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh, t]);

  const visibleItems = useMemo(() => {
    if (filterCategoryId === 'all') {
      return items;
    }
    return items.filter((row) => row.categoryId === filterCategoryId);
  }, [items, filterCategoryId]);

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const sortOrder = Number.parseInt(String(form.get('sortOrder') ?? '0'), 10);
    if (!name) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (categoryModal?.mode === 'edit') {
        await updateCategory(categoryModal.category.id, { name, sortOrder });
      } else {
        await createCategory(name, Number.isFinite(sortOrder) ? sortOrder : 0);
      }
      setCategoryModal(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : t('admin.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCategory(category: MenuCategory) {
    if (!canEdit || !window.confirm(t('admin.deleteCategoryConfirm', { name: category.name }))) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteCategory(category.id);
      if (filterCategoryId === category.id) {
        setFilterCategoryId('all');
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : t('admin.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const categoryId = String(form.get('categoryId') ?? '');
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const pricePaise = rupeesToPaise(String(form.get('price') ?? ''));
    const sortOrder = Number.parseInt(String(form.get('sortOrder') ?? '0'), 10);
    const isVeg = form.get('isVeg') === 'on';
    const isAvailable = form.get('isAvailable') === 'on';
    const imageUrlRaw = String(form.get('imageUrl') ?? '').trim();
    const imageUrl = imageUrlRaw ? imageUrlRaw : null;
    const imageFile = form.get('imageFile');
    const file = imageFile instanceof File && imageFile.size > 0 ? imageFile : null;

    if (!categoryId || !name || pricePaise === null) {
      setError(t('admin.menuFormInvalid'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let saved: MenuItem;
      if (itemModal?.mode === 'edit') {
        saved = await updateMenuItem(itemModal.item.id, {
          categoryId,
          name,
          description,
          price: pricePaise,
          isVeg,
          isAvailable,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          imageUrl,
        });
      } else {
        saved = await createMenuItem({
          categoryId,
          name,
          description,
          price: pricePaise,
          isVeg,
          isAvailable,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          imageUrl,
        });
      }
      if (file) {
        saved = await uploadMenuItemImage(saved.id, file);
      }
      setItemModal(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : t('admin.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteItem(item: MenuItem) {
    if (!canEdit || !window.confirm(t('admin.deleteItemConfirm', { name: item.name }))) {
      return;
    }
    setBusy(true);
    try {
      await deleteMenuItem(item.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : t('admin.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailability(item: MenuItem) {
    if (!canEdit) {
      return;
    }
    setBusy(true);
    try {
      await setMenuItemAvailability(item.id, !item.isAvailable);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout
      title={t('admin.menuTitle')}
      subtitle={canEdit ? t('admin.menuSubtitle') : t('admin.menuReadOnly')}
      actions={
        canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryModal({ mode: 'create' })}
              className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold shadow-sm"
            >
              {t('admin.addCategory')}
            </button>
            <button
              type="button"
              onClick={() => setItemModal({ mode: 'create' })}
              disabled={categories.length === 0}
              className="rounded-xl bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t('admin.addItem')}
            </button>
          </div>
        ) : null
      }
    >
      {loading ? <p className="p-4 text-stone-500">{t('admin.loadingMenu')}</p> : null}
      {error ? <p className="p-4 text-red-600">{error}</p> : null}

      <div className="grid gap-4 p-4 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-3xl border border-stone-200/80 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-stone-800">{t('admin.categories')}</h2>
          <ul className="mt-3 space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setFilterCategoryId('all')}
                className={`w-full rounded-xl px-3 py-2 text-start text-sm font-medium ${
                  filterCategoryId === 'all' ? 'bg-red-50 text-[var(--brand)]' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                {t('admin.allCategories')}
              </button>
            </li>
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilterCategoryId(cat.id)}
                  className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-start text-sm font-medium ${
                    filterCategoryId === cat.id ? 'bg-red-50 text-[var(--brand)]' : 'text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {cat.name}
                </button>
                {canEdit ? (
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
                      onClick={() => setCategoryModal({ mode: 'edit', category: cat })}
                    >
                      {t('admin.edit')}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => void handleDeleteCategory(cat)}
                    >
                      {t('admin.delete')}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </aside>

        <main className="space-y-3">
          {visibleItems.length === 0 ? (
            <p className="rounded-3xl bg-white p-8 text-center text-stone-500 shadow-sm">{t('admin.noMenuItems')}</p>
          ) : (
            visibleItems.map((item) => {
              const img = resolveMediaUrl(item.imageUrl);
              return (
                <article
                  key={item.id}
                  className="flex flex-col gap-3 rounded-3xl border border-stone-200/80 bg-white p-4 shadow-sm sm:flex-row"
                >
                  {img ? (
                    <img src={img} alt="" className="h-24 w-full shrink-0 rounded-2xl object-cover sm:w-28" />
                  ) : (
                    <div className="flex h-24 w-full shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-cream)] text-xs text-stone-400 sm:w-28">
                      {t('admin.noImage')}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-stone-900">{item.name}</h3>
                        <p className="text-xs text-stone-500">{item.category.name}</p>
                      </div>
                      <p className="font-bold text-[var(--brand)]">₹{paiseToRupees(item.price)}</p>
                    </div>
                    {item.description ? <p className="mt-1 text-sm text-stone-600">{item.description}</p> : null}
                    <p className="mt-2 text-xs text-stone-500">
                      {item.isVeg ? t('admin.veg') : t('admin.nonVeg')} ·{' '}
                      {item.isAvailable ? t('admin.available') : t('admin.unavailable')}
                    </p>
                    {canEdit ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium"
                          onClick={() => setItemModal({ mode: 'edit', item })}
                        >
                          {t('admin.edit')}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium"
                          onClick={() => void toggleAvailability(item)}
                          disabled={busy}
                        >
                          {item.isAvailable ? t('admin.markUnavailable') : t('admin.markAvailable')}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700"
                          onClick={() => void handleDeleteItem(item)}
                        >
                          {t('admin.delete')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </main>
      </div>

      {categoryModal ? (
        <Modal title={categoryModal.mode === 'edit' ? t('admin.editCategory') : t('admin.addCategory')} onClose={() => setCategoryModal(null)}>
          <form onSubmit={(e) => void handleCategorySubmit(e)} className="space-y-3">
            <label className="block text-sm font-medium text-stone-600">
              {t('admin.categoryName')}
              <input
                name="name"
                required
                defaultValue={categoryModal.mode === 'edit' ? categoryModal.category.name : ''}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-600">
              {t('admin.sortOrder')}
              <input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={categoryModal.mode === 'edit' ? categoryModal.category.sortOrder : 0}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <button type="submit" disabled={busy} className="w-full rounded-2xl bg-[var(--brand)] py-2.5 font-bold text-white disabled:opacity-50">
              {t('admin.save')}
            </button>
          </form>
        </Modal>
      ) : null}

      {itemModal ? (
        <Modal title={itemModal.mode === 'edit' ? t('admin.editItem') : t('admin.addItem')} onClose={() => setItemModal(null)}>
          <form onSubmit={(e) => void handleItemSubmit(e)} className="space-y-3">
            <label className="block text-sm font-medium text-stone-600">
              {t('admin.category')}
              <select
                name="categoryId"
                required
                defaultValue={itemModal.mode === 'edit' ? itemModal.item.categoryId : categories[0]?.id ?? ''}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-stone-600">
              {t('admin.itemName')}
              <input
                name="name"
                required
                defaultValue={itemModal.mode === 'edit' ? itemModal.item.name : ''}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-600">
              {t('admin.description')}
              <textarea
                name="description"
                rows={2}
                defaultValue={itemModal.mode === 'edit' ? itemModal.item.description ?? '' : ''}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-600">
              {t('admin.priceRupees')}
              <input
                name="price"
                required
                inputMode="decimal"
                defaultValue={itemModal.mode === 'edit' ? paiseToRupees(itemModal.item.price) : ''}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-600">
              {t('admin.sortOrder')}
              <input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={itemModal.mode === 'edit' ? itemModal.item.sortOrder : 0}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-600">
              {t('admin.imageUrlOptional')}
              <input
                name="imageUrl"
                type="url"
                placeholder="https://"
                defaultValue={itemModal.mode === 'edit' ? itemModal.item.imageUrl ?? '' : ''}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-600">
              {t('admin.uploadImage')}
              <input name="imageFile" type="file" accept="image/*" className="mt-1 w-full text-sm" />
            </label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  name="isVeg"
                  type="checkbox"
                  defaultChecked={itemModal.mode === 'edit' ? itemModal.item.isVeg : true}
                />
                {t('admin.vegetarian')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  name="isAvailable"
                  type="checkbox"
                  defaultChecked={itemModal.mode === 'edit' ? itemModal.item.isAvailable : true}
                />
                {t('admin.available')}
              </label>
            </div>
            <button type="submit" disabled={busy || categories.length === 0} className="w-full rounded-2xl bg-[var(--brand)] py-2.5 font-bold text-white disabled:opacity-50">
              {t('admin.save')}
            </button>
          </form>
        </Modal>
      ) : null}
    </AdminLayout>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="font-bold text-stone-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm font-medium text-stone-500">{t('common.close')}</button>
        </div>
        {children}
      </div>
    </div>
  );
}
