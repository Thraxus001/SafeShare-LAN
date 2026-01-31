// src/components/App.js
import React, { useState, useEffect } from 'react';
import NetworkDetector from './NetworkDetector';
import FileTransfer from './FileTransfer';
import TerminalInterface from './TerminalInterface';
import StatusBar from './StatusBar';
import ConnectionLog from './ConnectionLog';
import TransferQueue from './TransferQueue';
import './App.css';

const App = () => {
    // Global state
    const [appState, setAppState] = useState({
        connection: 'disconnected',
        localIP: '0.0.0.0',
        peerIP: '',
        peerName: '',
        transferActive: false,
        mode: 'sender',
        speed: 0,
        totalTransferred: 0,
        downloadsDir: ''
    });

    const [transfers, setTransfers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [activeTransfer, setActiveTransfer] = useState(null);
    const peerIPRef = React.useRef(appState.peerIP);

    // Sync ref
    useEffect(() => {
        peerIPRef.current = appState.peerIP;
    }, [appState.peerIP]);

    // Initialize logs
    useEffect(() => {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const initialLogs = [
            { id: `log_init_1_${Date.now()}`, type: 'system', message: 'SafeShare LAN v1.0 initialized', timestamp: now, time: timeString },
            { id: `log_init_2_${Date.now()}`, type: 'system', message: 'Ready to detect network connections', timestamp: now, time: timeString }
        ];
        setLogs(initialLogs);
    }, []);

    // Add log entry
    const addLog = (type, message) => {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const newLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type,
            message,
            timestamp: now,
            time: timeString
        };
        setLogs(prev => [newLog, ...prev.slice(0, 49)]); // Keep last 50 logs
    };

    // Handle connection updates from NetworkDetector
    const handleConnectionUpdate = React.useCallback((status, ip, speed = 0, localIP = null, peerName = '') => {
        setAppState(prev => {
            const updates = {
                connection: status,
                peerIP: ip,
                peerName: peerName || prev.peerName,
                speed: speed
            };
            if (localIP) updates.localIP = localIP;

            if (prev.connection === status && prev.peerIP === ip && prev.peerName === updates.peerName && prev.speed === speed && (!localIP || prev.localIP === localIP)) return prev;
            return {
                ...prev,
                ...updates
            };
        });

        const statusMessages = {
            'scanning': 'Scanning for network interfaces...',
            'configuring': 'Configuring network settings...',
            'connected': `Connected to ${peerName || ip}`,
            'disconnected': 'Disconnected from peer',
            'error': 'Connection error occurred'
        };

        addLog('network', statusMessages[status] || `Connection status: ${status}`);
    }, []);

    // Initialize bridge listeners
    useEffect(() => {
        import('../services/electronBridge').then(module => {
            const bridge = module.default;

            const handleTransferProgress = (data) => {
                setTransfers(prev => {
                    const existingIndex = prev.findIndex(t => t.id === data.transferId);

                    if (existingIndex > -1) {
                        return prev.map((t, i) => {
                            if (i !== existingIndex) return t;

                            const updatedFiles = t.files ? t.files.map(f =>
                                f.name === data.filename ? { ...f, progress: data.progress, status: 'transferring' } : f
                            ) : [{ name: data.filename, size: data.total, progress: data.progress, status: 'transferring' }];

                            return {
                                ...t,
                                status: 'transferring',
                                progress: data.progress,
                                speed: data.speed || t.speed,
                                files: updatedFiles
                            };
                        });
                    } else if (data.status === 'starting' || data.status === 'receiving' || data.status === 'sending' || data.status === 'connecting') {
                        // New transfer entry
                        const newTransfer = {
                            id: data.transferId || `transfer_${Date.now()}`,
                            files: [{ name: data.filename, size: data.total, progress: data.progress || 0, status: 'transferring' }],
                            status: 'transferring',
                            progress: data.progress || 0,
                            startTime: new Date(),
                            peerIP: data.peerIP || peerIPRef.current,
                            speed: data.speed || 0
                        };
                        addLog('transfer', `${data.status === 'sending' ? 'Sending' : 'Receiving'}: ${data.filename}`);
                        return [newTransfer, ...prev];
                    }
                    return prev;
                });

                // No longer calling setAppState here, synced via useEffect
            };

            const handleTransferComplete = (data) => {
                setTransfers(prev => {
                    const exists = prev.some(t => t.id === data.transferId);
                    if (!exists) {
                        const newTransfer = {
                            id: data.transferId,
                            files: [{ name: data.filename, size: data.total || 0, progress: 100, status: 'completed' }],
                            status: 'completed',
                            progress: 100,
                            startTime: new Date(),
                            endTime: new Date(),
                            peerIP: data.peerIP || peerIPRef.current,
                            speed: 0,
                            path: data.path
                        };
                        return [newTransfer, ...prev];
                    }

                    const updated = prev.map(t => {
                        if (t.id !== data.transferId) return t;

                        const updatedFiles = t.files.map(f =>
                            f.name === data.filename ? { ...f, status: 'completed', progress: 100 } : f
                        );

                        const allCompleted = updatedFiles.every(f => f.status === 'completed');

                        return {
                            ...t,
                            files: updatedFiles,
                            status: allCompleted ? 'completed' : 'transferring',
                            progress: allCompleted ? 100 : t.progress,
                            endTime: allCompleted ? new Date() : t.endTime,
                            path: data.path || t.path
                        };
                    });

                    return updated;
                });
                addLog('success', `Transfer completed: ${data.filename}`);
            };

            bridge.on('transfer-progress', handleTransferProgress);
            bridge.on('transfer-complete', handleTransferComplete);

            // Fetch initial downloads directory
            bridge.getDownloadDirectory().then(result => {
                if (result.success) {
                    setAppState(prev => ({ ...prev, downloadsDir: result.path }));
                }
            });
        });
    }, [addLog]); // Added addLog to deps for completeness

    // Sync appState and activeTransfer with transfers array
    useEffect(() => {
        const activeT = transfers.find(t => t.status === 'transferring' || t.status === 'connecting');
        const isAnyActive = transfers.some(t => t.status === 'transferring' || t.status === 'queued' || t.status === 'connecting');
        const totalSpeed = transfers.reduce((sum, t) => sum + (t.status === 'transferring' ? Number(t.speed) || 0 : 0), 0);

        setActiveTransfer(activeT || null);
        setAppState(prev => {
            if (prev.transferActive === isAnyActive && prev.speed === totalSpeed) return prev;
            return {
                ...prev,
                transferActive: isAnyActive,
                speed: totalSpeed
            };
        });
    }, [transfers]);

    // Cleanup when changing mode
    useEffect(() => {
        // When switching modes, if we have active transfers, we might want to warn
        // or clear them if they are mode-specific. For now, let's just log.
        addLog('system', `Switched to ${appState.mode} mode`);
    }, [appState.mode]);

    // Handle file transfer start
    const handleTransferStart = async (transferData) => {
        const newTransfer = {
            id: `send_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            ...transferData,
            status: 'queued',
            startTime: new Date(),
            progress: 0,
            speed: 0
        };

        setTransfers(prev => [newTransfer, ...prev]);
        setActiveTransfer(newTransfer);
        setAppState(prev => ({ ...prev, transferActive: true }));

        addLog('transfer', `Transfer queued: ${transferData.files.length} file(s)`);

        try {
            const bridge = (await import('../services/electronBridge')).default;
            await bridge.transferFiles({
                ...transferData,
                transferId: newTransfer.id
            });
        } catch (e) {
            addLog('error', `Transfer failed: ${e.message}`);
            setTransfers(prev => prev.map(t => t.id === newTransfer.id ? { ...t, status: 'failed' } : t));
        }
    };

    // Handle transfer actions (cancel, pause, resume, open)
    const handleTransferAction = async (transferId, action) => {
        try {
            const bridge = (await import('../services/electronBridge')).default;

            switch (action) {
                case 'cancel':
                    await bridge.cancelTransfer(transferId);
                    addLog('system', `Cancelled transfer ${transferId}`);
                    setTransfers(prev => prev.map(t =>
                        t.id === transferId ? { ...t, status: 'cancelled' } : t
                    ));
                    if (activeTransfer && activeTransfer.id === transferId) {
                        setActiveTransfer(null);
                        setAppState(prev => ({ ...prev, transferActive: false }));
                    }
                    break;

                case 'pause':
                    await bridge.pauseTransfer(transferId);
                    addLog('system', `Paused transfer ${transferId}`);
                    setTransfers(prev => prev.map(t =>
                        t.id === transferId ? { ...t, status: 'paused' } : t
                    ));
                    break;

                case 'start':
                case 'resume':
                    await bridge.resumeTransfer(transferId);
                    addLog('system', `${action === 'start' ? 'Started' : 'Resumed'} transfer ${transferId}`);
                    setTransfers(prev => prev.map(t =>
                        t.id === transferId ? { ...t, status: 'transferring' } : t
                    ));
                    break;

                case 'open':
                    // Find the transfer to get the path
                    const transfer = transfers.find(t => t.id === transferId);
                    const pathToShow = transfer?.path || transfer?.files?.[0]?.path;
                    if (pathToShow) {
                        await bridge.openFolder(pathToShow);
                    } else {
                        addLog('error', 'Could not find path for this transfer');
                    }
                    break;

                default:
                    console.warn(`Unknown action: ${action}`);
            }
        } catch (e) {
            addLog('error', `Failed to ${action} transfer: ${e.message}`);
        }
    };


    // Handle download directory selection
    const handleSelectDownloadsDir = async () => {
        try {
            const bridge = (await import('../services/electronBridge')).default;
            const result = await bridge.selectDownloadDirectory();
            if (result.success && result.path) {
                const saveResult = await bridge.setDownloadDirectory(result.path);
                if (saveResult.success) {
                    setAppState(prev => ({ ...prev, downloadsDir: result.path }));
                    addLog('system', `Downloads directory changed to: ${result.path}`);
                }
            }
        } catch (e) {
            addLog('error', `Failed to change downloads directory: ${e.message}`);
        }
    };

    // Clear all transfers
    const clearTransfers = () => {
        setTransfers([]);
        setActiveTransfer(null);
        addLog('system', 'Transfer queue cleared');
    };

    // Clear all logs
    const clearLogs = () => {
        setLogs([]);
        addLog('system', 'Logs cleared');
    };

    return (
        <div className="app">
            {/* Header */}
            <header className="app-header">
                <div className="header-left">
                    <h1 className="app-title">
                        <span className="app-icon">🔗</span>
                        SafeShare
                        <span className="app-version">v1.0</span>
                    </h1>
                    <p className="app-tagline">
                        Direct Ethernet File Transfer • No Configuration Needed • Offline Operation
                    </p>
                </div>

                <div className="header-right">
                    <div className="mode-toggle">
                        <button
                            className={`mode-btn ${appState.mode === 'sender' ? 'active' : ''}`}
                            onClick={() => setAppState(prev => ({ ...prev, mode: 'sender' }))}
                        >
                            <span className="mode-icon">📤</span>
                            Sender
                        </button>
                        <button
                            className={`mode-btn ${appState.mode === 'receiver' ? 'active' : ''}`}
                            onClick={() => setAppState(prev => ({ ...prev, mode: 'receiver' }))}
                        >
                            <span className="mode-icon">📥</span>
                            Receiver
                        </button>
                    </div>

                    <div className="connection-status-header">
                        <div className={`status-dot ${appState.connection}`}></div>
                        <div className="status-info">
                            <span className="status-text">
                                {appState.connection === 'connected'
                                    ? `Connected to ${appState.peerIP}`
                                    : (typeof appState.connection === 'string' && appState.connection.length > 0
                                        ? appState.connection.charAt(0).toUpperCase() + appState.connection.slice(1)
                                        : 'Disconnected')
                                }
                            </span>
                            {appState.speed > 0 && (
                                <span className="status-speed">⚡ {appState.speed} MB/s</span>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="app-main">
                {/* Top Section: Network Detection & Transfer Queue */}
                <section className="section-top">
                    <div className="layout-cell">
                        <NetworkDetector
                            onConnectionUpdate={handleConnectionUpdate}
                            mode={appState.mode}
                        />
                    </div>
                    <div className="layout-cell">
                        <TransferQueue
                            transfers={transfers}
                            clearTransfers={clearTransfers}
                            activeTransfer={activeTransfer}
                            onTransferAction={handleTransferAction}
                        />
                    </div>
                </section>

                {/* Middle Section: File Transfer & Terminal */}
                <section className="section-middle">
                    <div className="left-panel">
                        <FileTransfer
                            connectionStatus={appState.connection}
                            peerIP={appState.peerIP}
                            mode={appState.mode}
                            onTransferStart={handleTransferStart}
                            activeTransfer={activeTransfer}
                            history={transfers}
                        />
                    </div>

                    <div className="right-panel">
                        <TerminalInterface
                            addLog={addLog}
                            connectionStatus={appState.connection}
                            peerIP={appState.peerIP}
                            localIP={appState.localIP}
                            speed={appState.speed}
                        />
                    </div>
                </section>

                {/* Bottom Section: Logs */}
                <section className="section-bottom">
                    <div className="layout-cell full-width">
                        <ConnectionLog
                            logs={logs}
                            clearLogs={clearLogs}
                        />
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <StatusBar
                    connection={appState.connection}
                    mode={appState.mode}
                    transferActive={appState.transferActive}
                    transfersCount={transfers.filter(t => t.status !== 'completed').length}
                    totalTransferred={appState.totalTransferred}
                    speed={appState.speed}
                    downloadsDir={appState.downloadsDir}
                    onSelectDownloadsDir={handleSelectDownloadsDir}
                    peerIP={appState.peerIP}
                    peerName={appState.peerName}
                />
            </footer>
        </div>
    );
};

export default App;