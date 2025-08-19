export const LOCK_CONFIG = {
    DEFAULT_EMOJI_NAMES: {
        DL: 'diamondlock',
        BGL: 'bluelock',
        CLOCK: 'clock'
    },
    BOT_TOKEN: 'MTM3MTExMTUzNTIzMzA3NzI4OA.GiNbK_.EMFiAOR6DfxMDbY1yojAui6kcb9l6q69Zw08uk',
    BOT_STATUS: [
        { type: 'WATCHING', text: 'LOCK PRICE' },
        { type: 'CUSTOM', text: 'DL : Rp {dlPriceRp} | ${dlPriceUsd} | €{dlPriceEur}' },
        { type: 'CUSTOM', text: 'BGL : Rp {bglPriceRp} | ${bglPriceUsd} | €{bglPriceEur}' },
        { type: 'COMPETING', text: '{serverCount} Servers' }
    ],
    STATUS_ROTATION_INTERVAL: 60 * 1000,
    MESSAGE_RECOVERY_LIMIT: 20
};

export const LOCK_SERVERS = {
    '1325103587956883506': {
        CHANNEL_ID: '1371116350579409037',
        LOG_CHANNEL_ID: '1371170973117579364',
        EMOJIS: {
            DL: '1355786550868447358',
            BGL: '1355738086532714577',
            CLOCK: '1362606242710687806'
        },
        FOOTER: {
            text: 'Made by VinTheGreat • FALLEN STAR',
            iconURL: 'https://cdn.discordapp.com/attachments/1333890180704108554/1356882106290278443/The_Fallen_Angel.png'
        },
        SHOW_BGL: true
    },
    '1197831746427834428': {
        CHANNEL_ID: '1371115652089385041',
        LOG_CHANNEL_ID: null,
        EMOJIS: {
            DL: '1371171977548664852',
            BGL: '1353117666864402614',
            CLOCK: '1362607227608895508'
        },
        FOOTER: {
            text: 'Made by VinTheGreat • BVAA COMMUNITY',
            iconURL: 'https://cdn.discordapp.com/attachments/1333890180704108554/1356882106290278443/The_Fallen_Angel.png'
        },
        SHOW_BGL: true
    }
};