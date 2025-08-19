import fetch from 'node-fetch';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { API_CONFIG } from '../config/api-config.js';
import { log, logError } from '../utils/logger.js';

class DataFetcher {
    constructor() {
        this.cache = {};
        this.lastFetch = {};
        this.requestQueue = [];
        this.activeRequests = 0;
        this.proxyAgent = null;
        this.apiHealthStatus = {}; // Track API health
        this.lastHealthyPrimary = {}; // Track when primary API was last healthy
        this.initProxy();
        this.initializeCache();
        this.initApiHealthTracking();
    }

    initializeCache() {
        Object.keys(API_CONFIG.ENDPOINTS).forEach(endpoint => {
            this.cache[endpoint] = null;
            this.lastFetch[endpoint] = 0;
        });
    }

    initApiHealthTracking() {
        // Initialize health tracking for each API
        Object.keys(API_CONFIG.ENDPOINTS).forEach(endpoint => {
            const endpointConfig = API_CONFIG.ENDPOINTS[endpoint];
            if (Array.isArray(endpointConfig)) {
                this.apiHealthStatus[endpoint] = endpointConfig.map(url => ({
                    url,
                    successCount: 0,
                    failureCount: 0,
                    lastSuccess: 0,
                    lastFailure: 0,
                    isHealthy: true,
                    responseTime: 0,
                    consecutiveFailures: 0
                }));
                this.lastHealthyPrimary[endpoint] = Date.now();
            }
        });
    }

    initProxy() {
        if (API_CONFIG.PROXY.enabled) {
            const { host, port, username, password } = API_CONFIG.PROXY.socks5;
            this.proxyAgent = new SocksProxyAgent(
                `socks5://${username}:${password}@${host}:${port}`
            );
            log('Proxy initialized', 'DataFetcher');
        }
    }

    // Enhanced prioritized fetching strategy with smart switching back to primary
    async fetchWithPriority(endpoint, options = {}) {
        const endpointConfig = API_CONFIG.ENDPOINTS[endpoint];
        
        if (typeof endpointConfig === 'string') {
            return this.performFetch(endpointConfig, endpoint, options);
        } 
        
        if (!Array.isArray(endpointConfig)) {
            throw new Error(`Invalid endpoint configuration for: ${endpoint}`);
        }

        // Get prioritized URLs with smart switching logic
        const prioritizedUrls = this.getPrioritizedUrls(endpointConfig, endpoint);
        
        // Try primary API first
        const primaryUrl = prioritizedUrls[0];
        try {
            log(`Trying primary API for ${endpoint}: ${this.getApiName(primaryUrl.url)}`, 'DataFetcher');
            const startTime = Date.now();
            const data = await this.performFetch(primaryUrl.url, endpoint, options);
            const responseTime = Date.now() - startTime;
            
            // Update health status
            this.updateApiHealth(endpoint, primaryUrl.url, true, responseTime);
            
            // If this was the original primary API and it's healthy again, mark it
            if (this.isOriginalPrimary(endpoint, primaryUrl.url)) {
                this.lastHealthyPrimary[endpoint] = Date.now();
            }
            
            log(`Primary API success for ${endpoint} (${this.getApiName(primaryUrl.url)}) in ${responseTime}ms`, 'DataFetcher');
            return data;
            
        } catch (primaryError) {
            log(`Primary API failed for ${endpoint} (${this.getApiName(primaryUrl.url)}): ${primaryError.message}`, 'DataFetcher');
            this.updateApiHealth(endpoint, primaryUrl.url, false);
            
            // Try backup APIs if primary fails
            return this.tryBackupApis(prioritizedUrls.slice(1), endpoint, options);
        }
    }

    async tryBackupApis(backupUrls, endpoint, options) {
        if (backupUrls.length === 0) {
            throw new Error(`No backup APIs available for ${endpoint}`);
        }

        log(`Trying backup APIs for ${endpoint}`, 'DataFetcher');
        
        // Try backup APIs with a slight delay between attempts
        for (let i = 0; i < backupUrls.length; i++) {
            const apiInfo = backupUrls[i];
            try {
                if (i > 0) {
                    // Small delay between backup attempts
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                log(`Trying backup API ${i + 1} for ${endpoint}: ${this.getApiName(apiInfo.url)}`, 'DataFetcher');
                const startTime = Date.now();
                const data = await this.performFetch(apiInfo.url, endpoint, options);
                const responseTime = Date.now() - startTime;
                
                this.updateApiHealth(endpoint, apiInfo.url, true, responseTime);
                log(`Backup API ${i + 1} success for ${endpoint} (${this.getApiName(apiInfo.url)}) in ${responseTime}ms`, 'DataFetcher');
                return data;
                
            } catch (error) {
                log(`Backup API ${i + 1} failed for ${endpoint} (${this.getApiName(apiInfo.url)}): ${error.message}`, 'DataFetcher');
                this.updateApiHealth(endpoint, apiInfo.url, false);
            }
        }
        
        throw new Error(`All APIs failed for ${endpoint}`);
    }

    getPrioritizedUrls(urls, endpoint) {
        const healthStatus = this.apiHealthStatus[endpoint] || [];
        
        return urls.map((url, index) => {
            const health = healthStatus[index] || {
                url,
                successCount: 0,
                failureCount: 0,
                isHealthy: true,
                responseTime: 5000,
                consecutiveFailures: 0
            };
            return health;
        }).sort((a, b) => {
            // Enhanced priority logic for different endpoints
            
            if (endpoint === 'banData') {
                // For ban data: prefer GTID if healthy and recent
                const aIsGtid = a.url.includes('gtid.dev');
                const bIsGtid = b.url.includes('gtid.dev');
                
                if (aIsGtid && !bIsGtid && a.isHealthy) return -1;
                if (bIsGtid && !aIsGtid && b.isHealthy) return 1;
            }
            
            if (endpoint === 'mods') {
                // For mods: prefer Noire first, but with smart switching logic
                const aIsNoire = a.url.includes('noire.my.id');
                const bIsNoire = b.url.includes('noire.my.id');
                const now = Date.now();
                
                // Always prefer Noire if it's healthy
                if (aIsNoire && !bIsNoire && a.isHealthy) {
                    log(`Prioritizing Noire API for mods (healthy)`, 'DataFetcher');
                    return -1;
                }
                if (bIsNoire && !aIsNoire && b.isHealthy) {
                    log(`Prioritizing Noire API for mods (healthy)`, 'DataFetcher');
                    return 1;
                }
                
                // If Noire is unhealthy, check if enough time has passed to retry
                if (aIsNoire && !a.isHealthy) {
                    const timeSinceLastFailure = now - a.lastFailure;
                    if (timeSinceLastFailure > API_CONFIG.PRIORITY.switchBackDelay) {
                        log(`Giving Noire API another chance (${Math.round(timeSinceLastFailure/1000)}s since last failure)`, 'DataFetcher');
                        // Reset consecutive failures to give it a chance
                        a.consecutiveFailures = Math.max(0, a.consecutiveFailures - 1);
                        if (a.consecutiveFailures < API_CONFIG.PRIORITY.healthFailureThreshold) {
                            a.isHealthy = true;
                        }
                        return -1;
                    }
                }
                
                if (bIsNoire && !b.isHealthy) {
                    const timeSinceLastFailure = now - b.lastFailure;
                    if (timeSinceLastFailure > API_CONFIG.PRIORITY.switchBackDelay) {
                        log(`Giving Noire API another chance (${Math.round(timeSinceLastFailure/1000)}s since last failure)`, 'DataFetcher');
                        b.consecutiveFailures = Math.max(0, b.consecutiveFailures - 1);
                        if (b.consecutiveFailures < API_CONFIG.PRIORITY.healthFailureThreshold) {
                            b.isHealthy = true;
                        }
                        return 1;
                    }
                }
            }
            
            // General health-based priority
            if (a.isHealthy && !b.isHealthy) return -1;
            if (!a.isHealthy && b.isHealthy) return 1;
            
            // If both healthy, prefer faster response time
            if (a.isHealthy && b.isHealthy) {
                return a.responseTime - b.responseTime;
            }
            
            // If both unhealthy, prefer the one that failed less recently
            return b.lastSuccess - a.lastSuccess;
        });
    }

    updateApiHealth(endpoint, url, success, responseTime = 0) {
        const healthStatus = this.apiHealthStatus[endpoint];
        if (!healthStatus) return;
        
        const apiIndex = healthStatus.findIndex(api => api.url === url);
        if (apiIndex === -1) return;
        
        const api = healthStatus[apiIndex];
        const apiName = this.getApiName(url);
        
        if (success) {
            api.successCount++;
            api.lastSuccess = Date.now();
            api.responseTime = responseTime;
            api.consecutiveFailures = 0; // Reset consecutive failures on success
            
            // Mark as healthy if it was unhealthy
            if (!api.isHealthy) {
                api.isHealthy = true;
                log(`${apiName} API marked as healthy again for ${endpoint}`, 'DataFetcher');
                
                // If this is Noire API for mods, log the recovery
                if (endpoint === 'mods' && url.includes('noire.my.id')) {
                    log(`Noire API recovered for mods - switching back to primary`, 'DataFetcher');
                }
            }
        } else {
            api.failureCount++;
            api.consecutiveFailures++;
            api.lastFailure = Date.now();
            
            // Mark as unhealthy after consecutive failures
            if (api.consecutiveFailures >= API_CONFIG.PRIORITY.healthFailureThreshold && api.isHealthy) {
                api.isHealthy = false;
                log(`${apiName} API marked as unhealthy for ${endpoint} (${api.consecutiveFailures} consecutive failures)`, 'DataFetcher');
                
                // Special logging for Noire API for mods
                if (endpoint === 'mods' && url.includes('noire.my.id')) {
                    log(`Noire API unhealthy for mods - switching to backup (GTID)`, 'DataFetcher');
                }
            }
        }
    }

    // Helper method to get API name for logging
    getApiName(url) {
        if (url.includes('noire.my.id')) return 'Noire';
        if (url.includes('gtid.dev')) return 'GTID';
        return 'API';
    }

    // Helper method to check if this is the original primary API
    isOriginalPrimary(endpoint, url) {
        const endpointConfig = API_CONFIG.ENDPOINTS[endpoint];
        if (!Array.isArray(endpointConfig)) return false;
        return endpointConfig[0] === url;
    }

    // Enhanced comparison with better logic for different endpoints
    compareApiData(results, endpoint) {
        if (endpoint === 'banData') {
            log(`Comparing ${results.length} API results for ${endpoint}:`, 'DataFetcher');
            
            results.forEach((result, index) => {
                const apiName = this.getApiName(result.url);
                const timestamp = new Date(result.data.lastUpdated || result.timestamp);
                log(`  ${apiName}: ${result.data.online_user} players, ${result.data.ban_rate}% ban rate, updated: ${timestamp.toISOString()}`, 'DataFetcher');
            });

            // Prefer GTID if data is recent (within 2 minutes of most recent)
            const gtidResult = results.find(r => r.url.includes('gtid.dev'));
            const mostRecentTime = Math.max(...results.map(r => r.timestamp.getTime()));
            
            if (gtidResult && (mostRecentTime - gtidResult.timestamp.getTime()) < API_CONFIG.PRIORITY.gtidTimeThreshold) {
                log(`Using GTID API data for ban data (recent within 2 minutes)`, 'DataFetcher');
                return {
                    data: gtidResult.data,
                    source: 'GTID API'
                };
            }
            
            // Otherwise use most recent
            const mostRecent = results.reduce((latest, current) => 
                current.timestamp > latest.timestamp ? current : latest
            );
            
            const sourceName = this.getApiName(mostRecent.url) + ' API';
            log(`Using ${sourceName} data (most recent)`, 'DataFetcher');
            
            return {
                data: mostRecent.data,
                source: sourceName
            };
        }

        if (endpoint === 'mods') {
            log(`Comparing ${results.length} API results for mods:`, 'DataFetcher');
            
            results.forEach((result, index) => {
                const apiName = this.getApiName(result.url);
                const modsCount = result.data.mods ? result.data.mods.length : 0;
                log(`  ${apiName}: ${modsCount} mods data`, 'DataFetcher');
            });

            // Always prefer Noire if available and has data
            const noireResult = results.find(r => r.url.includes('noire.my.id'));
            if (noireResult && noireResult.data) {
                log(`Using Noire API data for mods (preferred primary)`, 'DataFetcher');
                return {
                    data: noireResult.data,
                    source: 'Noire API'
                };
            }
            
            // Fallback to first available result
            const sourceName = this.getApiName(results[0].url) + ' API';
            log(`Using ${sourceName} data for mods (fallback)`, 'DataFetcher');
            
            return {
                data: results[0].data,
                source: sourceName
            };
        }

        return {
            data: results[0].data,
            source: `API ${results[0].index + 1}`
        };
    }

    async performFetch(url, endpoint, options = {}, retries = API_CONFIG.RATE_LIMIT.maxRetries) {
        // Handle URL parameters
        if (options.params) {
            const urlObj = new URL(url);
            Object.keys(options.params).forEach(key => {
                urlObj.searchParams.append(key, options.params[key]);
            });
            url = urlObj.toString();
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Rate limit control
                while (this.activeRequests >= API_CONFIG.RATE_LIMIT.maxConcurrent) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                this.activeRequests++;

                const fetchOptions = {
                    agent: this.proxyAgent,
                    timeout: API_CONFIG.REQUEST_CONFIG.timeout,
                    headers: {
                        ...API_CONFIG.REQUEST_CONFIG.headers,
                        ...(options.headers || {})
                    },
                    method: options.method || 'GET'
                };

                const response = await fetch(url, fetchOptions);

                if (response.status === 401) {
                    throw new Error(`Unauthorized (401) - Check API key for ${endpoint}`);
                }

                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After') || 5;
                    throw new Error(`Rate limited - retry after ${retryAfter} seconds`);
                }

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'No error details');
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const contentType = response.headers.get('content-type');
                let data;
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    try {
                        data = JSON.parse(text);
                    } catch {
                        // For Growtopia official API, handle non-JSON response
                        if (endpoint === 'onlinePlayers') {
                            // Extract JSON from the response if it's partial
                            const jsonMatch = text.match(/\{[^}]*"online_user"[^}]*\}/);
                            if (jsonMatch) {
                                data = JSON.parse(jsonMatch[0]);
                            } else {
                                data = { raw: text };
                            }
                        } else {
                            data = { raw: text };
                        }
                    }
                }

                this.activeRequests--;
                return data;
                
            } catch (error) {
                this.activeRequests--;
                
                if (attempt === retries) {
                    throw error;
                }
                
                const delay = error.message.includes('Rate limited') ? 
                    parseInt(error.message.split(' ').pop()) * 1000 :
                    API_CONFIG.RATE_LIMIT.retryDelay;
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async getData(endpoint, options = {}) {
        const now = Date.now();
        const interval = endpoint === 'exchangeRate' ? 
            API_CONFIG.INTERVALS.slow : API_CONFIG.INTERVALS.fast;

        const forceRefresh = options.forceRefresh || false;

        if (forceRefresh || !this.cache[endpoint] || now - this.lastFetch[endpoint] > interval) {
            try {
                // Use prioritized fetching
                const data = await this.fetchWithPriority(endpoint, options);
                this.cache[endpoint] = data;
                this.lastFetch[endpoint] = Date.now();
                log(`Successfully updated ${endpoint} cache`, 'DataFetcher');
            } catch (error) {
                logError(error, `DataFetcher/getData/${endpoint}`);
                
                // Return cached data if available, even if stale
                if (this.cache[endpoint]) {
                    log(`Using cached data for ${endpoint} due to fetch error`, 'DataFetcher');
                    return this.cache[endpoint];
                }
                
                return null;
            }
        }
        return this.cache[endpoint];
    }

    async getAllData() {
        try {
            const results = {};
            for (const endpoint of Object.keys(API_CONFIG.ENDPOINTS)) {
                results[endpoint] = await this.getData(endpoint);
                // Small delay between requests to avoid overwhelming APIs
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            return results;
        } catch (error) {
            logError(error, 'DataFetcher/getAllData');
            return this.cache;
        }
    }

    // New method to get combined player data (online count from official + ban data from APIs)
    async getCombinedPlayerData() {
        try {
            log('Fetching combined player data...', 'DataFetcher');
            
            // Fetch both online players and ban data simultaneously
            const [onlinePlayersData, banDataResponse] = await Promise.allSettled([
                this.fetchWithPriority('onlinePlayers', { forceRefresh: true }),
                this.fetchWithPriority('banData', { forceRefresh: true })
            ]);

            let playerCount = 0;
            let banRate = 0;
            let lastUpdated = new Date().toISOString();

            // Process online players data from official Growtopia API
            if (onlinePlayersData.status === 'fulfilled' && onlinePlayersData.value) {
                const onlineData = onlinePlayersData.value;
                playerCount = parseInt(onlineData.online_user) || 0;
                log(`Official GT API: ${playerCount} players online`, 'DataFetcher');
            } else {
                log('Failed to get online player count from official API', 'DataFetcher');
            }

            // Process ban data from GTID/Noire APIs
            if (banDataResponse.status === 'fulfilled' && banDataResponse.value) {
                const banData = banDataResponse.value;
                banRate = parseFloat(banData.ban_rate) || 0;
                lastUpdated = banData.lastUpdated || lastUpdated;
                log(`Ban data API: ${banRate}% ban rate, updated: ${lastUpdated}`, 'DataFetcher');
            } else {
                log('Failed to get ban data from APIs', 'DataFetcher');
            }

            // Combine the data
            const combinedData = {
                online_user: playerCount,
                ban_rate: banRate,
                lastUpdated: lastUpdated,
                sources: {
                    playerCount: 'Official Growtopia API',
                    banRate: banDataResponse.status === 'fulfilled' ? 'Ban Data API' : 'Not Available'
                }
            };

            log(`Combined data: ${playerCount} players, ${banRate}% ban rate`, 'DataFetcher');
            return combinedData;

        } catch (error) {
            logError(error, 'DataFetcher/getCombinedPlayerData');
            
            // Fallback to cached data
            const cachedOnline = this.cache['onlinePlayers'];
            const cachedBan = this.cache['banData'];
            
            return {
                online_user: cachedOnline ? parseInt(cachedOnline.online_user) || 0 : 0,
                ban_rate: cachedBan ? parseFloat(cachedBan.ban_rate) || 0 : 0,
                lastUpdated: new Date().toISOString(),
                sources: {
                    playerCount: 'Cached Data',
                    banRate: 'Cached Data'
                }
            };
        }
    }

    // Legacy method for backward compatibility
    async getRealTimePlayerData() {
        return this.getCombinedPlayerData();
    }

    getApiHealthStatus() {
        return this.apiHealthStatus;
    }

    // New method to get API health summary
    getApiHealthSummary() {
        const summary = {};
        Object.keys(this.apiHealthStatus).forEach(endpoint => {
            const healthStatus = this.apiHealthStatus[endpoint];
            summary[endpoint] = healthStatus.map(api => ({
                name: this.getApiName(api.url),
                url: api.url,
                isHealthy: api.isHealthy,
                successCount: api.successCount,
                failureCount: api.failureCount,
                consecutiveFailures: api.consecutiveFailures,
                responseTime: api.responseTime,
                lastSuccess: api.lastSuccess ? new Date(api.lastSuccess).toISOString() : null,
                lastFailure: api.lastFailure ? new Date(api.lastFailure).toISOString() : null
            }));
        });
        return summary;
    }

    clearCache(endpoint) {
        if (endpoint) {
            this.cache[endpoint] = null;
            this.lastFetch[endpoint] = 0;
        } else {
            Object.keys(this.cache).forEach(key => {
                this.cache[key] = null;
                this.lastFetch[key] = 0;
            });
        }
    }

    getCacheStatus() {
        const status = {};
        Object.keys(this.cache).forEach(endpoint => {
            const endpointConfig = API_CONFIG.ENDPOINTS[endpoint];
            const urls = Array.isArray(endpointConfig) ? endpointConfig : [endpointConfig];
            
            status[endpoint] = {
                hasData: !!this.cache[endpoint],
                lastFetch: this.lastFetch[endpoint],
                age: Date.now() - this.lastFetch[endpoint],
                totalApis: urls.length,
                urls: urls,
                healthStatus: this.apiHealthStatus[endpoint] || null
            };
        });
        return status;
    }
}

let instance;

export async function getDataFetcher() {
    if (!instance) {
        instance = new DataFetcher();
        log('DataFetcher initialized with Noire as primary for mods and GTID as primary for ban data', 'DataFetcher');
    }
    return instance;
}