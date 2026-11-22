// Round content. Answers (scam, why, explain) never leave the server until a round is answered.
export type ItemType = 'mail' | 'sms' | 'call';
export type Item = {
  id: string;
  type: ItemType;
  from: string;
  time: string;
  addr?: string;
  subject?: string;
  body?: string;
  linkLabel?: string;
  url?: string;
  number?: string;
  lines?: Array<{ who: 'caller' | 'you'; text: string }>;
  scam: boolean;
  why: string[];
  explain: string;
};

export const REASONS: Record<ItemType, string[]> = {
  mail: ['Spoofed sender', 'Urgent pressure', 'Suspicious link', 'Asks for personal info', 'Too good to be true', 'Nothing suspicious'],
  sms: ['Unknown number', 'Urgent deadline', 'Fake web address', 'Asks for money', 'Wrong-number trick', 'Nothing suspicious'],
  call: ['Pretends to be official', 'Threats or pressure', 'Odd payment method', 'Asks for codes', 'Keep it secret', 'Nothing suspicious'],
};

const C = (who: 'caller' | 'you', text: string) => ({ who, text });

export const ITEMS: Item[] = [
  { id: 'mail-1', type: 'mail', from: 'PayPaI Security', addr: 'security@paypa1-verify.com', subject: 'Your account has been limited', time: '8:31 AM', body: 'Dear Customer,\n\nWe noticed unusual activity on your account. Your access has been limited until you confirm your identity.\n\nPlease verify within 24 hours or your account will be permanantly closed.', linkLabel: 'Verify my account', url: 'paypa1-verify.com/login.php', scam: true, why: ['Spoofed sender', 'Suspicious link'], explain: 'The sender is "PayPaI" with a capital i, from paypa1-verify.com. The button goes to that fake site, not paypal.com.' },
  { id: 'mail-2', type: 'mail', from: 'Mom', addr: 'linda.r@gmail.com', subject: 'Dinner Sunday?', time: '8:40 AM', body: 'Hi sweetie,\n\nAre you free for dinner Sunday at 6? Dad is making lasagna. Bring a jacket, it gets cold on the porch.\n\nLove, Mom', scam: false, why: ['Nothing suspicious'], explain: 'A known contact, no links, no money, no pressure.' },
  { id: 'mail-3', type: 'mail', from: 'Netflix', addr: 'info@account.netflix.com', subject: 'Your monthly receipt', time: '9:12 AM', body: 'Thanks for your payment of $15.49 for the Standard plan.\n\nNo action is needed. You can see your billing history any time in the Netflix app under Account.', scam: false, why: ['Nothing suspicious'], explain: 'Real netflix.com domain, no link to click, and it tells you to use the app.' },
  { id: 'mail-4', type: 'mail', from: 'IT Helpdesk', addr: 'it-support@yourcompany-helpdesk.net', subject: 'Password expires today', time: 'Yesterday', body: 'Your network password expires in 2 hours. To keep your current password, confirm it now or you will be locked out of email and Wi-Fi.', linkLabel: 'Keep my password', url: 'yourcompany-helpdesk.net/keep', scam: true, why: ['Spoofed sender', 'Urgent pressure', 'Suspicious link'], explain: 'Your IT team would use yourcompany.com, not a look-alike domain. "2 hours or you are locked out" is pressure.' },
  { id: 'mail-5', type: 'mail', from: 'Prize Center', addr: 'winner@prize-center.biz', subject: 'You won a $500 gift card', time: 'Mon', body: "Congratulations! You were selected as this week's winner. Claim your $500 gift card now. Just cover the $4.99 shipping.", linkLabel: 'Claim my prize', url: 'prize-center.biz/claim', scam: true, why: ['Too good to be true', 'Suspicious link'], explain: 'You never entered a contest. Small "shipping fees" are how they get your card number.' },
  { id: 'mail-6', type: 'mail', from: 'Amazon', addr: 'shipment-tracking@amazon.com', subject: 'Your order has shipped', time: 'Yesterday', body: 'Your order of 1 × USB-C cable (2 m) has shipped and arrives Friday.\n\nTrack it any time in the Amazon app under Your Orders.', scam: false, why: ['Nothing suspicious'], explain: 'Real amazon.com address, matches something you ordered, and points you to the app.' },
  { id: 'mail-7', type: 'mail', from: 'Dr. Lee Dental', addr: 'appointments@leedental.com', subject: 'Reminder: cleaning Thursday 3:00 PM', time: 'Tue', body: 'This is a reminder of your cleaning on Thursday at 3:00 PM with Dr. Lee.\n\nNeed to reschedule? Call the office at the number on your card.', scam: false, why: ['Nothing suspicious'], explain: 'An expected reminder that asks for nothing and tells you to call the number you already have.' },
  { id: 'mail-8', type: 'mail', from: 'Bank of Arnerica', addr: 'alerts@bankofarnerica-secure.com', subject: 'Unusual sign-in detected', time: 'Tue', body: 'We detected a sign-in from a new device. To secure your account, reply to this email with your full card number, expiry date and Social Security number.', scam: true, why: ['Spoofed sender', 'Asks for personal info'], explain: '"Arnerica" uses r+n to look like m. No bank asks for your card number and SSN by email.' },
  { id: 'mail-9', type: 'mail', from: 'Dana Whitfield (CEO)', addr: 'dana.whitfield.ceo@gmail.com', subject: 'Quick favor', time: 'Mon', body: 'Are you at your desk? I need you to buy six $100 gift cards for a client today. Keep this between us for now, I will pay you back. Send me the codes when you have them.', scam: true, why: ['Spoofed sender', 'Urgent pressure'], explain: 'A CEO would not use a Gmail address or ask for gift cards in secret.' },
  { id: 'mail-10', type: 'mail', from: 'Lena Ortiz', addr: 'lena.ortiz@yourcompany.com', subject: 'Team lunch moved to Thursday', time: '11:02 AM', body: 'Hi all,\n\nThe room was double-booked, so team lunch is now Thursday at 12:30 in the 4th floor kitchen. Same menu as before.\n\nNo need to RSVP again.\n\nThanks,\nLena', scam: false, why: ['Nothing suspicious'], explain: 'A coworker on the real company domain with an ordinary update.' },

  { id: 'sms-1', type: 'sms', from: '+1 (202) 555-0143', time: '10:42 AM', body: 'USPS: Your package is on hold due to an unpaid shipping fee of $1.99. Pay within 24 hours to avoid return:', url: 'usps-redelivery-help.co/pay', scam: true, why: ['Fake web address', 'Asks for money', 'Urgent deadline'], explain: 'USPS does not text about fees. The link is not usps.com.' },
  { id: 'sms-2', type: 'sms', from: 'Jordan', time: 'Tue', body: 'u still coming tonight? doors at 8', scam: false, why: ['Nothing suspicious'], explain: 'A saved friend making plans. Nothing is asked of you.' },
  { id: 'sms-3', type: 'sms', from: '+1 (415) 555-0172', time: '10:58 AM', body: "Hey Mom, it's me. I dropped my phone and this is my new number. Can you send $300 for a new one? Please don't call, the mic is broken.", scam: true, why: ['Unknown number', 'Asks for money'], explain: '"New number, send money, don\'t call" is a classic. Call your kid on their old number.' },
  { id: 'sms-4', type: 'sms', from: '72265', time: 'Mon', body: "Your Chase verification code is 482913. Don't share it with anyone. We will never call to ask for it.", scam: false, why: ['Nothing suspicious'], explain: 'A code you asked for, from a short code, warning you not to share it.' },
  { id: 'sms-5', type: 'sms', from: '+1 (305) 555-0199', time: 'Sun', body: 'Hi, is this Sam? We met at the conference last week. My uncle has a great crypto tip if you want in.', scam: true, why: ['Wrong-number trick', 'Unknown number'], explain: '"Wrong number" chats are used to start a friendship, then push an investment.' },
  { id: 'sms-6', type: 'sms', from: 'Pizza Palace', time: '7:20 PM', body: 'Your order #4471 is out for delivery. ETA 7:45 PM.', scam: false, why: ['Nothing suspicious'], explain: 'Matches an order you placed. No link, no payment.' },
  { id: 'sms-7', type: 'sms', from: '+44 7700 900123', time: 'Sat', body: 'Apple: Your Apple ID has been locked for security reasons. Unlock within 12 hours:', url: 'apple-id-unlock.support', scam: true, why: ['Fake web address', 'Urgent deadline'], explain: 'Apple does not text unlock links. apple-id-unlock.support is not apple.com.' },
  { id: 'sms-8', type: 'sms', from: 'Coach Rivera', time: 'Fri', body: 'Practice is cancelled today because of the rain. See everyone Thursday.', scam: false, why: ['Nothing suspicious'], explain: 'A saved contact with a normal update.' },
  { id: 'sms-9', type: 'sms', from: '+1 (646) 555-0110', time: 'Fri', body: 'E-ZPass: You have an unpaid toll of $6.85. Pay within 12 hours to avoid a $50 late fee:', url: 'ezpass-tolls-pay.com', scam: true, why: ['Urgent deadline', 'Fake web address', 'Asks for money'], explain: 'Toll agencies mail notices. Tight deadlines plus a look-alike link is a scam.' },
  { id: 'sms-10', type: 'sms', from: 'Verizon', time: 'Thu', body: 'Your bill of $68.40 is ready. View it in the My Verizon app.', scam: false, why: ['Nothing suspicious'], explain: 'Expected bill, no link, points to the official app.' },

  { id: 'call-1', type: 'call', from: 'IRS Tax Office', number: '(202) 555-0198', time: 'Now', lines: [C('caller', 'This is Officer Daniels with the IRS. Our records show you owe $4,800 in back taxes.'), C('you', 'I never got a letter about this.'), C('caller', 'There is a warrant for your arrest. Pay today with gift cards and this goes away.'), C('caller', 'Do not hang up and do not tell anyone about this call.')], scam: true, why: ['Pretends to be official', 'Odd payment method', 'Threats or pressure', 'Keep it secret'], explain: 'The IRS sends letters first and never takes gift cards or threatens arrest by phone.' },
  { id: 'call-2', type: 'call', from: 'Dr. Lee Dental', number: '(415) 555-0110', time: 'Now', lines: [C('caller', "Hi, this is Maria from Dr. Lee's office confirming your cleaning Thursday at 3."), C('you', 'Yes, that works.'), C('caller', 'Great. If anything changes, call the office number on your card. See you then.')], scam: false, why: ['Nothing suspicious'], explain: 'An expected appointment call that asks for nothing.' },
  { id: 'call-3', type: 'call', from: 'Bank fraud dept.', number: '(800) 555-0144', time: 'Now', lines: [C('caller', 'We noticed a $900 charge on your card. Was that you?'), C('you', "No, it wasn't."), C('caller', 'To block it, read me the 6-digit code we just texted you.')], scam: true, why: ['Asks for codes', 'Pretends to be official'], explain: 'That code lets them into your account. Your bank never asks you to read it out.' },
  { id: 'call-4', type: 'call', from: 'Grandson "Alex"', number: 'Unknown', time: 'Now', lines: [C('caller', "Grandma? It's Alex. I'm in trouble, I got arrested."), C('caller', 'I need $2,000 for bail in cash. A courier will pick it up.'), C('caller', "Please don't tell Mom, she'll be so mad.")], scam: true, why: ['Keep it secret', 'Threats or pressure', 'Odd payment method'], explain: 'Secrecy plus cash by courier. Hang up and call your grandson or his parents directly.' },
  { id: 'call-5', type: 'call', from: 'Main St. Pharmacy', number: '(415) 555-0102', time: 'Now', lines: [C('caller', 'This is an automated message. Your prescription is ready for pickup at Main Street.'), C('caller', 'No action is needed. Thank you.')], scam: false, why: ['Nothing suspicious'], explain: 'An expected notice that asks for nothing.' },
  { id: 'call-6', type: 'call', from: '"Microsoft Support"', number: '(888) 555-0177', time: 'Now', lines: [C('caller', 'We detected a virus on your Windows computer.'), C('you', 'How do you know that?'), C('caller', 'Please go to your computer and install our remote tool so we can fix it now.')], scam: true, why: ['Pretends to be official', 'Threats or pressure'], explain: 'Microsoft does not cold-call you, and remote-access tools let scammers take over your PC.' },
  { id: 'call-7', type: 'call', from: 'City Power', number: '(415) 555-0150', time: 'Now', lines: [C('you', 'Hi, I called earlier about my bill.'), C('caller', 'Thanks for calling back. Your account ending 4471 has a balance of $82. You can pay any time in our app.')], scam: false, why: ['Nothing suspicious'], explain: 'You called them first, and they point you to the official app.' },
  { id: 'call-8', type: 'call', from: '"Social Security Admin."', number: '(202) 555-0101', time: 'Now', lines: [C('caller', 'Your Social Security number has been suspended due to suspicious activity.'), C('caller', 'Press 1 now to speak to an officer, or legal action will be taken.')], scam: true, why: ['Pretends to be official', 'Threats or pressure'], explain: 'SSNs cannot be "suspended". Threats of legal action are pressure.' },
  { id: 'call-9', type: 'call', from: 'Oak Hill School', number: '(415) 555-0133', time: 'Now', lines: [C('caller', 'Hi, this is the front office. Your son left his lunch on the bus.'), C('caller', 'You can drop it at the front desk any time before noon.')], scam: false, why: ['Nothing suspicious'], explain: 'A normal message that asks for nothing.' },
  { id: 'call-10', type: 'call', from: 'Prize Line', number: '(876) 555-0190', time: 'Now', lines: [C('caller', 'Congratulations! You won a 7-day cruise.'), C('caller', 'To lock it in, wire $199 for port fees today. The offer ends at 5 PM.')], scam: true, why: ['Odd payment method', 'Threats or pressure'], explain: 'Prizes you never entered, paid for by wire transfer, with a deadline.' },
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

/** What the client may see before answering. */
export function publicItem(item: Item) {
  const { scam: _s, why: _w, explain: _e, ...rest } = item;
  return { ...rest, reasons: REASONS[item.type] };
}

export function revealItem(item: Item) {
  return { scam: item.scam, why: item.why, explain: item.explain };
}
