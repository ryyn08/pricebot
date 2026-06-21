const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const clc = require('cli-color');
const { spawn } = require('child_process');

// Konfigurasi
const config = {
    phoneNumber: "6283119396819", // Ganti dengan nomor Anda
    usePairingCode: true
};

// Objek untuk menyimpan status cooldown tiap server (15 menit = 900.000 ms)
let isCoolingDown = {};
const COOLDOWN_TIME = 900000; 

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ["Ryyn Monitor", "Chrome", "1.0.0"],
        printQRInTerminal: !config.usePairingCode,
    });

    // Logika Pairing Code
    if (config.usePairingCode && !sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(config.phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(clc.cyan(`\n╭───────────────────────────────────────────╮`));
            console.log(clc.cyan(`│ `) + clc.white(`RYYN PAIRING CODE : `) + clc.yellow.bold(code) + clc.cyan(` │`));
            console.log(clc.cyan(`╰───────────────────────────────────────────╯\n`));
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log(clc.greenBright.bold('Bot Berhasil Terhubung ke WhatsApp✅'));
            startMonitor(sock);
        } else if (connection === 'close') {
            // Reconnect logic
            connectToWhatsApp();
        }
    });

    return sock;
}

function startMonitor(sock) {
    const py = spawn('python3', ['monitor.py']);
    
    py.stdout.on('data', (data) => {
        try {
            const info = JSON.parse(data.toString());
            
            // Jika status DISCONNECT dan tidak sedang dalam cooldown
            if (info.status === "DISCONNECT" && !isCoolingDown[info.name]) {
                const tagnumber = "6285811500108";
                const text = `🚨 *NOTIFIKASI SERVER* @${tagnumber} 😫\n\n` +
                             `name: *${info.name}*\n` +
                             `IP: ${info.ip}\n` +
                             `Latency: ${info.ms}ms\n` +
                             `Status: *SERVER DISCONNECT*\n\n` +
                             `Tindakan: Sistem sedang mencoba auto-reconnect`;
                
                sock.sendMessage("120363406005498732@g.us", { 
                    text: text, 
                    mentions: [`${tagnumber}@s.whatsapp.net`] 
                });

                // Set cooldown 15 menit
                isCoolingDown[info.name] = true;
                setTimeout(() => { 
                    delete isCoolingDown[info.name]; 
                }, COOLDOWN_TIME);
            }
        } catch (e) {
            // Abaikan output non-JSON dari Python
        }
    });
}

// Jalankan fungsi utama
connectToWhatsApp();
