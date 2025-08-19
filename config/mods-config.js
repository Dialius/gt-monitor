export const BOT_CONFIG = {
    DISCORD_TOKEN: 'your_actual_token_here',
    CHECK_INTERVAL: 30 * 1000,
    STATUS_ROTATION_INTERVAL: 30 * 1000,

    DEFAULT_EMOJI_NAMES: {
        online: 'online',
        offline: 'offline',
        clock: 'clock',
        player: 'signal',
        undercover: 'online'
    },

    BOT_STATUS: [
        { type: 'STREAMING', text: 'DL: Rp {dlPriceRp} | $${dlPriceUsd} | €{dlPriceEur}' },
        { type: 'WATCHING', text: '{modCount} Moderators' },
        { type: 'COMPETING', text: '{serverCount} Servers' },
        { type: 'LISTENING', text: '{playerCount} Players' },
        { type: 'PLAYING', text: 'Hide and Seek with Mods' }
    ]
};

export const SERVER_CONFIGS = {
    '1325103587956883506': {
        CHANNEL_ID: '1330858426053693532',
        LOG_CHANNEL_ID: '1361597848264904866',
        EMOJIS: {
            online: '1355886466080964769',
            offline: '1355886444123656265',
            clock: '1362606242710687806',
            player: '1360987680942456982'
        },
        FOOTER: {
            text: 'Made by VinTheGreat • FALLEN STAR',
            iconURL: 'https://cdn.discordapp.com/attachments/1333890180704108554/1376042134842511421/White_angel2.jpg?ex=6833e29a&is=6832911a&hm=3d06441d0e45d8cbbcd5af3b8b6e8b39af1450d42c20101cbc1bb6ee0ca5747f&'
        },
        MOD_ROLE_ID: '1362011202628227162',
        SHOW_DL_PRICE: true
    },
    '1197831746427834428': {
        CHANNEL_ID: '1355766171143770254',
        LOG_CHANNEL_ID: '1361633926598103050',
        EMOJIS: {
            online: '1353724086802710530',
            offline: '1361665460118098091',
            clock: '1362607227608895508',
            player: '1361636369704816802'
        },
        FOOTER: {
            text: 'Made by VinTheGreat • BVAA COMMUNITY',
            iconURL: 'https://cdn.discordapp.com/attachments/1333890180704108554/1376042134842511421/White_angel2.jpg?ex=6833e29a&is=6832911a&hm=3d06441d0e45d8cbbcd5af3b8b6e8b39af1450d42c20101cbc1bb6ee0ca5747f&'
        },
        MOD_ROLE_ID: null,
        SHOW_DL_PRICE: true
    },
    '1033538885751423086': {
        CHANNEL_ID: '1371004987152535623',
        LOG_CHANNEL_ID: null,
        EMOJIS: {
            online: '1368857223941324854',
            offline: '1368856302083641345',
            clock: '1270349754798309386',
            player: '1369348484167368857'
        },
        FOOTER: {
            text: 'Made by VinTheGreat • King Grows Cid',
            iconURL: 'https://cdn.discordapp.com/attachments/1333890180704108554/1376042134842511421/White_angel2.jpg?ex=6833e29a&is=6832911a&hm=3d06441d0e45d8cbbcd5af3b8b6e8b39af1450d42c20101cbc1bb6ee0ca5747f&'
        },
        MOD_ROLE_ID: null,
        SHOW_DL_PRICE: true
    }
};