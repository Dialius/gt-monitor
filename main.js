import { startOnlineMonitoring } from './services/online-monitor.js';
import { startModsMonitoring } from './services/mods-monitor.js';
import { startLockMonitoring } from './services/lock-monitor.js';
import { log, logError, logStartup } from './utils/logger.js';

async function startServices() {
    try {
        log('Starting all monitoring services...', 'System');
        
        const services = [];
        const results = [];
        
        // Start services with error handling
        try {
            const onlineService = await startOnlineMonitoring();
            services.push(onlineService);
            results.push({ name: 'Online', status: 'Success' });
            log('Online monitoring started successfully', 'System');
        } catch (error) {
            results.push({ name: 'Online', status: 'Failed', error });
            logError(error, 'System/startOnline');
        }

        try {
            const modsService = await startModsMonitoring();
            services.push(modsService);
            results.push({ name: 'Mods', status: 'Success' });
            log('Mods monitoring started successfully', 'System');
        } catch (error) {
            results.push({ name: 'Mods', status: 'Failed', error });
            logError(error, 'System/startMods');
        }

        try {
            const lockService = await startLockMonitoring();
            services.push(lockService);
            results.push({ name: 'Lock', status: 'Success' });
            log('Lock monitoring started successfully', 'System');
        } catch (error) {
            results.push({ name: 'Lock', status: 'Failed', error });
            logError(error, 'System/startLock');
        }

        // Display startup results
        console.log('\n' + '='.repeat(50));
        results.forEach(({ name, status, error }) => {
            logStartup(name, status, error ? `- ${error.message}` : '');
        });
        console.log('='.repeat(50) + '\n');

        // Handle shutdown
        const shutdown = async (signal) => {
            log(`Received ${signal}, shutting down...`, 'System');
            try {
                await Promise.all(services.map(service => {
                    if (service && typeof service.stop === 'function') {
                        return service.stop();
                    }
                    return Promise.resolve();
                }));
                log('All services stopped', 'System');
                process.exit(0);
            } catch (error) {
                logError(error, 'System/shutdown');
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
    } catch (error) {
        logError(error, 'System/startServices');
        process.exit(1);
    }
}

// Global error handlers
process.on('uncaughtException', (err) => {
    logError(err, 'System/uncaughtException');
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logError(err, 'System/unhandledRejection');
});

// Start the application
startServices().catch(err => {
    logError(err, 'System/main');
    process.exit(1);
});