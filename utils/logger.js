const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    
    // Foreground colors
    fgBlack: '\x1b[30m',
    fgRed: '\x1b[31m',
    fgGreen: '\x1b[32m',
    fgYellow: '\x1b[33m',
    fgBlue: '\x1b[34m',
    fgMagenta: '\x1b[35m',
    fgCyan: '\x1b[36m',
    fgWhite: '\x1b[37m',
    
    // Background colors
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m'
};

const SERVICE_COLORS = {
    DataFetcher: COLORS.fgCyan,
    DataService: COLORS.fgMagenta,
    LockMonitor: COLORS.fgBlue,
    ModsMonitor: COLORS.fgGreen,
    OnlineMonitor: COLORS.fgYellow,
    System: COLORS.fgWhite
};

export function log(message, source = 'System') {
    const timestamp = new Date().toISOString();
    const color = SERVICE_COLORS[source] || COLORS.fgWhite;
    console.log(`${COLORS.fgYellow}[${timestamp}] ${color}[${source}]${COLORS.reset} ${message}`);
}

export function logError(error, context = '') {
    const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
    const [source, ...rest] = context.split('/');
    const color = SERVICE_COLORS[source] || COLORS.fgWhite;
    const fullContext = rest.length ? ` (${rest.join('/')})` : '';
    
    console.error(
        `${COLORS.fgYellow}[${new Date().toISOString()}] ` +
        `${color}[${source}]${COLORS.fgRed} ERROR${fullContext}: ` +
        `${errorMessage}${COLORS.reset}`
    );
}

export function logStartup(service, status, message = '') {
    const color = status === 'Success' ? COLORS.fgGreen : COLORS.fgRed;
    console.log(`${service.padEnd(15)} = ${color}${status}${COLORS.reset} ${message}`);
}

export function formatNumber(num) {
    try {
        num = Math.floor(Number(num));
        if (isNaN(num)) return "0";
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } catch (error) {
        logError(error, 'Logger/formatNumber');
        return "0";
    }
}

export function getTimestamp() {
    return `[<t:${Math.floor(Date.now() / 1000)}:f>]`;
}

export function formatCurrency(value, currency = 'USD') {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    } catch (error) {
        logError(error, 'Logger/formatCurrency');
        return value.toString();
    }
}