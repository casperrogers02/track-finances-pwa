// Currency conversion rates (matches backend)
const rates = {
  UGX: {
    USD: 1 / 3600,
    EUR: 1 / 3900,
    GBP: 1 / 4500,
    KES: 1 / 25,
    TZS: 1 / 1.5,
    UGX: 1
  },
  USD: {
    UGX: 3600,
    EUR: 0.92,
    GBP: 1.25,
    KES: 144,
    TZS: 2400,
    USD: 1
  },
  EUR: {
    UGX: 3900,
    USD: 1.09,
    GBP: 1.36,
    KES: 156,
    TZS: 2600,
    EUR: 1
  },
  GBP: {
    UGX: 4500,
    USD: 1.25,
    EUR: 0.74,
    KES: 180,
    TZS: 3000,
    GBP: 1
  },
  KES: {
    UGX: 25,
    USD: 0.0069,
    EUR: 0.0064,
    GBP: 0.0056,
    TZS: 16.67,
    KES: 1
  },
  TZS: {
    UGX: 1.5,
    USD: 0.00042,
    EUR: 0.00038,
    GBP: 0.00033,
    KES: 0.06,
    TZS: 1
  }
};

/**
 * Convert amount from one currency to another
 */
export function convert(amount, from, to) {
  if (from === to) return amount;
  
  if (!rates[from] || !rates[from][to]) {
    console.error(`Conversion rate not available for ${from} to ${to}`);
    return amount;
  }
  
  return amount * rates[from][to];
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount, currency = 'UGX') {
  const symbols = {
    UGX: 'UGX',
    USD: '$',
    EUR: '€',
    GBP: '£',
    KES: 'KES',
    TZS: 'TZS'
  };
  
  const symbol = symbols[currency] || currency;
  
  // Format with commas for thousands
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'UGX' ? 0 : 2,
    maximumFractionDigits: currency === 'UGX' ? 0 : 2
  }).format(amount);
  
  return `${symbol} ${formatted}`;
}

/**
 * Get all available currencies
 */
export function getAvailableCurrencies() {
  return Object.keys(rates);
}
