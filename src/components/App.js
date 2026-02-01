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
        isBroadcast: false,
        speed: 0,
        totalTransferred: 0,
        downloadsDir: '',
        peers: [], // All discovered peers
        selectedPeers: [] // IPs of selected peers for sending
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
            { id: `log_init_1_${Date.now()}`, type: 'system', message: 'SafeShare LAN v2.0 initialized', timestamp: now, time: timeString },
            { id: `log_init_2_${Date.now()}`, type: 'system', message: 'Ready to detect network connections', timestamp: now, time: timeString }
        ];
        setLogs(initialLogs);
    }, []);

    // Add log entry
    const addLog = React.useCallback((type, message) => {
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
    }, []);

    // Handle connection updates from NetworkDetector
    const handleConnectionUpdate = React.useCallback((status, ip, speed = 0, localIP = null, peerName = '', allPeers = []) => {
        let statusChanged = false;

        setAppState(prev => {
            const updates = {
                connection: status,
                peerIP: ip || (allPeers.length > 0 ? allPeers[0].ip : prev.peerIP),
                peerName: peerName || (allPeers.length > 0 ? allPeers[0].name : prev.peerName),
                peers: allPeers,
                speed: speed
            };
            if (localIP) updates.localIP = localIP;

            if (prev.connection !== status) {
                statusChanged = true;
            }

            return {
                ...prev,
                ...updates
            };
        });

        if (statusChanged) {
            const statusMessages = {
                'scanning': 'Scanning for devices...',
                'configuring': 'Configuring network settings...',
                'connected': `Connected and ready`,
                'disconnected': 'Disconnected',
                'error': 'Connection error occurred'
            };

            addLog('network', statusMessages[status] || `Connection status: ${status}`);
        }
    }, [addLog]);

    // Initialize bridge listeners
    useEffect(() => {
        let bridge;

        const handleTransferProgress = (data) => {
            // Determine if this is a new transfer we haven't seen yet
            setTransfers(prev => {
                const index = prev.findIndex(t => t.id === data.transferId);
                if (index !== -1) {
                    return prev.map((t, i) => {
                        if (i !== index) return t;

                        // Update files progress
                        const updatedFiles = t.files.map(f =>
                            f.name === data.filename ? {
                                ...f,
                                progress: data.progress,
                                status: data.status === 'connecting' ? 'transferring' : (data.status || 'transferring'),
                                size: data.total || f.size
                            } : f
                        );

                        return {
                            ...t,
                            status: data.status === 'connecting' ? 'transferring' : (data.status || 'transferring'),
                            progress: data.progress,
                            speed: data.speed || t.speed,
                            peerIP: data.peerIP || t.peerIP,
                            peerName: data.senderName || t.peerName,
                            size: data.total || t.size,
                            files: updatedFiles
                        };
                    });
                } else {
                    // New transfer (likely incoming)
                    const newTransfer = {
                        id: data.transferId || `transfer_${Date.now()}`,
                        name: data.filename || 'Incoming File',
                        files: [{
                            name: data.filename,
                            size: data.total,
                            progress: data.progress || 0,
                            status: data.status || 'transferring'
                        }],
                        size: data.total || 0,
                        status: data.status || 'transferring',
                        progress: data.progress || 0,
                        startTime: new Date(),
                        peerIP: data.peerIP || peerIPRef.current,
                        peerName: data.senderName || '',
                        speed: data.speed || 0,
                        isIncoming: data.status === 'receiving' || data.status === 'connecting'
                    };

                    setTimeout(() => {
                        addLog('transfer', `${newTransfer.isIncoming ? 'Receiving from' : 'Sending to'} ${data.senderName || data.peerIP || 'peer'}: ${data.filename}`);
                    }, 0);

                    return [newTransfer, ...prev];
                }
            });
        };

        const handleTransferComplete = (data) => {
            setTransfers(prev => {
                const exists = prev.some(t => t.id === data.transferId);
                if (!exists) {
                    const newTransfer = {
                        id: data.transferId,
                        files: [{ name: data.filename, size: data.total || 0, progress: 100, status: 'completed' }],
                        size: data.total || 0,
                        status: 'completed',
                        progress: 100,
                        startTime: new Date(),
                        endTime: new Date(),
                        peerIP: data.peerIP || peerIPRef.current,
                        peerName: data.senderName || '',
                        speed: 0,
                        isIncoming: true // If it wasn't tracked before, it's likely an incoming file we just finished
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

        const handleTransferError = (data) => {
            setTransfers(prev => prev.map(t => {
                if (t.id !== data.transferId) return t;
                return {
                    ...t,
                    status: 'failed',
                    error: data.error
                };
            }));
            addLog('error', `Transfer failed: ${data.error || 'Unknown error'}`);
        };

        const setupBridge = async () => {
            const module = await import('../services/electronBridge');
            bridge = module.default;

            bridge.on('transfer-progress', handleTransferProgress);
            bridge.on('transfer-complete', handleTransferComplete);
            bridge.on('transfer-error', handleTransferError);

            // Fetch initial downloads directory ONLY ONCE
            const dirResult = await bridge.getDownloadDirectory();
            if (dirResult.success) {
                setAppState(prev => ({ ...prev, downloadsDir: dirResult.path }));
            }
        };

        setupBridge();

        return () => {
            if (bridge) {
                bridge.off('transfer-progress', handleTransferProgress);
                bridge.off('transfer-complete', handleTransferComplete);
                bridge.off('transfer-error', handleTransferError);
            }
        };
    }, [addLog]); // Run once on mount

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

    const handleToggleBroadcast = React.useCallback(() => {
        setAppState(prev => ({ ...prev, isBroadcast: !prev.isBroadcast }));
    }, []);

    const handleSelectPeers = React.useCallback((peers) => {
        setAppState(prev => ({ ...prev, selectedPeers: peers }));
    }, []);

    // Cleanup when changing mode
    useEffect(() => {
        // When switching modes, if we have active transfers, we might want to warn
        // or clear them if they are mode-specific. For now, let's just log.
        addLog('system', `Switched to ${appState.mode} mode`);
    }, [appState.mode]);

    // Handle file transfer start
    const handleTransferStart = async (transferData) => {
        const targetPeers = appState.isBroadcast ? appState.selectedPeers : [appState.peerIP];

        if (targetPeers.length === 0) {
            addLog('error', 'No target peers selected');
            return;
        }

        const baseId = `send_${Date.now()}`;
        const newTransfers = targetPeers.map(peerIP => ({
            id: `${baseId}_${peerIP.replace(/\./g, '_')}`,
            ...transferData,
            name: transferData.files.length === 1 ? transferData.files[0].name : `${transferData.files.length} file(s)`,
            peerIP,
            status: 'transferring',
            startTime: new Date(),
            progress: 0,
            speed: 0,
            isIncoming: false
        }));

        setTransfers(prev => [...newTransfers, ...prev]);
        setActiveTransfer(newTransfers[0]); // Show the first one as active
        setAppState(prev => ({ ...prev, transferActive: true }));

        addLog('transfer', `Initiating transfer to ${targetPeers.length} device(s)`);

        try {
            const bridge = (await import('../services/electronBridge')).default;

            addLog('system', 'System Diagnosis: Link stable. Ready for audio, video, and document broadcast.');

            await Promise.all(targetPeers.map(peerIP => {
                const transferId = `${baseId}_${peerIP.replace(/\./g, '_')}`;
                return bridge.transferFiles({
                    ...transferData,
                    peerIP,
                    transferId
                });
            }));
        } catch (e) {
            addLog('error', `Transfer failed: ${e.message}`);
            const affectedIds = newTransfers.map(t => t.id);
            setTransfers(prev => prev.map(t =>
                affectedIds.includes(t.id) ? { ...t, status: 'failed' } : t
            ));
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
                        <span className="app-version">v2.0</span>
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
                                {appState.isBroadcast ? 'Full-Duplex Mode' :
                                    (appState.connection === 'connected'
                                        ? `Connected (${appState.peers.length} devices)`
                                        : (typeof appState.connection === 'string' && appState.connection.length > 0
                                            ? appState.connection.charAt(0).toUpperCase() + appState.connection.slice(1)
                                            : 'Disconnected'))
                                }
                            </span>
                            {appState.speed > 0 && (
                                <span className="status-speed">⚡ {appState.speed.toFixed(1)} MB/s</span>
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
                            isBroadcast={appState.isBroadcast}
                            onToggleBroadcast={handleToggleBroadcast}
                            selectedPeers={appState.selectedPeers}
                            onSelectPeers={handleSelectPeers}
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
                            selectedPeers={appState.selectedPeers}
                            isBroadcast={appState.isBroadcast}
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