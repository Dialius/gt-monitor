import fetch from 'node-fetch';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ONLINE_CONFIG } from '../config/online-config.js';
import { log, logError, formatNumber, getTimestamp } from '../utils/logger.js';
import { getDataFetcher } from './data-fetcher.js';

class OnlineMonitor {
    constructor() {
        this.serverData = new Map();
        this.proxyAgent = null;
        this.lastRequestTime = 0;
        this.initProxy();
        this.sendStartupNotifications();
    }

    initProxy() {
        if (ONLINE_CONFIG.useProxy) {
            const { host, port, username, password } = ONLINE_CONFIG.proxySettings;
            this.proxyAgent = new SocksProxyAgent(
                `socks5://${username}:${password}@${host}:${port}`
            );
            log('Proxy initialized', 'OnlineMonitor');
        }
    }

    async sendStartupNotifications() {
        try {
            // Get initial data for startup notifications
            const fetcher = await getDataFetcher();
            const initialData = await fetcher.getCombinedPlayerData();
            
            const playerCount = initialData?.online_user || 0;
            const banRate = initialData?.ban_rate || 0;
            const banRateText = banRate > 0 ? ` | Ban Rate: ${banRate.toFixed(2)}%` : '';

            for (const [serverId, config] of Object.entries(ONLINE_CONFIG.SERVER_CONFIGS)) {
                await this.sendWebhook(serverId, 'normal', 
                    `${getTimestamp()} BW Counter started! Maintenance threshold: ${ONLINE_CONFIG.maintenanceThreshold}`
                );
                this.serverData.set(serverId, {
                    oldCounter: playerCount,
                    oldBanRate: banRate,
                    isMaintenance: false,
                    isFirstRun: true
                });
            }
        } catch (error) {
            logError(error, 'OnlineMonitor/sendStartupNotifications');
            // Initialize with default values if startup data fetch fails
            for (const [serverId, config] of Object.entries(ONLINE_CONFIG.SERVER_CONFIGS)) {
                this.serverData.set(serverId, {
                    oldCounter: null,
                    oldBanRate: null,
                    isMaintenance: false,
                    isFirstRun: true
                });
            }
        }
    }

    async checkAllServers() {
        try {
            const fetcher = await getDataFetcher();
            
            // Get combined data (online players from official GT API + ban data from GTID/Noire)
            const combinedData = await fetcher.getCombinedPlayerData();
            
            if (!combinedData) {
                log('No combined player data available, skipping check', 'OnlineMonitor');
                return;
            }

            const playerCount = combinedData.online_user || 0;
            const banRate = combinedData.ban_rate || 0;
            const sources = combinedData.sources || {};

            log(`Received combined data: ${playerCount} players (from ${sources.playerCount}), ${banRate}% ban rate (from ${sources.banRate})`, 'OnlineMonitor');

            for (const [serverId] of Object.entries(ONLINE_CONFIG.SERVER_CONFIGS)) {
                await this.processServerData(serverId, {
                    online_user: playerCount,
                    ban_rate: banRate,
                    lastUpdated: combinedData.lastUpdated,
                    sources: sources
                });
                // Small delay between server processing
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.lastRequestTime = Date.now();
        } catch (error) {
            logError(error, 'OnlineMonitor/checkAllServers');
        }
    }

    async processServerData(serverId, playersData) {
        const config = ONLINE_CONFIG.SERVER_CONFIGS[serverId];
        const serverState = this.serverData.get(serverId);
        
        if (!serverState) {
            log(`Server state not found for ${serverId}, initializing...`, 'OnlineMonitor');
            this.serverData.set(serverId, {
                oldCounter: null,
                oldBanRate: null,
                isMaintenance: false,
                isFirstRun: true
            });
            return;
        }
        
        const playerCount = playersData.online_user || 0;
        const banRate = playersData.ban_rate || 0;
        
        if (serverState.isFirstRun) {
            await this.handleFirstRun(serverId, playerCount, banRate);
            serverState.isFirstRun = false;
            serverState.oldCounter = playerCount;
            serverState.oldBanRate = banRate;
            return;
        }

        // Skip processing if we don't have valid previous data
        if (serverState.oldCounter === null || serverState.oldCounter === undefined) {
            log(`No previous data for ${serverId}, treating as first run`, 'OnlineMonitor');
            serverState.oldCounter = playerCount;
            serverState.oldBanRate = banRate;
            return;
        }

        const playerDifference = playerCount - serverState.oldCounter;
        const absolutePlayerDifference = Math.abs(playerDifference);
        const playerPercentage = serverState.oldCounter > 0 ? 
            (absolutePlayerDifference / serverState.oldCounter * 100).toFixed(2) : '0.00';

        // Maintenance detection
        if (playerCount < ONLINE_CONFIG.maintenanceThreshold) {
            if (!serverState.isMaintenance) {
                serverState.isMaintenance = true;
                await this.sendMaintenanceAlert(serverId, playerCount, playerDifference);
            }
        } 
        // Maintenance ended
        else if (serverState.isMaintenance) {
            serverState.isMaintenance = false;
            await this.sendMaintenanceEnd(serverId, playerCount);
        }
        // Normal operations
        else {
            await this.sendNormalUpdate(serverId, playerCount, playerDifference, playerPercentage, banRate);
            
            // Banwave detection logic
            if (playerDifference < 0 && absolutePlayerDifference >= ONLINE_CONFIG.bwlimit) {
                if (config.SHOW_BANRATE && banRate > 0) {
                    // Only send ban rate alert if there IS a ban rate
                    await this.processBanRateAlert(serverId, playerCount, playerDifference, playerPercentage, banRate);
                } else if (banRate === 0) {
                    // Only send regular banwave alert if there is NO ban rate (banRate === 0)
                    await this.sendBanwaveAlert(serverId, playerCount, playerDifference, playerPercentage);
                    log(`Regular banwave detected for ${serverId}: ${absolutePlayerDifference} player drop with 0% ban rate`, 'OnlineMonitor');
                }
                // If banRate > 0 but SHOW_BANRATE is false, no alert is sent
            }
        }
        
        serverState.oldCounter = playerCount;
        serverState.oldBanRate = banRate;
    }

    async handleFirstRun(serverId, playerCount, banRate) {
        const banRateText = banRate > 0 ? ` | Ban Rate: ${banRate.toFixed(2)}%` : '';
        // Format baru untuk startup
        await this.sendWebhook(serverId, 'normal',
            `${getTimestamp()} **${formatNumber(playerCount)}** Online Players | Monitor Started${banRateText}`
        );
        log(`Monitor started for ${serverId}: ${playerCount} players, ${banRate}% ban rate`, 'OnlineMonitor');
    }

    async sendNormalUpdate(serverId, playerCount, difference, percentage, banRate) {
        let content;
        const banRateText = banRate > 0 ? ` | Ban Rate: ${banRate.toFixed(2)}%` : '';
        
        if (difference === 0) {
            // Format baru untuk tanpa perubahan
            content = `${getTimestamp()} **${formatNumber(playerCount)}** Online Players${banRateText}`;
        } else {
            const sign = difference >= 0 ? '+' : '';
            // Format baru tanpa emoji
            content = `${getTimestamp()} **${formatNumber(playerCount)} (${sign}${formatNumber(difference)} | ${sign}${percentage}%)** Online Players${banRateText}`;
        }
        await this.sendWebhook(serverId, 'normal', content);
    }

    async sendBanwaveAlert(serverId, playerCount, difference, percentage) {
        const config = ONLINE_CONFIG.SERVER_CONFIGS[serverId];
        // Format baru untuk player drop
        const content = `${getTimestamp()} **PLAYER DROP DETECTED**\n` +
                    `**${formatNumber(playerCount)} (-${formatNumber(Math.abs(difference))} | -${percentage}%)**\n` +
                    `<@&${config.BANWAVE_ROLE_ID}>`;
        await this.sendWebhook(serverId, 'banwave', content);
    }

    async processBanRateAlert(serverId, playerCount, difference, percentage, banRate) {
        const config = ONLINE_CONFIG.SERVER_CONFIGS[serverId];
        
        if (banRate >= config.MIN_BANRATE_PING) {
            // Format untuk banwave besar (real banwave)
            const content = `${getTimestamp()} **MAJOR BANWAVE DETECTED**\n` +
                        `**${formatNumber(playerCount)} (-${formatNumber(Math.abs(difference))} | -${percentage}%) | Ban Rate: ${banRate.toFixed(2)}%**\n\n` +
                        `<@&${config.BANRATE_ROLE_ID}>`;
            await this.sendWebhook(serverId, 'banrate', content);
            log(`Major banwave detected for ${serverId}: ${banRate}% ban rate`, 'OnlineMonitor');
        } else if (banRate > 0 && banRate < config.MIN_BANRATE_PING) {
            // Format untuk banwave kecil (ban log)
            const content = `${getTimestamp()} **MINOR BANWAVE DETECTED**\n` +
                        `**${formatNumber(playerCount)} (-${formatNumber(Math.abs(difference))} | -${percentage}%) | Ban Rate: ${banRate.toFixed(2)}%**`;
            await this.sendWebhook(serverId, 'banrate', content);
            log(`Minor banwave detected for ${serverId}: ${banRate}% ban rate`, 'OnlineMonitor');
        }
    }

    async sendMaintenanceAlert(serverId, playerCount, difference) {
        const config = ONLINE_CONFIG.SERVER_CONFIGS[serverId];
        // Format yang diperbaiki untuk maintenance
        await this.sendWebhook(serverId, 'normal', 
            `${getTimestamp()} **SERVER MAINTENANCE DETECTED**`
        );
        await this.sendWebhook(serverId, 'normal',
            `${getTimestamp()} <@&${config.MAINTENANCE_ROLE_ID}> **${formatNumber(playerCount)} (-${formatNumber(Math.abs(difference))})** Online Players | [MAINTENANCE](${ONLINE_CONFIG.maintenanceGif})`
        );
        log(`Maintenance mode detected for ${serverId}: ${playerCount} players`, 'OnlineMonitor');
    }

    async sendMaintenanceEnd(serverId, playerCount) {
        // Format yang diperbaiki untuk maintenance end
        await this.sendWebhook(serverId, 'normal', 
            `${getTimestamp()} **SERVER MAINTENANCE ENDED**`
        );
        await this.sendWebhook(serverId, 'normal',
            `${getTimestamp()} **${formatNumber(playerCount)}** Online Players | Server Back Online`
        );
        log(`Maintenance completed for ${serverId}: ${playerCount} players`, 'OnlineMonitor');
    }

    async sendWebhook(serverId, type, content) {
        const config = ONLINE_CONFIG.SERVER_CONFIGS[serverId];
        const webhookUrl = config.WEBHOOKS[type];
        
        if (!webhookUrl) {
            log(`No webhook URL configured for ${serverId}/${type}`, 'OnlineMonitor');
            return;
        }

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
                timeout: 10000,
                agent: this.proxyAgent
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            log(`Webhook sent successfully to ${serverId}/${type}`, 'OnlineMonitor');
        } catch (error) {
            logError(error, `OnlineMonitor/webhook/${serverId}/${type}`);
        }
    }

    start() {
        log('Starting enhanced monitoring with separated online/ban data...', 'OnlineMonitor');
        
        const checkInterval = Math.max(ONLINE_CONFIG.checkInterval, 1) * 60 * 1000;
        
        // Initial check
        setTimeout(() => {
            this.checkAllServers();
        }, 5000); // Wait 5 seconds after start
        
        // Regular interval checks
        this.interval = setInterval(() => this.checkAllServers(), checkInterval);
        
        log(`Enhanced monitoring started with ${ONLINE_CONFIG.checkInterval} minute intervals`, 'OnlineMonitor');
        log('Data sources: Official GT API (online players) + GTID/Noire APIs (ban data)', 'OnlineMonitor');
        
        return {
            stop: () => {
                clearInterval(this.interval);
                log('Enhanced monitoring stopped', 'OnlineMonitor');
            }
        };
    }

    // Method to manually trigger a check (useful for testing)
    async manualCheck() {
        log('Manual check triggered', 'OnlineMonitor');
        await this.checkAllServers();
    }

    // Method to get current monitoring status
    getStatus() {
        const status = {
            isRunning: !!this.interval,
            lastRequestTime: this.lastRequestTime,
            serversTracked: this.serverData.size,
            servers: {}
        };

        for (const [serverId, data] of this.serverData.entries()) {
            status.servers[serverId] = {
                currentPlayers: data.oldCounter,
                currentBanRate: data.oldBanRate,
                isMaintenance: data.isMaintenance,
                isFirstRun: data.isFirstRun
            };
        }

        return status;
    }

    // Method to get detailed data fetcher status
    async getDataFetcherStatus() {
        try {
            const fetcher = await getDataFetcher();
            return {
                cacheStatus: fetcher.getCacheStatus(),
                apiHealthStatus: fetcher.getApiHealthStatus()
            };
        } catch (error) {
            logError(error, 'OnlineMonitor/getDataFetcherStatus');
            return null;
        }
    }

    // Method to force refresh data
    async forceRefresh() {
        try {
            log('Force refresh triggered', 'OnlineMonitor');
            const fetcher = await getDataFetcher();
            
            // Clear cache and get fresh data
            fetcher.clearCache();
            const freshData = await fetcher.getCombinedPlayerData();
            
            log(`Force refresh completed: ${freshData?.online_user || 0} players, ${freshData?.ban_rate || 0}% ban rate`, 'OnlineMonitor');
            return freshData;
        } catch (error) {
            logError(error, 'OnlineMonitor/forceRefresh');
            return null;
        }
    }
}

export async function startOnlineMonitoring() {
    const monitor = new OnlineMonitor();
    return monitor.start();
}

export { OnlineMonitor };