import { CustomerFrame } from '../components/customer/CustomerShell';
import { LanguageToggle, useI18n } from '../../../shared/i18n/index.tsx';

export function HomePage() {
  const { t } = useI18n();
  return (
    <CustomerFrame>
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center">
        <LanguageToggle className="mb-6" />
        <p className="text-3xl font-black text-[var(--brand)]">QR Order</p>
        <h1 className="mt-2 text-xl font-bold text-stone-900">{t('customer.homeTitle')}</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-stone-500">{t('customer.homeBody')}</p>
        <p className="mt-4 max-w-sm text-xs leading-relaxed text-stone-400">{t('customer.designHomeHint')}</p>
      </div>
    </CustomerFrame>
  );
}
