import { FAQItem } from './types';

// A fictional SaaS product "NebulaFlow"
export const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    category: 'Billing',
    question: 'How much does NebulaFlow cost?',
    answer: 'NebulaFlow offers three tiers: Starter ($10/mo), Pro ($29/mo), and Enterprise (custom pricing). You can view full details on our pricing page.',
  },
  {
    id: '2',
    category: 'Billing',
    question: 'Can I cancel my subscription at any time?',
    answer: 'Yes, you can cancel your subscription at any time from your account settings. Your access will continue until the end of your current billing cycle.',
  },
  {
    id: '3',
    category: 'Billing',
    question: 'Do you offer a refund policy?',
    answer: 'We offer a 30-day money-back guarantee for all new subscriptions. Contact support if you are not satisfied.',
  },
  {
    id: '4',
    category: 'Technical',
    question: 'How do I reset my password?',
    answer: 'To reset your password, click "Forgot Password" on the login screen. We will email you a secure link to choose a new one.',
  },
  {
    id: '5',
    category: 'Technical',
    question: 'Does NebulaFlow support dark mode?',
    answer: 'Yes! You can toggle dark mode in the Settings > Appearance menu, or use the system default preference.',
  },
  {
    id: '6',
    category: 'Features',
    question: 'Can I invite other team members?',
    answer: 'Absolutely. On the Pro plan, you can invite up to 10 members. Enterprise plans support unlimited team members.',
  },
  {
    id: '7',
    category: 'Features',
    question: 'Is there a mobile app available?',
    answer: 'We have beta apps available for both iOS and Android. You can download them from the respective app stores under "NebulaFlow Preview".',
  },
  {
    id: '8',
    category: 'Technical',
    question: 'Is my data secure?',
    answer: 'Security is our top priority. We use AES-256 encryption at rest and TLS 1.3 for all data in transit. We are also SOC2 Type II compliant.',
  },
  {
    id: '9',
    category: 'General',
    question: 'What is NebulaFlow?',
    answer: 'NebulaFlow is an all-in-one project management tool designed to help remote teams collaborate seamlessly using AI-driven workflows.',
  },
  {
    id: '10',
    category: 'Billing',
    question: 'Do you accept PayPal?',
    answer: 'Currently, we only accept major credit cards (Visa, MasterCard, Amex) and bank transfers for Enterprise invoices.',
  }
];

// Common English stopwords to filter out during NLP preprocessing
export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each',
  'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up',
  'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);
