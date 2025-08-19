export const API_CONFIG = {
    ENDPOINTS: {
        // Tambahkan API key untuk FreeCurrency API
        exchangeRate: `https://api.freecurrencyapi.com/v1/latest?apikey=${process.env.FREE_CURRENCY_API_KEY || 'fca_live_akIbOMjjFeunewRpXavbv7sIvEUFzVQkpLqC7Ix5'}`,
        diamondLock: 'https://gtid.dev/get-latest-pricedl',
        // Separate endpoints for online players and ban data
        onlinePlayers: 'https://www.growtopiagame.com/detail',  // Official GT API for player count
        banData: [
            'https://gtid.dev/get-latest-online',   // Primary - GTID prioritized for ban data
            'https://api.noire.my.id/api/player',   // Backup - Noire as fallback
        ],
        mods: [
            'https://api.noire.my.id/api/mods',     // Primary - Noire prioritized for mods
            'https://gtid.dev/get-mods',            // Backup - GTID as fallback
        ]
    },
    INTERVALS: {
        fast: 30 * 1000,    // 30 seconds for most data
        slow: 60 * 60 * 1000 // 1 hour for currency
    },
    RATE_LIMIT: {
        maxRetries: 3,
        retryDelay: 1500,    // Reduced from 2000ms
        maxConcurrent: 3     // Increased for better throughput
    },
    PROXY: {
        enabled: false,
        socks5: {
            host: '37.218.219.66',
            port: 5432,
            username: 'puhfg',
            password: 'auorqv7k'
        }
    },
    REQUEST_CONFIG: {
        timeout: 8000,       // Reduced from 10000ms for faster failures
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    },
    // API Priority settings
    PRIORITY: {
        // Prefer GTID for ban data within this time difference (2 minutes)
        gtidTimeThreshold: 2 * 60 * 1000,
        // Prefer Noire for mods data - always try Noire first
        noireTimeThreshold: 5 * 60 * 1000,
        // Mark API as unhealthy after this many consecutive failures
        healthFailureThreshold: 3,
        // Time to wait before retrying unhealthy API (5 minutes)
        unhealthyRetryDelay: 5 * 60 * 1000,
        // Time to wait before switching back to primary API when it becomes healthy (2 minutes)
        switchBackDelay: 2 * 60 * 1000
    }
};