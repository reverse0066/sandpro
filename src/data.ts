/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Invoice } from './types';

export const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNo: '1913',
    date: '2026/04/02',
    customerName: 'شركة رائد الاحتراف الرياضي',
    customerNo: '186',
    vatNo: '314093276600003',
    totalAmount: 115575.00,
    totalVat: 17336.25,
    totalWithVat: 132911.25,
    status: 'pending',
  },
  {
    id: '2',
    invoiceNo: '1984',
    date: '2026/05/02',
    customerName: 'شركة رائد الاحتراف الرياضي',
    customerNo: '186',
    vatNo: '314093276600003',
    totalAmount: 180450.00,
    totalVat: 27067.50,
    totalWithVat: 207517.50,
    status: 'pending',
  },
  {
    id: '3',
    invoiceNo: '2091',
    date: '2026/06/20',
    customerName: 'شركة رائد الاحتراف الرياضي',
    customerNo: '186',
    vatNo: '314093276600003',
    totalAmount: 181595.00,
    totalVat: 27239.25,
    totalWithVat: 208834.25,
    status: 'pending',
  },
];
