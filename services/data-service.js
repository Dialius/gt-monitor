import { DATA_CONFIG } from '../config/data-config.js';
import { log, logError } from '../utils/logger.js';
import { getDataFetcher } from './data-fetcher.js';

class DataService {
    constructor(config = DATA_CONFIG) {
        this.config = config;
        this.currentDlPrice = {
            rp: '0',
            usd: '0.00',
            eur: '0.00'
        };
        this.exchangeRates = { ...this.config.DEFAULT_RATES };
        this.subscribers = new Set();
        this.initialized = false;
    }

    async start() {
        if (this.initialized) return;
        
        try {
            await this.updateAllData();
            this.setupIntervals();
            this.initialized = true;
            log('Service started successfully', 'DataService');
        } catch (error) {
            logError(error, 'DataService/start');
            throw error;
        }
    }

    async updateAllData() {
        try {
            await Promise.all([
                this.updateExchangeRates(),
                this.updateDlPrice()
            ]);
        } catch (error) {
            logError(error, 'DataService/updateAllData');
            throw error;
        }
    }

    setupIntervals() {
        this.intervals = {
            exchangeRate: setInterval(
                () => this.updateExchangeRates(),
                this.config.UPDATE_INTERVALS.exchangeRate
            ),
            diamondLock: setInterval(
                () => this.updateDlPrice(),
                this.config.UPDATE_INTERVALS.diamondLock
            )
        };
    }

    async updateExchangeRates() {
        try {
            const fetcher = await getDataFetcher();
            
            // Build currency API URL with proper parameters
            const currencyUrl = `https://api.freecurrencyapi.com/v1/latest?apikey=${this.config.CURRENCY_API.API_KEY}&base_currency=${this.config.CURRENCY_API.BASE_CURRENCY}&currencies=${this.config.CURRENCY_API.TARGET_CURRENCIES.join(',')}`;
            
            log(`Fetching exchange rates from: ${currencyUrl.replace(this.config.CURRENCY_API.API_KEY, 'HIDDEN')}`, 'DataService');
            
            const data = await fetcher.getData('exchangeRate', {
                url: currencyUrl,
                forceRefresh: false
            });

            if (data?.data) {
                this.exchangeRates = {
                    IDR: data.data.IDR || this.config.DEFAULT_RATES.IDR,
                    EUR: data.data.EUR || this.config.DEFAULT_RATES.EUR
                };
                log(`Exchange rates updated: 1 USD = ${this.exchangeRates.IDR} IDR, 1 USD = ${this.exchangeRates.EUR} EUR`, 'DataService');
                this.notifySubscribers();
            } else if (data) {
                log(`Currency API response format: ${JSON.stringify(data, null, 2)}`, 'DataService');
                logError('Currency API returned data but not in expected format', 'DataService/updateExchangeRates');
            }
        } catch (error) {
            logError(error, 'DataService/updateExchangeRates');
            // Use default rates if API fails
            log('Using default exchange rates due to API error', 'DataService');
        }
    }

    async updateDlPrice() {
        try {
            const fetcher = await getDataFetcher();
            const data = await fetcher.getData('diamondLock');
            
            if (data?.prices) {
                const idrValue = parseInt(data.prices.replace(/,/g, '')) || 0;
                const usdValue = idrValue / this.exchangeRates.IDR;
                const eurValue = usdValue * this.exchangeRates.EUR;

                const newPrice = {
                    rp: this.formatNumber(idrValue),
                    usd: usdValue.toFixed(3),
                    eur: eurValue.toFixed(3)
                };

                if (this.currentDlPrice.rp !== newPrice.rp) {
                    this.currentDlPrice = newPrice;
                    log(`DL price updated: Rp ${this.currentDlPrice.rp}`, 'DataService');
                    this.notifySubscribers();
                }
            }
        } catch (error) {
            logError(error, 'DataService/updateDlPrice');
        }
    }

    notifySubscribers() {
        const currentData = this.getCurrentData();
        for (const callback of this.subscribers) {
            try {
                callback(currentData);
            } catch (error) {
                logError(error, 'DataService/notifySubscribers');
            }
        }
    }

    getCurrentData() {
        return {
            dlPrice: this.currentDlPrice,
            exchangeRates: this.exchangeRates
        };
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    stop() {
        if (this.intervals) {
            clearInterval(this.intervals.exchangeRate);
            clearInterval(this.intervals.diamondLock);
        }
        this.subscribers.clear();
        this.initialized = false;
        log('Service stopped', 'DataService');
    }

    formatNumber(num) {
        num = Math.floor(Number(num));
        if (isNaN(num)) return "0";
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
}

let instance;

export async function getDataService(config) {
    if (!instance) {
        instance = new DataService(config);
        await instance.start();
    }
    return instance;
}