const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const NetworkManager = require('./networkManager');

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (error) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL UNHANDLED REJECTION:', reason);
});

let mainWindow;
let networkManager;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'public/logo512.png')
    });

    // Initialize Network Manager
    networkManager = new NetworkManager(mainWindow, app);

    // Start Network Status Polling
    startNetworkWatcher();

    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'build/index.html')}`;

    // In dev mode, load localhost
    // We can detect dev mode by checking if we serve from localhost or file
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadURL(startUrl);
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (networkManager) networkManager.stop();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// --- IPC Handlers ---

// --- Network Change Watcher ---
let lastInterfaceState = JSON.stringify(os.networkInterfaces());

function startNetworkWatcher() {
    setInterval(() => {
        const currentInterfaces = os.networkInterfaces();
        const currentState = JSON.stringify(currentInterfaces);

        if (currentState !== lastInterfaceState) {
            console.log('Network interface change detected');
            lastInterfaceState = currentState;

            if (mainWindow) {
                // Return formatted interface list like in 'detect-network-interfaces'
                const formatted = formatInterfaces(currentInterfaces);
                mainWindow.webContents.send('network-interfaces-changed', formatted);
            }
        }
    }, 3000); // Poll every 3 seconds
}

function formatInterfaces(interfaces) {
    const result = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
        const addresses = addrs.map(addr => ({
            address: addr.address,
            netmask: addr.netmask,
            family: addr.family,
            mac: addr.mac,
            internal: addr.internal,
            cidr: addr.cidr
        }));

        let type = 'unknown';
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan') || name.toLowerCase().includes('wireless')) {
            type = 'wireless';
        } else if (name.toLowerCase().includes('ethernet') || name.toLowerCase().includes('eth')) {
            type = 'wired';
        }

        const connected = addresses.some(a => !a.internal && a.family === 'IPv4');

        result.push({
            name,
            type,
            connected,
            addresses,
            speed: 'Unknown'
        });
    }
    return result;
}

// Update the existing handler to use the format function
ipcMain.handle('detect-network-interfaces', async () => {
    const result = formatInterfaces(os.networkInterfaces());

    if (mainWindow) {
        mainWindow.webContents.send('network-interfaces-detected', result);
    }

    return result;
});

// Configure Network (Firewall)
ipcMain.handle('configure-network', async (event, data) => {
    console.log('Configuring network/firewall...', data);

    if (os.platform() !== 'win32') {
        return { success: true, message: 'Skipping firewall config on non-Windows' };
    }

    const { ports } = data;
    if (!ports || !Array.isArray(ports)) return { success: false, error: 'No ports provided' };

    try {
        // Try to enable Network Discovery and File Sharing groups
        const groups = ['Network Discovery', 'File and Printer Sharing'];
        for (const group of groups) {
            const cmd = `netsh advfirewall firewall set rule group="${group}" new enable=Yes`;
            exec(cmd, (error) => {
                if (error) console.log(`Note: Could not enable group ${group}: ${error.message}`);
                else console.log(`Group ${group} enabled`);
            });
        }

        // We try to add outbound and inbound rules for the app
        // Note: This usually needs admin, but we'll try anyway. 
        // Some users might have already allowed the app or it might prompt them.
        for (const port of ports) {
            const protocol = port === 9000 ? 'UDP' : 'TCP';
            const ruleName = `SafeShare_${protocol}_${port}`;

            // Try to add rule (using netsh)
            // We use 'action=allow' and check if it already exists or just try to add
            const cmd = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=${protocol} localport=${port} profile=any`;

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.log(`Note: Firewall rule ${ruleName} might already exist or needs admin: ${error.message}`);
                } else {
                    console.log(`Firewall rule ${ruleName} added successfully`);
                }
            });
        }

        return { success: true, message: 'Firewall rules configuration attempted' };
    } catch (e) {
        console.error('Firewall config error', e);
        return { success: false, error: e.message };
    }
});

// Get System Info
ipcMain.handle('get-system-info', async () => {
    return {
        success: true,
        platform: os.platform(),
        arch: os.arch(),
        version: app.getVersion(),
        hostname: os.hostname(),
        memory: {
            total: os.totalmem(),
            free: os.freemem()
        }
    };
});

// Open Folder
ipcMain.handle('open-folder', async (event, filePath) => {
    try {
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
            shell.showItemInFolder(filePath);
            return { success: true, message: 'Showing item in folder' };
        } else {
            const dirPath = path.dirname(filePath);
            if (fs.existsSync(dirPath)) {
                await shell.openPath(dirPath);
                return { success: true, message: 'Opened parent directory' };
            }
        }
        return { success: false, error: 'File or directory not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Select Download Directory
ipcMain.handle('select-download-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled) {
        return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
});

// Set Download Directory
ipcMain.handle('set-download-directory', async (event, dir) => {
    try {
        if (networkManager) {
            networkManager.setDownloadsDir(dir);
            return { success: true, path: dir };
        }
        return { success: false, error: 'NetworkManager not initialized' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Get Download Directory
ipcMain.handle('get-download-directory', async () => {
    try {
        if (networkManager) {
            return { success: true, path: networkManager.getDownloadsDir() };
        }
        return { success: false, error: 'NetworkManager not initialized' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Select Files
ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections']
    });

    if (result.canceled) {
        return { success: false, canceled: true };
    }

    const files = result.filePaths.map(filePath => ({
        name: path.basename(filePath),
        path: filePath,
        size: 0, // Would need fs.stat to get size
        type: path.extname(filePath) // Simple extension check
    }));

    // Get sizes
    const fs = require('fs');
    for (let f of files) {
        try {
            const stats = fs.statSync(f.path);
            f.size = stats.size;
        } catch (e) {
            console.error('Error getting stats for ' + f.path, e);
        }
    }

    return { success: true, files };
});

// Test Connection
ipcMain.handle('test-connection', async (event, ip) => {
    try {
        if (networkManager) {
            const success = await networkManager.checkPeer(ip);
            return { success };
        }
        return { success: false, error: 'NetworkManager not initialized' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Start Discovery
ipcMain.handle('discover-peer', async () => {
    try {
        if (networkManager) {
            networkManager.startDiscovery();
            return { success: true, message: 'Discovery started' };
        }
    } catch (e) {
        console.error('Discovery error', e);
        return { success: false, error: e.message };
    }
});

// Transfer Files process lock
let batchTransferActive = false;

ipcMain.handle('transfer-files', async (event, data) => {
    console.log('Transfer requested', data);

    if (batchTransferActive) {
        return { success: false, error: 'A transfer is already in progress. Please wait.' };
    }

    if (!data.files || data.files.length === 0) return { success: false, error: 'No files provided' };

    batchTransferActive = true;
    try {
        // Use the ID provided by frontend, or generate one if missing
        const batchId = data.transferId || `send_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        for (const file of data.files) {
            // We use the same Batch ID for all files so the frontend can track them in the same card
            console.log(`Starting transfer for ${file.name} (${batchId})`);


            try {
                await networkManager.sendFile(batchId, data.peerIP, file.path);
                // Small gap between files to allow OS to clean up sockets
                await new Promise(r => setTimeout(r, 100));
            } catch (err) {
                console.error(`Error sending file ${file.name}:`, err);
                // We continue with next files unless it's a critical connection error
                if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
                    throw err;
                }
            }
        }
        return { success: true, message: 'Transfer batch completed' };
    }
    catch (error) {
        console.error('Batch transfer failed', error);
        return { success: false, error: error.message };
    } finally {
        batchTransferActive = false;
    }
});

// Cancel Transfer
ipcMain.handle('cancel-transfer', async (event, transferId) => {
    console.log('Cancel transfer requested', transferId);
    try {
        if (networkManager) {
            const success = networkManager.cancelTransfer(transferId);
            return { success };
        }
        return { success: false, error: 'NetworkManager not initialized' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Pause Transfer
ipcMain.handle('pause-transfer', async (event, transferId) => {
    console.log('Pause transfer requested', transferId);
    try {
        if (networkManager) {
            const success = networkManager.pauseTransfer(transferId);
            return { success };
        }
        return { success: false, error: 'NetworkManager not initialized' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Resume Transfer
ipcMain.handle('resume-transfer', async (event, transferId) => {
    console.log('Resume transfer requested', transferId);
    try {
        if (networkManager) {
            const success = networkManager.resumeTransfer(transferId);
            return { success };
        }
        return { success: false, error: 'NetworkManager not initialized' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});
