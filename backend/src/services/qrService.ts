import QRCode from 'qrcode';
import { env } from '../config/env';

export function buildTableCustomerUrl(qrToken: string): string {
  const base = env.CUSTOMER_APP_URL.replace(/\/$/, '');
  return `${base}/t/${qrToken}`;
}

export async function renderTableQr(qrToken: string, format: 'png' | 'svg'): Promise<Buffer | string> {
  const url = buildTableCustomerUrl(qrToken);
  if (format === 'svg') {
    return QRCode.toString(url, { type: 'svg', margin: 2, width: 280 });
  }
  return QRCode.toBuffer(url, { type: 'png', margin: 2, width: 280 });
}
