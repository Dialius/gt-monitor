import { 
    Client, 
    EmbedBuilder, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle
} from 'discord.js';
import { SERVER_CONFIGS as serverConfigs, BOT_CONFIG as config } from '../config/mods-config.js';
import { log, logError, formatNumber } from '../utils/logger.js';
import { getDataService } from './data-service.js';
import { getDataFetcher } from './data-fetcher.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildEmojisAndStickers
    ],
    rest: {
        timeout: 15000,
        retries: 3
    }
});

const serverData = {};
let currentStatusIndex = 0;
let statusInterval;
let messageUpdateInterval;
let unsubscribeFromDataService;

const ACTIVITY_TYPES = {
    PLAYING: 0,
    STREAMING: 1,
    LISTENING: 2,
    WATCHING: 3,
    CUSTOM: 4,
    COMPETING: 5
};

// Function untuk mendapatkan emoji berdasarkan tipe
function getEmoji(serverId, type) {
    const conf = serverConfigs[serverId];
    const emojiId = conf?.EMOJIS?.[type] || config.DEFAULT_EMOJI_NAMES[type];
    
    if (emojiId && /^\d+$/.test(emojiId)) {
        // Check jika emoji harus animated
        const animated = ['online', 'offline', 'player', 'clock', 'undercover'].includes(type);
        const emojiName = config.DEFAULT_EMOJI_NAMES[type] || type;
        return `<${animated ? 'a' : ''}:${emojiName}:${emojiId}>`;
    }
    
    // Fallback ke Unicode emojis
    const fallbackEmojis = { 
        online: '🟢', 
        offline: '🔴', 
        clock: '⏱️', 
        player: '👥',
        undercover: '🟡'
    };
    
    return fallbackEmojis[type] || '';
}

// Function untuk mendapatkan emoji berdasarkan status mod
function getModStatusEmoji(serverId, status) {
    if (!status) return getEmoji(serverId, 'offline');
    
    const normalizedStatus = status.toLowerCase();
    
    if (normalizedStatus === 'online') {
        return getEmoji(serverId, 'online');
    } else if (normalizedStatus === 'undercover') {
        return getEmoji(serverId, 'online');
    } else {
        return getEmoji(serverId, 'offline');
    }
}

// Function untuk recover pesan terakhir bot
async function recoverLastMessage(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 20 });
        const lastBotMsg = messages.find(m => 
            m.author.id === client.user.id && 
            m.embeds.length > 0
        );
        return lastBotMsg || null;
    } catch (e) {
        logError(e, 'ModsMonitor/recoverMessage');
        return null;
    }
}

// Function untuk membuat embed utama
function buildMainEmbed(serverId, data, dlPrice) {
    const conf = serverConfigs[serverId];
    
    const embed = new EmbedBuilder()
        .setTitle(`${getEmoji(serverId, 'player')} ${formatNumber(data.playerCount)} Players Online`)
        .setColor(0x2F3136);

    // Deskripsi mods dengan emoji yang tepat
    const modsDescription = data.mods.length > 0
        ? data.mods.map(mod => {
            const statusEmoji = getModStatusEmoji(serverId, mod.status);
            return `${statusEmoji} ${mod.name} (${mod.status})`;
        }).join('\n')
        : `${getEmoji(serverId, 'offline')} No mods online.`;

    embed.addFields({
        name: '\u200B**Mods/Guardian currently online**',
        value: modsDescription
    });

    // Tambahkan DL price jika diaktifkan
    if (conf.SHOW_DL_PRICE) {
        embed.addFields({
            name: '\u200b**Diamond Lock Price**',
            value: `\`\`\`Rp ${dlPrice.rp} | $${dlPrice.usd} | €${dlPrice.eur}\`\`\``
        });
    }

    // Tambahkan timestamp
    embed.addFields({
        name: '\u200B',
        value: `${getEmoji(serverId, 'clock')} **Last Updated:** <t:${Math.floor(Date.now()/1000)}:R>`
    })
    .setFooter({ 
        text: conf.FOOTER.text,
        iconURL: conf.FOOTER.iconURL
    });

    return embed;
}

// Function utama untuk update status
async function updateStatus(serverId, isRecovery = false) {
    try {
        const conf = serverConfigs[serverId];
        if (!conf) return;

        const channel = await client.channels.fetch(conf.CHANNEL_ID);
        if (!channel) {
            logError(`Channel not found for server ${serverId}`, 'ModsMonitor/updateStatus');
            return;
        }

        // Recovery pesan jika diperlukan
        if ((isRecovery || !serverData[serverId]?.statusMessage) && conf.CHANNEL_ID) {
            const recoveredMsg = await recoverLastMessage(channel);
            if (recoveredMsg) {
                serverData[serverId].statusMessage = recoveredMsg;
                log(`Recovered message ${recoveredMsg.id} in ${channel.name}`, 'ModsMonitor');
            }
        }

        // Ambil data dari fetcher
        const fetcher = await getDataFetcher();
        const [playersData, modsData] = await Promise.all([
            fetcher.getData('onlinePlayers'),
            fetcher.getData('mods')
        ]);

        // Proses data
        const data = {
            playerCount: playersData?.online_user || 0,
            mods: modsData?.mods || [],
            timestamp: Date.now()
        };

        // Initialize server data jika belum ada
        if (!serverData[serverId]) {
            serverData[serverId] = { 
                lastMods: [],
                dailyMods: []
            };
        }
        
        serverData[serverId].lastData = data;

        // Ambil DL price
        const dataService = await getDataService();
        const { dlPrice } = dataService.getCurrentData();

        // Build embed dan button
        const embed = buildMainEmbed(serverId, data, dlPrice);
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`show_daily_mods_${serverId}`)
                    .setLabel('Mods Seen Today?')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Update atau buat pesan baru
        let messageUpdated = false;
        if (serverData[serverId].statusMessage) {
            try {
                await serverData[serverId].statusMessage.edit({ 
                    embeds: [embed],
                    components: [row] 
                });
                messageUpdated = true;
                log(`Updated message in ${channel.name}`, 'ModsMonitor');
            } catch (e) {
                log(`Message missing, creating new one: ${e.message}`, 'ModsMonitor');
            }
        }

        if (!messageUpdated) {
            serverData[serverId].statusMessage = await channel.send({ 
                embeds: [embed],
                components: [row] 
            });
            log(`Created new message in ${channel.name}`, 'ModsMonitor');
        }

        // Check perubahan mods dan kirim alert jika ada
        const changes = checkModChanges(serverId, data.mods);
        if (changes.length > 0 && conf.LOG_CHANNEL_ID) {
            await handleModChanges(serverId, changes);
        }
    } catch (error) {
        logError(error, `ModsMonitor/updateStatus/${serverId}`);
    }
}

// Function untuk check perubahan status mods
function checkModChanges(serverId, currentMods = []) {
    if (!serverData[serverId]) serverData[serverId] = { lastMods: [] };
    const lastMods = serverData[serverId].lastMods || [];
    const changes = [];

    // Check mods yang baru online atau ubah status
    currentMods.forEach(mod => {
        const previous = lastMods.find(m => m?.name === mod?.name);
        if (!previous) {
            changes.push(`${mod.name} came online${mod.status === 'Undercover' ? ' (Undercover)' : ''}`);
        } else if (previous.status !== mod.status) {
            changes.push(`${mod.name} changed from ${previous.status} to ${mod.status}`);
        }
    });

    // Check mods yang offline
    lastMods.forEach(mod => {
        if (!currentMods.some(m => m?.name === mod?.name)) {
            changes.push(`${mod.name} went offline`);
        }
    });

    serverData[serverId].lastMods = currentMods;
    return changes;
}

// Function untuk handle perubahan mods (kirim alert)
async function handleModChanges(serverId, changes) {
    const conf = serverConfigs[serverId];
    if (!conf.LOG_CHANNEL_ID) return;

    try {
        const logChannel = await client.channels.fetch(conf.LOG_CHANNEL_ID);
        if (!logChannel) {
            logError(`Log channel not found in server ${serverId}`, 'ModsMonitor/handleChanges');
            return;
        }

        const permissions = logChannel.permissionsFor(client.user);
        if (!permissions.has('SendMessages') || !permissions.has('EmbedLinks')) {
            logError(`Missing permissions in log channel ${conf.LOG_CHANNEL_ID}`, 'ModsMonitor/handleChanges');
            return;
        }

        // Kirim alert untuk setiap perubahan
        for (const change of changes) {
            const isOnline = change.includes('came online');
            const isStatusChange = change.includes('changed from');
            const isOffline = change.includes('went offline');

            let name, status;
            if (isOnline) {
                [name] = change.split(' ');
                status = change.includes('Undercover') ? 'undercover' : 'online';
            } 
            else if (isStatusChange) {
                const match = change.match(/(.+) changed from (.+) to (.+)/);
                if (match) {
                    [, name, , status] = match;
                    status = status.toLowerCase();
                }
            }
            else if (isOffline) {
                [name] = change.split(' ');
                status = 'offline';
            }

            const statusEmoji = getModStatusEmoji(serverId, status);

            const alertEmbed = new EmbedBuilder()
                .setTitle('Mod Activity Alert')
                .setDescription(
                    `\n\n${statusEmoji} ${name} is now ${status}`
                )
                .setColor(getStatusColor(status))
                .addFields({
                    name: '\u200B',
                    value: `${status} at <t:${Math.floor(Date.now()/1000)}:F>`
                });

            await logChannel.send({ embeds: [alertEmbed] });
            log(`Sent mod alert for ${name} (${status}) in server ${serverId}`, 'ModsMonitor');
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        logError(error, 'ModsMonitor/handleChanges');
    }
}

// Function untuk mendapatkan warna berdasarkan status
function getStatusColor(status) {
    const normalizedStatus = status ? status.toLowerCase() : 'offline';
    
    switch (normalizedStatus) {
        case 'online': return 0x00FF00;
        case 'undercover': return 0xFFFF00;
        case 'offline': return 0xFF0000;
        default: return 0x2F3136;
    }
}

// Function untuk update bot presence
async function updateBotPresence() {
    try {
        if (!config.BOT_STATUS?.length) return;

        const dataService = await getDataService();
        const { dlPrice } = dataService.getCurrentData();
        const mainData = serverData[Object.keys(serverConfigs)[0]]?.lastData;

        if (!mainData) return;

        const status = config.BOT_STATUS[currentStatusIndex];
        const text = status.text
            .replace('{modCount}', mainData.mods?.length || 0)
            .replace('{playerCount}', formatNumber(mainData.playerCount || 0))
            .replace('{serverCount}', Object.keys(serverConfigs).length)
            .replace('{dlPriceRp}', dlPrice.rp)
            .replace('{dlPriceUsd}', dlPrice.usd)
            .replace('{dlPriceEur}', dlPrice.eur || '0.00');

        await client.user.setPresence({
            activities: [{ name: text, type: ACTIVITY_TYPES[status.type] }],
            status: 'idle'
        });

        currentStatusIndex = (currentStatusIndex + 1) % config.BOT_STATUS.length;
    } catch (e) {
        logError(e, 'ModsMonitor/updatePresence');
    }
}

// Function utama untuk start monitoring
export async function startModsMonitoring() {
    const dataService = await getDataService();
    
    // Subscribe ke data service untuk update presence
    unsubscribeFromDataService = dataService.subscribe(() => {
        updateBotPresence();
    });

    // Event ketika bot ready
    client.on('ready', async () => {
        log(`Logged in as ${client.user.tag}`, 'ModsMonitor');

        // Handler untuk button interaction (Daily Mods)
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('show_daily_mods_')) return;

        try {
            await interaction.deferReply({ ephemeral: true });
            const serverId = interaction.customId.split('_')[3];
            
            if (!serverConfigs[serverId]) {
                return await interaction.followUp({
                    content: 'Server configuration not found.',
                    ephemeral: true
                });
            }

            // Ambil data mods yang sudah include daily mods
            const fetcher = await getDataFetcher();
            const modsData = await fetcher.getData('mods');
            
            // Check apakah ada data dailyMods
            if (!modsData?.dailyMods || !Array.isArray(modsData.dailyMods)) {
                return await interaction.followUp({
                    content: 'No daily mods data available.',
                    ephemeral: true
                });
            }

            const dailyMods = modsData.dailyMods;
            const currentMods = modsData.mods || [];
            
            // Jika tidak ada daily mods hari ini
            if (dailyMods.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`Mods Seen Today <t:${Math.floor(Date.now()/1000)}:D>`)
                    .setDescription('No mods activity recorded today.')
                    .setColor(0x2F3136);

                return await interaction.followUp({ 
                    embeds: [embed],
                    ephemeral: true
                });
            }

            // Buat deskripsi untuk setiap mod yang terlihat hari ini
            const modsDescription = dailyMods.map(dailyMod => {
                // Cari status mod saat ini dari data current mods
                const currentMod = currentMods.find(mod => 
                    mod.name.toLowerCase() === dailyMod.name.toLowerCase()
                );
                const currentStatus = currentMod?.status || 'Offline';
                
                // Dapatkan emoji yang sesuai berdasarkan status saat ini
                const statusEmoji = getModStatusEmoji(serverId, currentStatus);
                
                // Format: emoji + nama + status saat ini + last seen (menggunakan updated timestamp)
                return `${statusEmoji} ${dailyMod.name} (${currentStatus}) <t:${dailyMod.updated}:R>`;
            }).join('\n');

            // Buat embed untuk response
            const embed = new EmbedBuilder()
                .setTitle(`Mods Seen Today <t:${Math.floor(Date.now()/1000)}:D>`)
                .setDescription(modsDescription)
                .setColor(0x2F3136)
                .setFooter({
                    text: `${dailyMods.length} mod${dailyMods.length !== 1 ? 's' : ''} seen today`
                });

            await interaction.followUp({ 
                embeds: [embed],
                ephemeral: true
            });
            
        } catch (error) {
            logError(error, 'ModsMonitor/buttonInteraction');
            await interaction.followUp({
                content: 'Failed to fetch daily mods data. Please try again later.',
                ephemeral: true
            });
        }
    });

        // Initialize data untuk setiap server
        for (const serverId of Object.keys(serverConfigs)) {
            serverData[serverId] = { 
                lastMods: [],
                dailyMods: []
            };
            await updateStatus(serverId, true);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Set up intervals untuk update otomatis
        messageUpdateInterval = setInterval(() => {
            Object.keys(serverConfigs).forEach(serverId => updateStatus(serverId));
        }, Math.max(config.CHECK_INTERVAL, 30000));

        statusInterval = setInterval(updateBotPresence, config.STATUS_ROTATION_INTERVAL);
    });

    // Error handlers
    client.on('error', (err) => logError(err, 'ModsMonitor/clientError'));
    process.on('unhandledRejection', (err) => logError(err, 'ModsMonitor/unhandledRejection'));

    // Login bot
    client.login(config.DISCORD_TOKEN).catch((err) => {
        logError(err, 'ModsMonitor/login');
        process.exit(1);
    });

    // Return function untuk stop monitoring
    return {
        stop: () => {
            if (unsubscribeFromDataService) unsubscribeFromDataService();
            client.destroy();
            clearInterval(statusInterval);
            clearInterval(messageUpdateInterval);
            log("Mods monitoring stopped", 'ModsMonitor');
        }
    };
}