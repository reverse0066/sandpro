/**
 * Utility functions for parsing numbers and currency amounts safely
 * supporting Arabic numerals (٠١٢٣٤٥٦٧٨٩), thousands separators, and currency text.
 */

export function parseAmountNumber(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (!val) return 0;

  let str = String(val).trim();

  // Convert Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) to ASCII (0123456789)
  str = str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  // Convert Persian numerals (۰۱۲۳۴۵۶۷۸۹)
  str = str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());

  // If comma is used as decimal separator (e.g. "1250,50"), convert to dot
  if (/,\d{1,2}$/.test(str) && !str.includes('.')) {
    str = str.replace(',', '.');
  } else {
    // Remove thousands commas
    str = str.replace(/,/g, '');
  }

  // Find floating point number pattern with at least 1 digit
  const match = str.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match || !match[0]) return 0;

  const parsed = parseFloat(match[0]);
  return isNaN(parsed) ? 0 : parsed;
}
