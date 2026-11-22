import type { IconName } from '@/components/ui';

export type Chapter = {
  id: string;
  title: string;
  minutes: number;
  intro: string;
  cards?: Array<{ icon: IconName; title: string; body: string; example?: string }>;
  pairs?: Array<[string, string]>;
  steps?: Array<[string, string]>;
};

export const GUIDE: Chapter[] = [
  {
    id: 'flags',
    title: 'Red flags 101',
    minutes: 4,
    intro: 'Almost every scam leans on the same six tricks. Spot one and slow down. Spot two and it is almost certainly fake.',
    cards: [
      { icon: 'alternate-email', title: 'Spoofed sender', body: 'The name looks right but the address is off by a letter or a domain.', example: 'security@paypa1-verify.com' },
      { icon: 'timer', title: 'Urgent pressure', body: 'Short deadlines push you to act before you think.', example: '"Verify within 24 hours"' },
      { icon: 'link', title: 'Suspicious link', body: 'Long-press a link on your phone to see the real address before you tap.', example: 'usps-redelivery-help.co' },
      { icon: 'payments', title: 'Asks for money or codes', body: 'Real companies never ask for passwords, codes or gift cards.', example: '"Read me the 6-digit code"' },
      { icon: 'redeem', title: 'Too good to be true', body: 'Prizes for contests you never entered are bait.', example: '"You won a $500 gift card"' },
      { icon: 'call', title: 'Caller ID tricks', body: 'Numbers can be faked. Hang up and call the official number yourself.', example: '"IRS" (202) 555-0198' },
    ],
  },
  {
    id: 'mail',
    title: 'Phishing emails',
    minutes: 3,
    intro: 'Emails are the easiest to fake. Read the address, not the name.',
    cards: [
      { icon: 'visibility', title: 'Read the full sender address', body: '"PayPal" can come from anywhere. The part after @ is what counts.' },
      { icon: 'link', title: 'Check every link first', body: 'Long-press on a phone or hover on a computer to see where it really goes.' },
      { icon: 'spellcheck', title: 'Watch for look-alike letters', body: 'rn looks like m, a capital I looks like l, 0 looks like O.' },
      { icon: 'apps', title: 'Open the app instead', body: 'If an email says there is a problem, check in the official app you already use.' },
    ],
  },
  {
    id: 'sms',
    title: 'Scam texts',
    minutes: 3,
    intro: 'Texts feel personal, which is why scammers love them.',
    cards: [
      { icon: 'local-shipping', title: 'Couriers do not text for fees', body: 'USPS, UPS and FedEx do not ask for payment by text.' },
      { icon: 'phone-iphone', title: '"New number" needs proof', body: 'Call the person on the number you already have before you send anything.' },
      { icon: 'chat-bubble-outline', title: 'Wrong-number chats are a setup', body: 'A friendly stranger who texted by mistake often turns into an investment pitch.' },
      { icon: 'password', title: 'Codes are only for you', body: 'A code you did not request means someone is trying to get into your account.' },
    ],
  },
  {
    id: 'call',
    title: 'Scam calls',
    minutes: 3,
    intro: 'On the phone, scammers rely on fear and speed.',
    cards: [
      { icon: 'account-balance', title: 'Government agencies write first', body: 'The IRS and Social Security send letters. They never demand payment on the call.' },
      { icon: 'card-giftcard', title: 'Gift cards and wires are red flags', body: 'No real business or agency takes payment in gift cards.' },
      { icon: 'call-end', title: 'Hang up and call back', body: 'Use the number on your card, bill or the official website.' },
      { icon: 'lock', title: 'Secrets are a warning', body: '"Don\'t tell anyone" is there to stop someone from warning you.' },
    ],
  },
  {
    id: 'links',
    title: 'Real vs fake links',
    minutes: 2,
    intro: 'The domain is the part right before the first single slash. It should end in the real company name.',
    pairs: [
      ['paypal.com/signin', 'paypal.com.account-check.net/signin'],
      ['usps.com/tracking', 'usps-redelivery-help.co/pay'],
      ['apple.com/account', 'apple-id-unlock.support'],
      ['chase.com/login', 'chase.secure-login.info'],
    ],
  },
  {
    id: 'clicked',
    title: 'If you already clicked',
    minutes: 2,
    intro: 'It happens. Act quickly and in this order.',
    steps: [
      ['Stop', 'Close the page. Do not enter anything else.'],
      ['Change the password', 'Change it on the real site, and anywhere else you used it.'],
      ['Call your bank', 'If you entered card details, ask them to block the card.'],
      ['Turn on two-step sign-in', 'A code on your phone stops most account takeovers.'],
      ['Report it', 'Forward phishing emails to reportphishing@apwg.org and scam texts to 7726.'],
    ],
  },
];
