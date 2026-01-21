# Growtopia Discord Bots

![Discord Server](https://img.shields.io/discord/222078108977594368?color=5865F2&logo=discord&logoColor=white)
![npm version](https://img.shields.io/npm/v/@discordjs/builders.svg?maxAge=3600)
![npm downloads](https://img.shields.io/npm/dt/@discordjs/builders.svg?maxAge=3600)

A collection of Discord bots designed to provide useful information and features related to the game Growtopia. These bots leverage various APIs to fetch real-time data on exchange rates, online players, moderator status, and more.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
  - [API Configuration](#api-configuration)
  - [Bot Configuration](#bot-configuration)
  - [Server-Specific Configurations](#server-specific-configurations)
- [Usage](#usage)
- [Last Update](#last-update)
- [License](#License)
- [Contributing](#contributing)


## Features

*   **Real-time Diamond Lock (DL) Price:** Fetches and displays the current price of Diamond Locks in multiple currencies (IDR, USD, EUR).
*   **Online Player Count:** Tracks and displays the number of online players in Growtopia.
*   **Moderator Status:** Monitors and shows the status of Growtopia moderators.
*   **Ban Data & Banwave Detection:** Integrates with multiple sources to provide ban data and detect potential banwaves.
*   **Customizable Discord Bot Status:** Dynamic bot status updates based on game data (DL price, player count, mod count).
*   **Server-Specific Customization:** Allows different Discord servers to have unique configurations for emojis, webhooks, and displayed information.
*   **API Priority & Health Checks:** Prioritizes API sources and includes mechanisms to handle unhealthy APIs.
*   **Proxy Support:** Optional SOCKS5 proxy configuration for API requests.

## Installation

**Node.js 16.11.0 or newer is required.**

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Dialius/gt-monitor.git
    cd gt-monitor.git
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn add
    # or
    pnpm add
    ```

## Configuration

Before running the bots, you need to configure the API keys and bot tokens.

### API Configuration (`config/api-config.js`)

This file contains the endpoints and settings for external API calls.

```javascript
// Example snippet from api-config.js
export const API_CONFIG = {
    ENDPOINTS: {
        exchangeRate: `https://api.freecurrencyapi.com/v1/latest?apikey=${process.env.FREE_CURRENCY_API_KEY || 'YOUR_FREECURRENCY_API_KEY'}`,
        diamondLock: 'https://gtid.dev/get-latest-pricedl',
        onlinePlayers: 'https://www.growtopiagame.com/detail',
        banData: [
            'https://gtid.dev/get-latest-online',
            'https://api.noire.my.id/api/player',
        ],
        mods: [
            'https://api.noire.my.id/api/mods',
            'https://gtid.dev/get-mods',
        ]
    },
    INTERVALS: {
        fast: 30 * 1000,    // 30 seconds for most data
        slow: 60 * 60 * 1000 // 1 hour for currency
    },
    RATE_LIMIT: { /* ... */ },
    PROXY: { /* ... */ },
    REQUEST_CONFIG: { /* ... */ },
    PRIORITY: { /* ... */ }
};
```

**Important:**
*   Replace `'YOUR_FREECURRENCY_API_KEY'` with your actual FreeCurrency API key. It's highly recommended to use environment variables (`process.env.FREE_CURRENCY_API_KEY`) for sensitive keys.

### Bot Configuration (`config/mods-config.js` and `MultipleFiles/lock-config.js`)

These files contain the Discord bot tokens and general bot settings.

**`MultipleFiles/mods-config.js`:**
```javascript
// Example snippet from mods-config.js
export const BOT_CONFIG = {
    DISCORD_TOKEN: 'YOUR_MODS_BOT_TOKEN', // Replace with your bot's token
    CHECK_INTERVAL: 30 * 1000,
    STATUS_ROTATION_INTERVAL: 30 * 1000,
    DEFAULT_EMOJI_NAMES: { /* ... */ },
    BOT_STATUS: [ /* ... */ ]
};
```

**`MultipleFiles/lock-config.js`:**
```javascript
// Example snippet from lock-config.js
export const LOCK_CONFIG = {
    DEFAULT_EMOJI_NAMES: { /* ... */ },
    BOT_TOKEN: 'YOUR_LOCK_BOT_TOKEN', // Replace with your bot's token
    BOT_STATUS: [ /* ... */ ],
    STATUS_ROTATION_INTERVAL: 60 * 1000,
    MESSAGE_RECOVERY_LIMIT: 20
};
```

**Important:**
*   Replace `'YOUR_MODS_BOT_TOKEN'` and `'YOUR_LOCK_BOT_TOKEN'` with the actual Discord bot tokens for your respective bots.

### Server-Specific Configurations

*   **`config/mods-config.js` (SERVER_CONFIGS):**
    This section allows you to configure specific settings for different Discord servers where the "mods" bot will operate. Each key represents a Guild ID.
    ```javascript
    // Example snippet from mods-config.js
    export const SERVER_CONFIGS = {
        'YOUR_GUILD_ID_1': { // Replace with your Discord Server ID
            CHANNEL_ID: 'YOUR_CHANNEL_ID_1',
            LOG_CHANNEL_ID: 'YOUR_LOG_CHANNEL_ID_1',
            EMOJIS: { /* ... */ },
            FOOTER: { /* ... */ },
            MOD_ROLE_ID: 'YOUR_MOD_ROLE_ID_1',
            SHOW_DL_PRICE: true
        },
        // Add more server configurations as needed
    };
    ```
*   **`config/lock-config.js` (LOCK_SERVERS):**
    Similar to `SERVER_CONFIGS`, this allows server-specific settings for the "lock" bot.
    ```javascript
    // Example snippet from lock-config.js
    export const LOCK_SERVERS = {
        'YOUR_GUILD_ID_1': { // Replace with your Discord Server ID
            CHANNEL_ID: 'YOUR_CHANNEL_ID_1',
            LOG_CHANNEL_ID: 'YOUR_LOG_CHANNEL_ID_1',
            EMOJIS: { /* ... */ },
            FOOTER: { /* ... */ },
            SHOW_BGL: true
        },
        // Add more server configurations as needed
    };
    ```
*   **`config/online-config.js` (SERVER_CONFIGS):**
    This file contains configurations related to online player tracking, ban rates, and webhooks for different servers.
    ```javascript
    // Example snippet from online-config.js
    export const ONLINE_CONFIG = {
        useProxy: false,
        proxySettings: { /* ... */ },
        maintenanceThreshold: 100,
        maintenanceGif: "https://tenor.com/bjjFq.gif",
        checkInterval: 1, // in minutes
        bwlimit: 1500, // Minimum player drop to trigger regular banwave

        SERVER_CONFIGS: {
            'YOUR_GUILD_ID_1': { // Replace with your Discord Server ID
                SHOW_BANRATE: true,
                MIN_BANRATE_PING: 0.50,
                BANWAVE_ROLE_ID: 'YOUR_BANWAVE_ROLE_ID_1',
                MAINTENANCE_ROLE_ID: 'YOUR_MAINTENANCE_ROLE_ID_1',
                BANRATE_ROLE_ID: 'YOUR_BANRATE_ROLE_ID_1',
                WEBHOOKS: {
                    normal: "YOUR_NORMAL_WEBHOOK_URL_1",
                    banwave: "YOUR_BANWAVE_WEBHOOK_URL_1",
                    banrate: "YOUR_BANRATE_WEBHOOK_URL_1"
                }
            },
            // Add more server configurations as needed
        }
    };
    ```

**Note:** Replace placeholder IDs and URLs (`YOUR_GUILD_ID_X`, `YOUR_CHANNEL_ID_X`, `YOUR_WEBHOOK_URL_X`, etc.) with your actual Discord server, channel, role, and webhook IDs.

## Usage

To start the bots, you typically run a main script that initializes them. Assuming you have a `main.js` or `index.js` file that imports and runs these configurations:

```bash
node main.js
# or
npm start
```

(Adjust the command based on your project's `package.json` scripts or main entry point.)

## Last Update

**2024-07-26**

## License
This project is licensed under the MIT License - see the [LICENSE](/LICENSE) file for details.

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.

