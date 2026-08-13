/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  name: string;
  username: string;
  pin: string;
  role: 'admin' | 'accountant' | 'viewer';
  roleLabel: string;
  permissions: {
    createReceipt: boolean;
    editSettings: boolean;
    viewReports: boolean;
    deleteReceipt: boolean;
  };
  isActive: boolean;
  lastLogin?: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  customerNo: string;
  vatNo: string;
  totalAmount: number;
  totalVat: number;
  totalWithVat: number;
  status: 'paid' | 'pending' | 'partial';
}

export interface Receipt {
  id: string;
  receiptNo: string;
  date: string;
  invoiceNo: string;
  customerName: string;
  amount: number;
  paymentMethod: 'نقداً' | 'شيك' | 'تحويل بنكي';
  referenceNo?: string;
  receivedFrom: string;
  notes: string;
  matchStatus?: 'matched' | 'mismatched';
  invoiceTotalWithVat?: number;
  invoiceDate?: string;
}

export interface OrganizationSettings {
  name: string;
  taxNo: string;
  crNo: string;
  logo?: string;
  signature?: string;
  stamp?: string;
  usePresetSignature?: boolean;
  selectedPresetSignatureId?: string;
  presetSignatures?: { id: string; name: string; image: string }[];
  address: string;
  phone: string;
  preferredTemplate: 'classic' | 'modern' | 'minimal' | 'luxury' | 'daftra' | 'professional';
  fontSize?: 'small' | 'medium' | 'large';
  isCompact?: boolean;
  accentColor: string;
  language?: 'ar' | 'en';
  users?: User[];
}

export interface StatementItem {
  id: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance?: number;
  vatAmount?: number;
  status?: 'ok' | 'warning';
}

export interface AccountStatement {
  id?: string;
  statementNo: string;
  createdDate: string;
  customerName: string;
  isCustomerConsistent: boolean;
  detectedCustomers: string[];
  startDate: string;
  endDate: string;
  openingBalance: number;
  items: StatementItem[];
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  notes?: string;
  fileName?: string;
}

