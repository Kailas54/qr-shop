import { useCart } from '../../cart/CartContext';
import { useI18n } from '../../../../shared/i18n/index.tsx';

function formatMoney(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  submitError: string | null;
  onPlaceOrder: () => void;
};

export function CartSheet({ open, onClose, submitting, submitError, onPlaceOrder }: Props) {
  const cart = useCart();
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={t('common.close')} onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">{t('customer.cartTitle')}</h2>
          <button type="button" onClick={onClose} className="text-sm font-medium text-stone-500">{t('common.close')}</button>
        </div>
        {cart.lines.length === 0 ? (
          <p className="py-8 text-center text-stone-500">{t('customer.cartEmpty')}</p>
        ) : (
          <>
            <ul className="max-h-[40vh] space-y-3 overflow-y-auto">
              {cart.lines.map((line) => (
                <li key={line.menuItemId} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg-cream)] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{line.name}</p>
                    <p className="text-xs text-stone-500">{formatMoney(line.unitPrice)} {t('customer.each')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-lg"
                      onClick={() => cart.setQuantity(line.menuItemId, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-semibold">{line.quantity}</span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-lg"
                      onClick={() => cart.setQuantity(line.menuItemId, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <label className="mt-4 block text-sm text-stone-600">
              {t('customer.kitchenNotes')}
              <textarea
                value={cart.notes}
                onChange={(e) => cart.setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-2xl border border-stone-200 bg-[var(--bg-cream)] px-3 py-2 text-stone-800 outline-none focus:border-[var(--brand)]"
                placeholder={t('common.optional')}
              />
            </label>
            {submitError ? <p className="mt-2 text-sm text-red-600">{submitError}</p> : null}
            <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
              <span className="text-stone-600">{t('customer.total')}</span>
              <span className="text-xl font-bold">{formatMoney(cart.subtotal)}</span>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={onPlaceOrder}
              className="mt-4 w-full rounded-2xl bg-[var(--brand)] py-3.5 text-base font-bold text-white disabled:opacity-50"
            >
              {submitting ? t('customer.placingOrder') : t('customer.placeOrder')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
