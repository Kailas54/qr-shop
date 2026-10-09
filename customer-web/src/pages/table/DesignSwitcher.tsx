import { Link } from 'react-router-dom';
import { useI18n } from '../../../../shared/i18n/index.tsx';

type Props = {
  qrToken: string;
  variant: 'classic' | 'bistro';
};

export function DesignSwitcher({ qrToken, variant }: Props) {
  const { t } = useI18n();
  const to =
    variant === 'classic' ? `/t/${encodeURIComponent(qrToken)}/bistro` : `/t/${encodeURIComponent(qrToken)}`;
  const label =
    variant === 'classic' ? t('customer.designSwitchToBistro') : t('customer.designSwitchToClassic');

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <Link
        to={to}
        className="pointer-events-auto flex max-w-lg items-center gap-2 rounded-full border border-stone-200/90 bg-white/95 px-4 py-2 text-xs font-semibold text-stone-700 shadow-lg backdrop-blur-sm"
      >
        <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {t('customer.designDemo')}
        </span>
        <span>{label}</span>
      </Link>
    </div>
  );
}
