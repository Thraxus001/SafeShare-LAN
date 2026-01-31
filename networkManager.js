const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline, Transform } = require('stream');

const DISCOVERY_PORT = 9000;
const TRANSFER_PORT = 9001;
const BROADCAST_INTERVAL = 1000;

// Helper to create a progress transform stream
function createProgressTransform(onProgress) {
    let transferred = 0;
    return new Transform({
        transform(chunk, encoding, callback) {
            transferred += chunk.length;
            onProgress(transferred);
            this.push(chunk);
            callback();
        }
    });
}

function ipToLong(ip) {
    const parts = ip.split('.');
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function longToIp(long) {
    return [
        (long >>> 24) & 0xff,
        (long >>> 16) & 0xff,
        (long >>> 8) & 0xff,
        long & 0xff
    ].join('.');
}

class NetworkManager {
    constructor(mainWindow, app) {
        this.mainWindow = mainWindow;
        this.app = app;
        this.udpSocket = null;
        this.tcpServer = null;
        this.peers = new Map();
        this.activeTransfers = new Map();
        this.isScanning = false;
        this.broadcastTimer = null;
        this.downloadsDir = path.join(this.app.getPath('downloads'), 'EtherLink');

        if (!fs.existsSync(this.downloadsDir)) {
            try {
                fs.mkdirSync(this.downloadsDir, { recursive: true });
            } catch (e) {
                console.error('Error creating initial downloads directory:', e);
            }
        }
    }

    setDownloadsDir(dir) {
        this.downloadsDir = dir;
        if (!fs.existsSync(this.downloadsDir)) {
            try {
                fs.mkdirSync(this.downloadsDir, { recursive: true });
            } catch (e) {
                console.error('Error creating downloads directory:', e);
            }
        }
    }

    getDownloadsDir() {
        return this.downloadsDir;
    }

    async sendFile(transferId, peerIP, filePath) {
        return new Promise((resolve, reject) => {
            const fileName = path.basename(filePath);
            const socket = new net.Socket();
            let transferFinished = false;

            if (!fs.existsSync(filePath)) {
                return reject(new Error('File not found'));
            }

            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            let lastUpdate = Date.now();
            let lastBytes = 0;

            this.activeTransfers.set(transferId, {
                socket,
                cancel: () => {
                    if (transferFinished) return;
                    transferFinished = true;
                    socket.destroy();
                    reject(new Error('Transfer cancelled'));
                }
            });

            socket.setTimeout(5000);
            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('Transfer connection timed out'));
            });

            socket.connect(TRANSFER_PORT, peerIP, () => {
                const meta = JSON.stringify({ transferId, name: fileName, size: fileSize }) + '\n';

                // Wait for metadata to be flushed to kernel before starting pipeline
                // This prevents race conditions where binaries might look like metadata
                socket.write(meta, 'utf8', () => {
                    const fileStream = fs.createReadStream(filePath);
                    const progressTransform = createProgressTransform((transferred) => {
                        const now = Date.now();
                        const delta = now - lastUpdate;

                        if (delta >= 500 && this.mainWindow && !this.mainWindow.isDestroyed()) {
                            const progress = Math.min(100, Math.floor((transferred / fileSize) * 100));
                            const speed = ((transferred - lastBytes) / (delta / 1000)) / (1024 * 1024);

                            this.mainWindow.webContents.send('transfer-progress', {
                                transferId,
                                status: 'sending',
                                filename: fileName,
                                progress: progress,
                                sent: transferred,
                                total: fileSize,
                                speed: Number(speed.toFixed(2))
                            });

                            lastUpdate = now;
                            lastBytes = transferred;
                        }
                    });

                    pipeline(
                        fileStream,
                        progressTransform,
                        socket,
                        (err) => {
                            if (transferFinished) return;
                            transferFinished = true;
                            this.activeTransfers.delete(transferId);

                            if (err) {
                                console.error('Send pipeline error:', err);
                                reject(err);
                            } else {
                                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                                    this.mainWindow.webContents.send('transfer-complete', {
                                        transferId,
                                        filename: fileName,
                                        status: 'completed'
                                    });
                                }
                                resolve({ success: true });
                            }
                        }
                    );
                });
            });

            socket.on('error', (err) => {
                console.error('Send socket error:', err);
                if (transferFinished) return;
                transferFinished = true;
                this.activeTransfers.delete(transferId);
                reject(err);
                transferFinished = true;
                this.activeTransfers.delete(transferId);
                reject(err);
            });
        });
    }

    getLocalIPs() {
        const nets = os.networkInterfaces();
        const results = [];
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4') {
                    results.push(net.address);
                }
            }
        }
        return results;
    }

    startDiscovery() {
        // Always reset peers map on new discovery request to force re-emission of events
        // This fixes the issue where switching modes/views would hang because the peer was "already known"
        this.peers.clear();

        // Ensure TCP server is running (idempotent check is inside startTcpServer)
        this.startTcpServer();

        if (this.isScanning) {
            console.log('Discovery restart: Peers list cleared, continuing broadcast.');
            return;
        }

        this.isScanning = true;

        try {
            this.udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

            this.udpSocket.on('message', (msg, rinfo) => this.handleDiscoveryMessage(msg, rinfo));
            this.udpSocket.on('error', (err) => {
                console.error('UDP Error:', err);
                this.isScanning = false;
            });

            this.udpSocket.bind(DISCOVERY_PORT, () => {
                if (this.udpSocket) {
                    this.udpSocket.setBroadcast(true);
                    this.startBroadcasting();
                }
            });

            console.log('Discovery started on port', DISCOVERY_PORT);
        } catch (e) {
            console.error('Failed to start discovery:', e);
            this.isScanning = false;
        }

        // Fallback subnet scan if no peers found via UDP in 5 seconds
        setTimeout(() => {
            if (this.peers.size === 0) {
                this.scanSubnet();
            }
        }, 5000);
    }

    async scanSubnet() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('discovery-status', { status: 'advanced-scanning' });
        }

        const interfaces = os.networkInterfaces();
        const targets = [];
        const localIPs = this.getLocalIPs();

        for (const [name, addrs] of Object.entries(interfaces)) {
            for (const addr of addrs) {
                if (!addr.internal && addr.family === 'IPv4') {
                    const ipLong = ipToLong(addr.address);
                    const maskLong = ipToLong(addr.netmask);
                    const networkLong = ipLong & maskLong;
                    const broadcastLong = networkLong | (~maskLong >>> 0);

                    // Scan /24 or smaller
                    if ((broadcastLong - networkLong) <= 256) {
                        for (let i = networkLong + 1; i < broadcastLong; i++) {
                            const targetIP = longToIp(i);
                            if (!localIPs.includes(targetIP)) {
                                targets.push(targetIP);
                            }
                        }
                    }
                }
            }
        }

        const batchSize = 15;
        for (let i = 0; i < targets.length; i += batchSize) {
            if (this.peers.size > 0) break;
            const batch = targets.slice(i, i + batchSize);
            await Promise.all(batch.map(ip => this.checkPeer(ip)));
        }

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('discovery-status', { status: 'idle' });
        }
    }

    async checkPeer(ip) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(800);
            socket.on('connect', () => {
                const peer = { ip, name: `Discovered Device (${ip})`, lastSeen: Date.now() };
                if (!this.peers.has(ip)) {
                    this.peers.set(ip, peer);
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('peer-discovered', peer);
                    }
                }
                socket.destroy();
                resolve(true);
            });
            socket.on('error', () => { socket.destroy(); resolve(false); });
            socket.on('timeout', () => { socket.destroy(); resolve(false); });
            socket.connect(TRANSFER_PORT, ip);
        });
    }

    startBroadcasting() {
        const broadcast = () => {
            try {
                const message = JSON.stringify({ type: 'discovery', name: os.hostname(), os: os.platform() });
                const interfaces = os.networkInterfaces();

                for (const name in interfaces) {
                    for (const iface of interfaces[name]) {
                        if (iface.family === 'IPv4' && !iface.internal) {
                            try {
                                if (this.udpSocket) {
                                    // 1. Send to global broadcast
                                    this.udpSocket.send(message, DISCOVERY_PORT, '255.255.255.255');

                                    // 2. Send to specific interface broadcast
                                    const ipLong = ipToLong(iface.address);
                                    const maskLong = ipToLong(iface.netmask);
                                    const broadcastLong = (ipLong & maskLong) | (~maskLong >>> 0);
                                    const calcBroadcast = longToIp(broadcastLong);

                                    this.udpSocket.send(message, DISCOVERY_PORT, calcBroadcast);

                                    // 3. Fallback: simple .255 for good measure
                                    const parts = iface.address.split('.');
                                    parts[3] = '255';
                                    this.udpSocket.send(message, DISCOVERY_PORT, parts.join('.'));
                                }
                            } catch (e) {
                                console.error(`Error broadcasting on ${iface.address}:`, e);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Broadcast loop error:', e);
            }
        };
        this.broadcastTimer = setInterval(broadcast, BROADCAST_INTERVAL);
        broadcast();
    }

    handleDiscoveryMessage(msg, rinfo) {
        try {
            const localIPs = this.getLocalIPs();
            if (localIPs.includes(rinfo.address)) return;

            const data = JSON.parse(msg.toString());
            if (data.type === 'discovery') {
                const peer = { ip: rinfo.address, name: data.name, os: data.os, lastSeen: Date.now() };
                if (!this.peers.has(peer.ip)) {
                    this.peers.set(peer.ip, peer);
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('peer-discovered', peer);
                    }
                } else {
                    this.peers.get(peer.ip).lastSeen = Date.now();
                }
            }
        } catch (e) { }
    }

    startTcpServer() {
        if (this.tcpServer) return;
        this.tcpServer = net.createServer((socket) => this.handleIncomingTransfer(socket));
        this.tcpServer.on('error', (err) => console.error('TCP Server Error:', err));
        this.tcpServer.listen(TRANSFER_PORT, () => {
            console.log(`TCP Transfer Server listening on port ${TRANSFER_PORT}`);
        });
    }

    pauseTransfer(transferId) {
        if (this.activeTransfers.has(transferId)) {
            const transfer = this.activeTransfers.get(transferId);
            if (transfer.socket) {
                transfer.socket.pause();
                console.log(`Paused socket for ${transferId}`);
                return true;
            }
        }
        return false;
    }

    resumeTransfer(transferId) {
        if (this.activeTransfers.has(transferId)) {
            const transfer = this.activeTransfers.get(transferId);
            if (transfer.socket) {
                transfer.socket.resume();
                console.log(`Resumed socket for ${transferId}`);
                return true;
            }
        }
        return false;
    }

    handleIncomingTransfer(socket) {
        let receiving = false;
        let transferId = `recv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        let metaBuffer = Buffer.alloc(0);
        let transferFinished = false;
        let lastUpdate = Date.now();
        let lastBytes = 0;

        this.activeTransfers.set(transferId, {
            socket,
            cancel: () => {
                if (transferFinished) return;
                transferFinished = true;
                socket.destroy();
            }
        });

        // Debug: Log raw connection
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            // Send an immediate "Starting" signal so UI knows a connection happened
            this.mainWindow.webContents.send('transfer-progress', {
                transferId, status: 'connecting', filename: 'Incoming Transfer...', progress: 0, speed: 0
            });
        }

        socket.on('data', (data) => {
            if (transferFinished) return;

            if (!receiving) {
                metaBuffer = Buffer.concat([metaBuffer, data]);
                const newlineIndex = metaBuffer.indexOf('\n');
                if (newlineIndex === -1) {
                    if (metaBuffer.length > 65536) socket.destroy();
                    return;
                }

                try {
                    const meta = JSON.parse(metaBuffer.slice(0, newlineIndex).toString());
                    const fileName = path.basename(meta.name);
                    const fileSize = meta.size;
                    if (meta.transferId) transferId = meta.transferId;
                    const fullPath = path.join(this.downloadsDir, fileName);

                    if (fs.existsSync(fullPath)) {
                        try { fs.unlinkSync(fullPath); } catch (e) { }
                    }

                    const writeStream = fs.createWriteStream(fullPath);
                    const progressTransform = createProgressTransform((transferred) => {
                        const now = Date.now();
                        const delta = now - lastUpdate;
                        if (delta >= 500 && this.mainWindow && !this.mainWindow.isDestroyed()) {
                            const progress = Math.min(100, Math.floor((transferred / fileSize) * 100));
                            const speed = ((transferred - lastBytes) / (delta / 1000)) / (1024 * 1024);
                            this.mainWindow.webContents.send('transfer-progress', {
                                transferId, status: 'receiving', filename: fileName, progress, received: transferred, total: fileSize, speed: Number(speed.toFixed(2))
                            });
                            lastUpdate = now;
                            lastBytes = transferred;
                        }
                    });

                    // Send immediate "receiving" status so UI registers the file even if small
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('transfer-progress', {
                            transferId, status: 'receiving', filename: fileName, progress: 0, received: 0, total: fileSize, speed: 0
                        });
                    }

                    receiving = true;
                    // Important: Pause socket before unshifting to prevent data race with pipeline
                    socket.pause();

                    // Remove our 'data' listener so pipeline can take over
                    socket.removeAllListeners('data');

                    const remainingData = metaBuffer.slice(newlineIndex + 1);
                    metaBuffer = null;

                    // Push remaining data back to socket stream
                    if (remainingData.length > 0) {
                        socket.unshift(remainingData);
                    }

                    pipeline(socket, progressTransform, writeStream, (err) => {
                        if (transferFinished) return;
                        transferFinished = true;
                        this.activeTransfers.delete(transferId);

                        if (err) {
                            console.error('Pipeline failed:', err);
                            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                                this.mainWindow.webContents.send('transfer-error', { transferId, error: err.message });
                            }
                        } else {
                            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                                this.mainWindow.webContents.send('transfer-complete', { transferId, filename: fileName, path: fullPath });
                            }
                        }
                    });

                } catch (e) {
                    console.error('Metadata parse error:', e);
                    socket.destroy();
                }
            }
        });

        socket.on('error', (err) => {
            console.error('Socket error:', err);
            if (!transferFinished) {
                transferFinished = true;
                this.activeTransfers.delete(transferId);
            }
        });
    }

    stop() {
        if (this.broadcastTimer) clearInterval(this.broadcastTimer);
        if (this.udpSocket) {
            try { this.udpSocket.close(); } catch (e) { }
            this.udpSocket = null;
        }
        if (this.tcpServer) {
            try { this.tcpServer.close(); } catch (e) { }
            this.tcpServer = null;
        }
    }
}

module.exports = NetworkManager;
