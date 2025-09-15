export interface SingPayOptions {
  amount: number;
  reference: string;
  redirectSuccess?: string;
  redirectError?: string;
  logoURL?: string;
}

const SINGPAY_ENDPOINT = 'https://gateway.singpay.ga/v1/ext';

// ATTENTION: Pour la production, placez ces clés côté serveur et proxiez l'appel.
const CLIENT_ID = (import.meta as any).env?.VITE_SINGPAY_CLIENT_ID || 'beae8d8d-377a-48f5-be50-20a2d2578e9f';
const CLIENT_SECRET = (import.meta as any).env?.VITE_SINGPAY_CLIENT_SECRET || '11b90375aa987292c2e2abe0f19b482b45a4d4d2810813c3c9a10c3655cb3535';
const WALLET_ID = (import.meta as any).env?.VITE_SINGPAY_WALLET_ID || '682211c3ac445b0a4e899383';
const DISBURSEMENT_ID = (import.meta as any).env?.VITE_SINGPAY_DISBURSEMENT_ID || '686119e88718fef8d176f4fa';

export async function startSingPayPayment(opts: SingPayOptions): Promise<string> {
  const body = {
    portefeuille: WALLET_ID,
    reference: opts.reference,
    redirect_success: opts.redirectSuccess || `${window.location.origin}/?payment=success`,
    redirect_error: opts.redirectError || `${window.location.origin}/?payment=error`,
    amount: opts.amount,
    disbursement: DISBURSEMENT_ID,
    logoURL: opts.logoURL || `${window.location.origin}/favicon.png`,
    isTransfer: false,
  };

  const res = await fetch(SINGPAY_ENDPOINT, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'Content-Type': 'application/json',
      'x-client-id': CLIENT_ID,
      'x-client-secret': CLIENT_SECRET,
      'x-wallet': WALLET_ID,
    } as any,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SingPay erreur ${res.status}: ${text}`);
  }
  const data = await res.json();
  const link = data?.link as string;
  if (!link) throw new Error('Lien de paiement manquant');
  return link;
} 