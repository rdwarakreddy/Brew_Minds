/**
 * numberToWords.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Converts a numeric amount (e.g. 48250.50) into words
 *   ("Forty Eight Thousand Two Hundred Fifty and 50/100") for the
 *   "Total Amount in Words" line on the invoice -- a standard
 *   requirement on freelance/business invoices so the written amount
 *   can't be silently altered after signing (same reason cheques spell
 *   out amounts in words).
 *
 *   We compute this SERVER-SIDE (not just on the frontend) so the
 *   words are always authoritative and consistent with the numeric
 *   total actually stored in the database.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function chunkToWords(num) {
  let str = '';
  if (num >= 100) {
    str += `${ONES[Math.floor(num / 100)]} Hundred `;
    num %= 100;
  }
  if (num >= 20) {
    str += `${TENS[Math.floor(num / 10)]} `;
    num %= 10;
  }
  if (num > 0) {
    str += `${ONES[num]} `;
  }
  return str.trim();
}

/**
 * Converts a non-negative number up to trillions into English words,
 * using the international numbering system (Thousand, Million, Billion).
 */
function numberToWords(amount) {
  const wholePart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - wholePart) * 100);

  if (wholePart === 0) return `Zero and ${String(decimalPart).padStart(2, '0')}/100`;

  const groups = [
    { value: 1_000_000_000, label: 'Billion' },
    { value: 1_000_000, label: 'Million' },
    { value: 1_000, label: 'Thousand' },
    { value: 1, label: '' },
  ];

  let remaining = wholePart;
  let words = '';
  for (const group of groups) {
    const groupValue = Math.floor(remaining / group.value);
    if (groupValue > 0) {
      words += `${chunkToWords(groupValue)} ${group.label} `.trim() + ' ';
      remaining %= group.value;
    }
  }

  return `${words.trim()} and ${String(decimalPart).padStart(2, '0')}/100`;
}

module.exports = { numberToWords };
