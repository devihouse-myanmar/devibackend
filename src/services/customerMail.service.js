import CustomError from '../utils/customError.js';

export function customerStorefrontOrigin() {
  const production = process.env.NODE_ENV === 'production';
  const configured = process.env.CUSTOMER_AUTH_STOREFRONT_ORIGIN || (!production && 'http://localhost:5173');
  try {
    const url = new URL(configured);
    if ((url.protocol === 'https:' || (!production && url.protocol === 'http:')) &&
        url.href === `${url.origin}/`) return url.origin;
  } catch {
    // Report a generic error without including the configured URL.
  }
  throw new CustomError(503, 'Customer login is temporarily unavailable.', 'CUSTOMER_AUTH_UNAVAILABLE');
}

export function customerMailer() {
  const production = process.env.NODE_ENV === 'production';
  const from = process.env.CUSTOMER_AUTH_EMAIL_FROM;
  const apiKey = process.env.CUSTOMER_AUTH_RESEND_API_KEY;
  const mailpit = !production && process.env.CUSTOMER_AUTH_MAILPIT_URL;
  const storefront = customerStorefrontOrigin();
  if (!from || (!mailpit && !apiKey)) {
    throw new CustomError(503, 'Customer email is temporarily unavailable.', 'CUSTOMER_AUTH_UNAVAILABLE');
  }
  const endpoint = mailpit ? new URL('/api/v1/send', mailpit) : 'https://api.resend.com/emails';

  return async (email, purpose, token) => {
    const reset = purpose === 'passwordReset';
    const url = new URL(reset ? '/reset-password' : '/verify-email', storefront);
    url.hash = new URLSearchParams({ token }).toString();
    const subject = reset ? 'Devi House — စကားဝှက် ပြန်သတ်မှတ်ရန်' : 'Devi House — အီးမေးလ် အတည်ပြုရန်';
    const text = `${subject}\n\n${url.href}\n\nဒီ request ကို သင် မလုပ်ခဲ့လျှင် အီးမေးလ်ကို လျစ်လျူရှုနိုင်ပါတယ်။`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: mailpit
          ? { 'Content-Type': 'application/json' }
          : { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(mailpit
          ? { From: { Email: from }, To: [{ Email: email }], Subject: subject, Text: text }
          : { from, to: [email], subject, text }),
        signal: AbortSignal.timeout(1700),
      });
      if (!response.ok) console.error('[CustomerMail] Provider rejected the message', response.status);
    } catch {
      console.error('[CustomerMail] Provider request failed');
    }
  };
}
