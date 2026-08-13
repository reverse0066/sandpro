/**
 * Arabic Tafqeet (تفقيط المبالغ بالأرقام والكلمات العربية)
 * Converts numeric amounts into formal Arabic words for Saudi Riyals & Halalas.
 */

const ones = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];

const tens = [
  '',
  '',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون',
];

const hundreds = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

function convertThreeDigits(num: number): string {
  if (num === 0) return '';

  let result = '';
  const h = Math.floor(num / 100);
  const remainder = num % 100;

  if (h > 0) {
    result += hundreds[h];
  }

  if (remainder > 0) {
    if (result.length > 0) result += ' و';

    if (remainder < 20) {
      result += ones[remainder];
    } else {
      const o = remainder % 10;
      const t = Math.floor(remainder / 10);

      if (o > 0) {
        result += ones[o] + ' و' + tens[t];
      } else {
        result += tens[t];
      }
    }
  }

  return result;
}

/**
 * Converts a positive number to Arabic words
 */
export function tafqeetNumber(num: number): string {
  if (isNaN(num) || num === 0) return 'صفر';

  const integerPart = Math.floor(Math.abs(num));

  if (integerPart === 0) return 'صفر';

  const billions = Math.floor(integerPart / 1000000000);
  const millions = Math.floor((integerPart % 1000000000) / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const remainder = integerPart % 1000;

  const parts: string[] = [];

  // Billions
  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else if (billions >= 3 && billions <= 10) parts.push(`${convertThreeDigits(billions)} مليارات`);
    else parts.push(`${convertThreeDigits(billions)} مليار`);
  }

  // Millions
  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertThreeDigits(millions)} ملايين`);
    else parts.push(`${convertThreeDigits(millions)} مليون`);
  }

  // Thousands
  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertThreeDigits(thousands)} آلاف`);
    else parts.push(`${convertThreeDigits(thousands)} ألف`);
  }

  // Remainder (< 1000)
  if (remainder > 0) {
    parts.push(convertThreeDigits(remainder));
  }

  return parts.join(' و');
}

/**
 * Converts currency amount into full Arabic words (فقط ... ريال سعودي و ... هللة لا غير)
 */
export function tafqeet(amount: number, currencyName: string = 'ريال سعودي', coinName: string = 'هللة'): string {
  if (isNaN(amount) || amount === 0) {
    return `فقط صفر ${currencyName} لا غير`;
  }

  const positiveAmount = Math.abs(amount);
  const mainPart = Math.floor(positiveAmount);
  const subPart = Math.round((positiveAmount - mainPart) * 100);

  let result = 'فقط ';

  if (mainPart > 0) {
    result += tafqeetNumber(mainPart) + ' ' + currencyName;
  }

  if (subPart > 0) {
    if (mainPart > 0) result += ' و';
    result += tafqeetNumber(subPart) + ' ' + coinName;
  }

  result += ' لا غير';

  return result;
}
