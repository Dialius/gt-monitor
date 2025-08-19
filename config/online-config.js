export const ONLINE_CONFIG = {
    useProxy: false,
    proxySettings: {
        host: '37.218.219.66',
        port: 5432,
        username: 'puhfg',
        password: 'auorqv7k'
    },
    maintenanceThreshold: 100,
    maintenanceGif: "https://tenor.com/bjjFq.gif",
    checkInterval: 1, // in minutes
    bwlimit: 1500, // Minimum player drop to trigger regular banwave
    
    SERVER_CONFIGS: {
        '1325103587956883506': {
            SHOW_BANRATE: true,
            MIN_BANRATE_PING: 0.50,
            BANWAVE_ROLE_ID: '1326856929489850399',
            MAINTENANCE_ROLE_ID: '1360872991965057238',
            BANRATE_ROLE_ID: '1326856929489850399',
            WEBHOOKS: {
                normal: "https://discord.com/api/webhooks/1360606530101051635/q2Fa1bb5koQT-cxGCwmg5JZyKTfSIBqr0PJH2C46Qc4Mw2GDpVUr8JH6uIb00-pishvL",
                banwave: "https://discord.com/api/webhooks/1354148270129283215/aPRslGRgkCWRYFu_d4v3O24cCKDKOuH3pVX3a_IPSyxnCH3H43yN4BFol6rVNrFMUJQV",
                banrate: "https://discord.com/api/webhooks/1370430775757111346/oFowv-pWLPr6jwXOSu9PWhGS-Pzr0xffAhvf-R2c7ABDPoEiWx5m4sTeZYg2S3Chx2Uy"
            }
        },
        '1197831746427834428': {
            SHOW_BANRATE: true,
            MIN_BANRATE_PING: 0.50,
            BANWAVE_ROLE_ID: '1370694106015076403',
            MAINTENANCE_ROLE_ID: '1370694213511020594',
            BANRATE_ROLE_ID: '1370693967070498847',
            WEBHOOKS: {
                normal: "https://discord.com/api/webhooks/1370693344866472018/AyXnWiymHai5likzxNXxZnS3Aalg5TJFQYyLVKOZSUVEwSEj9gtI3KiLgLpiKNjrHBxY",
                banwave: "https://discord.com/api/webhooks/1370693656918364260/BPZiTQGe1hg3SA9fXN_UVqDjV5RR-pESLM2sP91jhnVYMtTHZ15I36WT-pG8b2Ji3AHW",
                banrate: "https://discord.com/api/webhooks/1370693510650531892/Pfi0sKkIpES-hPbJxkPxf3gpioVtLL6ogOzGOg_iJyCyi3Cn2FAbjFMB64g_WVLCxiNG"
            }
        }
    }
};