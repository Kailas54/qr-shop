import { useParams } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import { GuestProvider } from '../guest/GuestContext';
import { CustomerFrame } from '../components/customer/CustomerShell';
import { useI18n } from '../../../shared/i18n/index.tsx';
import { TableExperienceBistro } from './table/TableExperienceBistro';
import { TableExperienceClassic } from './table/TableExperienceClassic';
import { useTableSession } from './table/useTableSession';

export type TableDesign = 'classic' | 'bistro';

function InvalidQr() {
  const { t } = useI18n();
  return (
    <CustomerFrame>
      <p className="p-8 text-center text-red-600">{t('customer.invalidQr')}</p>
    </CustomerFrame>
  );
}

function TableSessionView({ design }: { design: TableDesign }) {
  const state = useTableSession();
  if (design === 'bistro') {
    return <TableExperienceBistro {...state} />;
  }
  return <TableExperienceClassic {...state} />;
}

export function TablePage({ design = 'classic' }: { design?: TableDesign }) {
  const { qrToken = '' } = useParams();
  if (!qrToken) {
    return <InvalidQr />;
  }

  return (
    <GuestProvider qrToken={qrToken}>
      <CartProvider>
        <TableSessionView design={design} />
      </CartProvider>
    </GuestProvider>
  );
}
