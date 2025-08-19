import { Client, EmbedBuilder, GatewayIntentBits } from 'discord.js';
import { LOCK_SERVERS, LOCK_CONFIG } from '../config/lock-config.js';
import { log, logError } from '../utils/logger.js';
import { getDataService } from './data-service.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// State variables
let lastPrices = {};
let currentStatusIndex = 0;
let statusInterval;
let unsubscribeFromDataService;

const ACTIVITY_TYPES = {
    PLAYING: 0,
    STREAMING: 1,
    LISTENING: 2,
    WATCHING: 3,
    CUSTOM: 4,
    COMPETING: 5
};

function getEmoji(serverId, type) {
    const conf = LOCK_SERVERS[serverId];
    const emojiId = conf?.EMOJIS?.[type] || LOCK_CONFIG.DEFAULT_EMOJI_NAMES[type];
    
    if (/^\d+$/.test(emojiId)) {
        return `<a:${LOCK_CONFIG.DEFAULT_EMOJI_NAMES[type]}:${emojiId}>`;
    }
    
    return {
        DL: '💎',
        BGL: '🔵',
        CLOCK: '⏱️'
    }[type] || '';
}

async function recoverLastMessage(channel) {
    try {
        const messages = await channel.messages.fetch({ 
            limit: LOCK_CONFIG.MESSAGE_RECOVERY_LIMIT 
        });
        
        return messages.find(m => 
            m.author.id === client.user.id && 
            m.embeds.length > 0 &&
            (m.embeds[0].title?.includes("LOCK PRICE") || 
             m.embeds[0].title?.includes("LOCK PRICE UPDATED"))
        );
    } catch (e) {
        logError(e, `LockMonitor/recoverMessage/${channel.id}`);
        return null;
    }
}

async function initializeServer(serverId) {
    try {
        const config = LOCK_SERVERS[serverId];
        if (!config) return;

        const channel = await client.channels.fetch(config.CHANNEL_ID);
        if (!channel) {
            logError(`Channel not found for server ${serverId}`, 'LockMonitor/init');
            return;
        }

        // Check permissions
        const permissions = channel.permissionsFor(client.user);
        if (!permissions.has('SendMessages') || !permissions.has('EmbedLinks')) {
            logError(`Missing permissions in channel ${config.CHANNEL_ID}`, 'LockMonitor/init');
            return;
        }

        // Attempt to recover last message
        const lastMsg = await recoverLastMessage(channel);
        if (lastMsg) {
            LOCK_SERVERS[serverId].messageId = lastMsg.id;
            log(`Recovered message ${lastMsg.id} in server ${serverId}`, 'LockMonitor');
        } else {
            log(`No existing message found in server ${serverId}`, 'LockMonitor');
        }
    } catch (error) {
        logError(error, `LockMonitor/init/${serverId}`);
    }
}

function buildMainEmbed(serverId, prices) {
    const conf = LOCK_SERVERS[serverId];
    const dlEmoji = getEmoji(serverId, 'DL');
    const bglEmoji = getEmoji(serverId, 'BGL');
    const clockEmoji = getEmoji(serverId, 'CLOCK');

    return new EmbedBuilder()
        .setTitle("LOCK PRICE TRACKER")
        .setDescription([
            `\n${dlEmoji} **Diamond Lock Price** ${dlEmoji}`,
            `\`\`\`Rp ${prices.dl.rp} | $${prices.dl.usd} | €${prices.dl.eur}\`\`\``,
            conf.SHOW_BGL ? [
                `\n${bglEmoji} **Blue Gem Lock Price** ${bglEmoji}`,
                `\`\`\`Rp ${prices.bgl.rp} | $${prices.bgl.usd} | €${prices.bgl.eur}\`\`\``
            ].join('\n') : '',
            `\n\n${clockEmoji} **Last Updated:** <t:${Math.floor(Date.now()/1000)}:R>`
        ].join('\n'))
        .setColor(0x5865F2)
        .setFooter(conf.FOOTER);
}

function buildLogEmbed(serverId, newPrices) {
    const conf = LOCK_SERVERS[serverId];
    const dlEmoji = getEmoji(serverId, 'DL');
    const bglEmoji = getEmoji(serverId, 'BGL');
    const clockEmoji = getEmoji(serverId, 'CLOCK');

    return new EmbedBuilder()
        .setTitle("LOCK PRICE UPDATED")
        .setDescription([
            `\n${dlEmoji} **Diamond Lock Price** ${dlEmoji}`,
            `\`\`\`Rp ${newPrices.dl.rp} | $${newPrices.dl.usd} | €${newPrices.dl.eur}\`\`\``,
            conf.SHOW_BGL ? [
                `\n${bglEmoji} **Blue Gem Lock Price** ${bglEmoji}`,
                `\`\`\`Rp ${newPrices.bgl.rp} | $${newPrices.bgl.usd} | €${newPrices.bgl.eur}\`\`\``
            ].join('\n') : '',
            `\n\n${clockEmoji} **Updated:** <t:${Math.floor(Date.now()/1000)}:R>`
        ].join('\n'))
        .setColor(0xFFA500)
        .setFooter(conf.FOOTER);
}

async function updateBotPresence() {
    try {
        if (!LOCK_CONFIG.BOT_STATUS?.length) return;

        const status = LOCK_CONFIG.BOT_STATUS[currentStatusIndex];
        let text = status.text;

        // Replace placeholders with actual values
        if (Object.keys(lastPrices).length > 0) {
            const firstServerPrices = lastPrices[Object.keys(lastPrices)[0]];
            if (firstServerPrices) {
                text = text
                    .replace('{dlPriceRp}', firstServerPrices.dl.rp)
                    .replace('{dlPriceUsd}', firstServerPrices.dl.usd)
                    .replace('{dlPriceEur}', firstServerPrices.dl.eur)
                    .replace('{bglPriceRp}', firstServerPrices.bgl.rp)
                    .replace('{bglPriceUsd}', firstServerPrices.bgl.usd)
                    .replace('{bglPriceEur}', firstServerPrices.bgl.eur);
            }
        }
        
        text = text.replace('{serverCount}', Object.keys(LOCK_SERVERS).length);

        await client.user.setPresence({
            activities: [{ 
                name: text, 
                type: status.type === 'CUSTOM' ? 4 : ACTIVITY_TYPES[status.type] 
            }],
            status: 'online'
        });

        currentStatusIndex = (currentStatusIndex + 1) % LOCK_CONFIG.BOT_STATUS.length;
    } catch (e) {
        logError(e, 'LockMonitor/updatePresence');
    }
}

async function updateLockPrices(dlPrice) {
    const newPrices = {
        dl: dlPrice,
        bgl: {
            rp: formatNumber(parseInt(dlPrice.rp.replace(/,/g, '')) * 100),
            usd: (parseFloat(dlPrice.usd) * 100).toFixed(2),
            eur: (parseFloat(dlPrice.eur) * 100).toFixed(2)
        }
    };

    for (const [serverId, config] of Object.entries(LOCK_SERVERS)) {
        try {
            const channel = await client.channels.fetch(config.CHANNEL_ID);
            if (!channel) {
                logError(`Channel not found for server ${serverId}`, 'LockMonitor/update');
                continue;
            }

            // Check permissions
            const permissions = channel.permissionsFor(client.user);
            if (!permissions.has('SendMessages') || !permissions.has('EmbedLinks')) {
                logError(`Missing permissions in channel ${config.CHANNEL_ID}`, 'LockMonitor/update');
                continue;
            }

            const embed = buildMainEmbed(serverId, newPrices);
            
            // Try to edit existing message first
            let messageUpdated = false;
            if (config.messageId) {
                try {
                    const message = await channel.messages.fetch(config.messageId);
                    await message.edit({ embeds: [embed] });
                    messageUpdated = true;
                } catch (error) {
                    log(`Message ${config.messageId} not found, creating new one`, 'LockMonitor');
                    delete LOCK_SERVERS[serverId].messageId;
                }
            }

            // Create new message if edit failed or doesn't exist
            if (!messageUpdated) {
                try {
                    const msg = await channel.send({ embeds: [embed] });
                    LOCK_SERVERS[serverId].messageId = msg.id;
                } catch (error) {
                    logError(error, `LockMonitor/createMessage/${serverId}`);
                    continue;
                }
            }

            // Send log if price changed and log channel exists
            if (lastPrices[serverId]?.dl?.rp !== newPrices.dl.rp && config.LOG_CHANNEL_ID) {
                try {
                    const logChannel = await client.channels.fetch(config.LOG_CHANNEL_ID);
                    if (logChannel) {
                        const logEmbed = buildLogEmbed(serverId, newPrices);
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (error) {
                    logError(error, `LockMonitor/logUpdate/${serverId}`);
                }
            }

            lastPrices[serverId] = newPrices;
        } catch (error) {
            logError(error, `LockMonitor/update/${serverId}`);
        }
    }
}

export async function startLockMonitoring() {
    const dataService = await getDataService();
    const { dlPrice } = dataService.getCurrentData();
    
    // Subscribe to data updates
    unsubscribeFromDataService = dataService.subscribe(({ dlPrice }) => {
        updateLockPrices(dlPrice);
    });

    client.on('ready', async () => {
        log('Lock monitor started', 'LockMonitor');
        
        // Initialize all servers with message recovery
        await Promise.all(
            Object.keys(LOCK_SERVERS).map(serverId => initializeServer(serverId))
        );

        // Initial update
        await updateLockPrices(dlPrice);

        // Start status rotation
        updateBotPresence();
        statusInterval = setInterval(updateBotPresence, LOCK_CONFIG.STATUS_ROTATION_INTERVAL);
    });

    client.login(LOCK_CONFIG.BOT_TOKEN).catch(err => {
        logError(err, 'LockMonitor/login');
    });

    return {
        stop: () => {
            if (unsubscribeFromDataService) unsubscribeFromDataService();
            client.destroy();
            clearInterval(statusInterval);
            log('Lock monitoring stopped', 'LockMonitor');
        }
    };
}

function formatNumber(num) {
    num = Math.floor(Number(num));
    if (isNaN(num)) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}