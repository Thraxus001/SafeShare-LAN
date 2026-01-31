// src/hooks/useElectron.js

import { useState, useEffect, useCallback } from 'react';
import electronBridge from '../services/electronBridge';

/**
 * Custom hook for Electron integration
 */
const useElectron = () => {
    const [electronState, setElectronState] = useState({
        isElectron: false,
        isInitialized: false,
        platform: 'web',
        version: '1.0.0',
        systemInfo: null,
        error: null
    });

    const [ipcEvents, setIpcEvents] = useState([]);

    /**
     * Initialize Electron bridge
     */
    const initialize = useCallback(async () => {
        try {
            const result = await electronBridge.initialize();

            setElectronState(prev => ({
                ...prev,
                isElectron: result.mode === 'electron',
                isInitialized: true,
                platform: result.platform || 'web'
            }));

            return result;
        } catch (error) {
            console.error('Failed to initialize Electron:', error);
            setElectronState(prev => ({
                ...prev,
                error: error.message,
                isInitialized: true
            }));
            throw error;
        }
    }, []);

    /**
     * Get system information
     */
    const getSystemInfo = useCallback(async () => {
        try {
            const info = await electronBridge.getSystemInfo();

            setElectronState(prev => ({
                ...prev,
                systemInfo: info,
                platform: info.platform || prev.platform,
                version: info.version || prev.version
            }));

            return info;
        } catch (error) {
            console.error('Failed to get system info:', error);
            throw error;
        }
    }, []);

    /**
     * Detect network interfaces
     */
    const detectNetworkInterfaces = useCallback(async () => {
        try {
            const result = await electronBridge.detectNetworkInterfaces();
            addIpcEvent('detect-network-interfaces', result);
            return result;
        } catch (error) {
            console.error('Failed to detect network interfaces:', error);
            addIpcEvent('detect-network-interfaces-error', error.message);
            throw error;
        }
    }, []);

    /**
     * Configure network
     */
    const configureNetwork = useCallback(async (config) => {
        try {
            const result = await electronBridge.configureNetwork(config);
            addIpcEvent('configure-network', result);
            return result;
        } catch (error) {
            console.error('Failed to configure network:', error);
            addIpcEvent('configure-network-error', error.message);
            throw error;
        }
    }, []);

    /**
     * Discover peer
     */
    const discoverPeer = useCallback(async () => {
        try {
            const result = await electronBridge.discoverPeer();
            addIpcEvent('discover-peer', result);
            return result;
        } catch (error) {
            console.error('Failed to discover peer:', error);
            addIpcEvent('discover-peer-error', error.message);
            throw error;
        }
    }, []);

    /**
     * Test connection
     */
    const testConnection = useCallback(async (peerIP) => {
        try {
            const result = await electronBridge.testConnection(peerIP);
            addIpcEvent('test-connection', result);
            return result;
        } catch (error) {
            console.error('Failed to test connection:', error);
            addIpcEvent('test-connection-error', error.message);
            throw error;
        }
    }, []);

    /**
     * Select files
     */
    const selectFiles = useCallback(async (options = {}) => {
        try {
            const result = await electronBridge.selectFiles(options);
            addIpcEvent('select-files', result);
            return result;
        } catch (error) {
            console.error('Failed to select files:', error);
            addIpcEvent('select-files-error', error.message);
            throw error;
        }
    }, []);

    /**
     * Transfer files
     */
    const transferFiles = useCallback(async (transferData) => {
        try {
            const result = await electronBridge.transferFiles(transferData);
            addIpcEvent('transfer-files', result);
            return result;
        } catch (error) {
            console.error('Failed to transfer files:', error);
            addIpcEvent('transfer-files-error', error.message);
            throw error;
        }
    }, []);

    /**
     * Cancel transfer
     */
    const cancelTransfer = useCallback(async (transferId) => {
        try {
            const result = await electronBridge.cancelTransfer(transferId);
            addIpcEvent('cancel-transfer', result);
            return result;
        } catch (error) {
            console.error('Failed to cancel transfer:', error);
            addIpcEvent('cancel-transfer-error', error.message);
            throw error;
        }
    }, []);

    /**
     * Open folder
     */
    const openFolder = useCallback(async (path) => {
        try {
            const result = await electronBridge.openFolder(path);
            addIpcEvent('open-folder', result);
            return result;
        } catch (error) {
            console.error('Failed to open folder:', error);
            addIpcEvent('open-folder-error', error.message);
            throw error;
        }
    }, []);

    /**
     * Show notification
     */
    const showNotification = useCallback(async (notification) => {
        try {
            const result = await electronBridge.showNotification(notification);
            addIpcEvent('show-notification', result);
            return result;
        } catch (error) {
            console.error('Failed to show notification:', error);
            addIpcEvent('show-notification-error', error.message);
            throw error;
        }
    }, []);

    /**
     * Add IPC event to log
     */
    const addIpcEvent = useCallback((type, data) => {
        const event = {
            id: Date.now(),
            type,
            data,
            timestamp: new Date(),
            direction: 'outgoing'
        };

        setIpcEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50
    }, []);

    /**
     * Clear IPC events
     */
    const clearIpcEvents = useCallback(() => {
        setIpcEvents([]);
    }, []);

    /**
     * Send IPC message
     */
    const sendIpcMessage = useCallback((channel, ...args) => {
        if (!window.ipcRenderer) {
            console.warn('IPC not available');
            return;
        }

        try {
            window.ipcRenderer.send(channel, ...args);
            addIpcEvent(`send:${channel}`, args);
        } catch (error) {
            console.error(`Failed to send IPC message on ${channel}:`, error);
        }
    }, [addIpcEvent]);

    /**
     * Invoke IPC method
     */
    const invokeIpcMethod = useCallback(async (channel, ...args) => {
        if (!window.ipcRenderer) {
            console.warn('IPC not available');
            throw new Error('IPC not available');
        }

        try {
            addIpcEvent(`invoke:${channel}`, args);
            const result = await window.ipcRenderer.invoke(channel, ...args);
            addIpcEvent(`invoke:${channel}:response`, result);
            return result;
        } catch (error) {
            console.error(`Failed to invoke IPC method on ${channel}:`, error);
            addIpcEvent(`invoke:${channel}:error`, error.message);
            throw error;
        }
    }, [addIpcEvent]);

    /**
     * Set up IPC listener
     */
    const setupIpcListener = useCallback((channel, callback) => {
        if (!window.ipcRenderer) {
            console.warn('IPC not available');
            return () => { };
        }

        const handler = (event, ...args) => {
            addIpcEvent(`receive:${channel}`, args);
            callback(event, ...args);
        };

        window.ipcRenderer.on(channel, handler);

        // Return cleanup function
        return () => {
            if (window.ipcRenderer) {
                window.ipcRenderer.removeListener(channel, handler);
            }
        };
    }, [addIpcEvent]);

    /**
     * Check if feature is available
     */
    const isFeatureAvailable = useCallback((feature) => {
        const availableFeatures = {
            'file-dialog': electronState.isElectron,
            'system-commands': electronState.isElectron,
            'network-config': electronState.isElectron,
            'tcp-sockets': electronState.isElectron,
            'notifications': 'Notification' in window || electronState.isElectron
        };

        return availableFeatures[feature] || false;
    }, [electronState.isElectron]);

    /**
     * Initialize on mount
     */
    useEffect(() => {
        initialize();
        getSystemInfo();

        // Set up IPC listeners for incoming events
        const cleanupListeners = [
            setupIpcListener('network-interfaces-detected', (event, data) => {
                console.log('Network interfaces detected:', data);
            }),

            setupIpcListener('peer-discovered', (event, data) => {
                console.log('Peer discovered:', data);
            }),

            setupIpcListener('transfer-progress', (event, data) => {
                console.log('Transfer progress:', data);
            }),

            setupIpcListener('transfer-complete', (event, data) => {
                console.log('Transfer complete:', data);
            })
        ];

        // Cleanup
        return () => {
            cleanupListeners.forEach(cleanup => cleanup());
            electronBridge.cleanup();
        };
    }, [initialize, getSystemInfo, setupIpcListener]);

    return {
        // State
        electronState,
        ipcEvents,

        // Initialization
        initialize,

        // System
        getSystemInfo,
        isFeatureAvailable,

        // Network
        detectNetworkInterfaces,
        configureNetwork,
        discoverPeer,
        testConnection,

        // Files
        selectFiles,
        transferFiles,
        cancelTransfer,
        openFolder,

        // UI
        showNotification,

        // IPC
        sendIpcMessage,
        invokeIpcMethod,
        setupIpcListener,
        clearIpcEvents,

        // Platform detection
        isElectron: electronState.isElectron,
        isWeb: !electronState.isElectron,
        platform: electronState.platform
    };
};

export default useElectron;