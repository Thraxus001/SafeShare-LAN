// src/services/electronBridge.js

/**
 * Electron Bridge Service - Bridges React app with Electron main process
 * This service provides a clean API for Electron IPC communication
 */

class ElectronBridge {
    constructor() {
        this.isElectron = this.checkElectron();
        this.listeners = new Map();
        this.initialized = false;
    }

    /**
     * Check if running in Electron
     */
    checkElectron() {
        return (
            typeof window !== 'undefined' &&
            window.ipcRenderer !== undefined
        );
    }

    /**
     * Initialize the bridge
     */
    async initialize() {
        if (!this.isElectron) {
            console.warn('Not running in Electron. Using simulation mode.');
            this.setupSimulation();
            this.initialized = true;
            return { success: true, mode: 'simulation' };
        }

        try {
            // Wait for Electron to be ready
            if (window.ipcRenderer) {
                await this.setupIpcListeners();
                this.initialized = true;

                console.log('Electron bridge initialized successfully');
                return { success: true, mode: 'electron' };
            } else {
                throw new Error('Electron IPC not available');
            }
        } catch (error) {
            console.error('Failed to initialize Electron bridge:', error);
            // In a real build, we should not fall back to simulation if we are supposed to be in Electron
            if (this.isElectron) {
                throw error;
            }
            this.setupSimulation();
            this.initialized = true;
            return { success: false, mode: 'simulation', error: error.message };
        }
    }

    /**
     * Setup IPC listeners for Electron
     */
    async setupIpcListeners() {
        const { ipcRenderer } = window;

        // Network events
        ipcRenderer.on('network-interfaces-detected', (event, data) => {
            this.notifyListeners('network-interfaces', data);
        });

        ipcRenderer.on('network-interfaces-changed', (event, data) => {
            this.notifyListeners('network-interfaces-changed', data);
        });

        ipcRenderer.on('network-configuration-complete', (event, data) => {
            this.notifyListeners('network-configured', data);
        });

        ipcRenderer.on('peer-discovered', (event, data) => {
            this.notifyListeners('peer-found', data);
        });

        ipcRenderer.on('network-error', (event, error) => {
            this.notifyListeners('network-error', error);
        });

        ipcRenderer.on('discovery-status', (event, data) => {
            this.notifyListeners('discovery-status', data);
        });

        // File transfer events
        ipcRenderer.on('transfer-progress', (event, data) => {
            this.notifyListeners('transfer-progress', data);
        });

        ipcRenderer.on('transfer-complete', (event, data) => {
            this.notifyListeners('transfer-complete', data);
        });

        ipcRenderer.on('transfer-error', (event, error) => {
            this.notifyListeners('transfer-error', error);
        });

        // System events
        ipcRenderer.on('system-info', (event, data) => {
            this.notifyListeners('system-info', data);
        });

        ipcRenderer.on('app-update', (event, data) => {
            this.notifyListeners('app-update', data);
        });
    }

    /**
     * Setup simulation mode (for web browser)
     */
    setupSimulation() {
        console.log('Setting up simulation mode');

        // Mock IPC methods
        window.ipcRenderer = {
            invoke: async (channel, ...args) => {
                console.log(`IPC invoke simulation: ${channel}`, args);
                return this.handleSimulation(channel, ...args);
            },

            send: (channel, ...args) => {
                console.log(`IPC send simulation: ${channel}`, args);
                this.handleSimulation(channel, ...args);
            },

            on: (channel, callback) => {
                console.log(`IPC on simulation: ${channel}`);
                // Store callback for simulated events
                if (!this.listeners.has(channel)) {
                    this.listeners.set(channel, []);
                }
                this.listeners.get(channel).push(callback);
            },

            removeAllListeners: (channel) => {
                this.listeners.delete(channel);
            }
        };
    }

    /**
     * Handle simulation requests
     */
    async handleSimulation(channel, ...args) {
        switch (channel) {
            // Network operations
            case 'detect-network-interfaces':
                const result = await this.simulateNetworkInterfaces();
                return result.interfaces;

            case 'configure-network':
                return this.simulateNetworkConfiguration(args[0]);

            case 'discover-peer':
                return this.simulatePeerDiscovery();

            case 'test-connection':
                return this.simulateConnectionTest(args[0]);

            // File operations
            case 'select-files':
                return this.simulateFileSelection();

            case 'transfer-files':
                return this.simulateFileTransfer(args[0]);

            case 'cancel-transfer':
                return this.simulateTransferCancellation(args[0]);

            case 'pause-transfer':
                return { success: true, transferId: args[0], message: 'Transfer paused' };

            case 'resume-transfer':
                return { success: true, transferId: args[0], message: 'Transfer resumed' };

            // System operations
            case 'get-system-info':
                return this.simulateSystemInfo();

            case 'open-folder':
                return this.simulateOpenFolder(args[0]);

            case 'show-notification':
                return this.simulateNotification(args[0]);

            case 'select-download-directory':
                return { success: true, path: '/Downloads/SafeShare' };

            case 'set-download-directory':
                return { success: true, path: args[0] };

            case 'get-download-directory':
                return { success: true, path: '/Downloads/SafeShare' };

            default:
                console.warn(`Unknown IPC channel: ${channel}`);
                return { success: false, error: 'Channel not implemented in simulation' };
        }
    }

    /**
     * Network simulation methods
     */
    async simulateNetworkInterfaces() {
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            success: true,
            interfaces: [
                {
                    name: 'Ethernet',
                    type: 'wired',
                    connected: true,
                    ip: '169.254.45.12',
                    mac: '00:1A:2B:3C:4D:5E',
                    speed: '1 Gbps'
                },
                {
                    name: 'Wi-Fi',
                    type: 'wireless',
                    connected: true,
                    ip: '192.168.1.15',
                    mac: '00:1A:2B:3C:4D:5F',
                    speed: '866 Mbps'
                }
            ]
        };
    }

    async simulateNetworkConfiguration(config) {
        console.log('Simulating network configuration:', config);

        await new Promise(resolve => setTimeout(resolve, 800));

        return {
            success: true,
            ip: '169.254.45.12',
            subnet: '255.255.0.0',
            gateway: '',
            dns: [],
            timestamp: new Date()
        };
    }

    async simulatePeerDiscovery() {
        console.log('Simulating peer discovery...');

        // Simulate discovery delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Simulate finding a peer
        this.simulatePeerFound();

        return {
            success: true,
            peerIP: '169.254.45.13',
            peerName: 'Computer-2',
            protocol: 'TCP/9001'
        };
    }

    simulatePeerFound() {
        // Trigger simulated event
        setTimeout(() => {
            const callbacks = this.listeners.get('peer-discovered');
            if (callbacks) {
                callbacks.forEach(callback => {
                    callback({}, {
                        peerIP: '169.254.45.13',
                        peerName: 'Computer-2',
                        protocol: 'TCP/9001'
                    });
                });
            }
        }, 1000);
    }

    async simulateConnectionTest(peerIP) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            success: true,
            ping: 1.2,
            download: 950,
            upload: 920,
            jitter: 0.3,
            packetLoss: 0
        };
    }

    /**
     * File operations simulation
     */
    async simulateFileSelection() {
        // In a real Electron app, this would show a file dialog
        // For simulation, return mock file data
        return {
            success: true,
            files: [
                {
                    name: 'example_document.pdf',
                    path: '/Users/user/Documents/example_document.pdf',
                    size: 1548234,
                    type: 'application/pdf'
                },
                {
                    name: 'presentation.pptx',
                    path: '/Users/user/Documents/presentation.pptx',
                    size: 4521890,
                    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                }
            ]
        };
    }

    async simulateFileTransfer(transferData) {
        console.log('Simulating file transfer:', transferData);

        const transferId = `transfer_${Date.now()}`;

        // Simulate transfer progress
        this.simulateTransferProgress(transferId, transferData);

        return {
            success: true,
            transferId,
            message: 'Transfer started successfully'
        };
    }

    simulateTransferProgress(transferId, transferData) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;

            // Trigger progress event
            const callbacks = this.listeners.get('transfer-progress');
            if (callbacks) {
                callbacks.forEach(callback => {
                    callback({}, {
                        transferId,
                        progress: Math.min(progress, 100),
                        transferredBytes: (transferData.totalSize || 1000000) * (progress / 100),
                        totalBytes: transferData.totalSize || 1000000,
                        speed: 120,
                        currentFile: transferData.files?.[0]?.name || 'unknown',
                        fileProgress: progress
                    });
                });
            }

            if (progress >= 100) {
                clearInterval(interval);

                // Trigger completion event
                const completeCallbacks = this.listeners.get('transfer-complete');
                if (completeCallbacks) {
                    completeCallbacks.forEach(callback => {
                        callback({}, {
                            transferId,
                            success: true,
                            totalBytes: transferData.totalSize || 1000000,
                            transferTime: 5000,
                            files: transferData.files || []
                        });
                    });
                }
            }
        }, 200);
    }

    async simulateTransferCancellation(transferId) {
        console.log('Simulating transfer cancellation:', transferId);

        await new Promise(resolve => setTimeout(resolve, 300));

        return {
            success: true,
            transferId,
            message: 'Transfer cancelled successfully'
        };
    }

    /**
     * System operations simulation
     */
    async simulateSystemInfo() {
        return {
            success: true,
            platform: process.platform || 'web',
            arch: 'x64',
            version: '1.0.0',
            memory: {
                total: 8589934592, // 8GB
                free: 4294967296, // 4GB
                used: 4294967296 // 4GB
            },
            storage: {
                total: 256060514304, // 256GB
                free: 128030257152, // 128GB
                used: 128030257152 // 128GB
            }
        };
    }

    async simulateOpenFolder(path) {
        console.log('Simulating opening folder:', path);

        return {
            success: true,
            path,
            message: 'Folder opened successfully'
        };
    }

    async simulateNotification(notification) {
        console.log('Simulating notification:', notification);

        // Show browser notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title || 'SafeShare', {
                body: notification.message || 'Notification',
                icon: '/favicon.ico'
            });
        }

        return { success: true };
    }

    /**
     * Public API methods
     */

    // Network methods
    async detectNetworkInterfaces() {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('detect-network-interfaces');
    }

    async configureNetwork(config) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('configure-network', config);
    }

    async discoverPeer() {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('discover-peer');
    }

    async testConnection(peerIP) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('test-connection', peerIP);
    }

    // File methods
    async selectFiles(options = {}) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('select-files', options);
    }

    async transferFiles(transferData) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('transfer-files', transferData);
    }

    async cancelTransfer(transferId) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('cancel-transfer', transferId);
    }

    async pauseTransfer(transferId) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('pause-transfer', transferId);
    }

    async resumeTransfer(transferId) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('resume-transfer', transferId);
    }

    // System methods
    async getSystemInfo() {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('get-system-info');
    }

    async openFolder(path) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('open-folder', path);
    }

    async showNotification(notification) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('show-notification', notification);
    }

    async selectDownloadDirectory() {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('select-download-directory');
    }

    async setDownloadDirectory(dir) {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('set-download-directory', dir);
    }

    async getDownloadDirectory() {
        if (!this.initialized) await this.initialize();
        return window.ipcRenderer.invoke('get-download-directory');
    }

    /**
     * Event listener system
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        const callbacks = this.listeners.get(event);
        if (callbacks.indexOf(callback) === -1) {
            callbacks.push(callback);
        }
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    removeListener(event, callback) {
        this.off(event, callback);
    }

    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.listeners.clear();
        if (window.ipcRenderer && window.ipcRenderer.removeAllListeners) {
            window.ipcRenderer.removeAllListeners();
        }
    }
}

// Export singleton instance
const electronBridge = new ElectronBridge();
export default electronBridge;