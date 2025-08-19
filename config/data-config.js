export const DATA_CONFIG = {
    CURRENCY_API: {
        API_KEY: 'your_actual_api_here',
        BASE_CURRENCY: 'USD',
        TARGET_CURRENCIES: ['IDR', 'EUR']
    },
    UPDATE_INTERVALS: {
        exchangeRate: 60 * 60 * 1000, // 1 hour
        diamondLock: 30 * 1000 // 30 seconds
    },
    DEFAULT_RATES: {
        IDR: 16500,
        EUR: 0.85
    }
};