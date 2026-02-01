// src/components/NetworkDetector.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './NetworkDetector.css';

const NetworkDetector = ({ onConnectionUpdate, mode, isBroadcast, onToggleBroadcast, selectedPeers, onSelectPeers }) => {
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [ipAddress, setIpAddress] = useState('0.0.0.0');
    const [discoveredPeers, setDiscoveredPeers] = useState([]);
    const [interfaces, setInterfaces] = useState([]);
    const [progress, setProgress] = useState(0);
    const [discoveryStatus, setDiscoveryStatus] = useState('');
    const [configSteps, setConfigSteps] = useState([
        { id: 1, name: 'Scan interfaces', status: 'pending' },
        { id: 2, name: 'Assign IP', status: 'pending' },
        { id: 3, name: 'Configure network', status: 'pending' },
        { id: 4, name: 'Discover devices', status: 'pending' }
    ]);
    const prevWiredConnected = useRef(false);
    const connectionStatusRef = useRef(connectionStatus);
    const ipAddressRef = useRef(ipAddress);
    const connectionTimerRef = useRef(null);
    const lastEmittedStatus = useRef('');
    const lastPeerCount = useRef(0);
    const discoveredPeersRef = useRef([]); // Critical for effect stability

    // Update refs when state changes
    useEffect(() => {
        connectionStatusRef.current = connectionStatus;
    }, [connectionStatus]);

    useEffect(() => {
        discoveredPeersRef.current = discoveredPeers;
    }, [discoveredPeers]);

    useEffect(() => {
        ipAddressRef.current = ipAddress;
    }, [ipAddress]);

    // --- Helper Functions ---

    // Update configuration step status
    const updateStep = useCallback((stepId, status) => {
        setConfigSteps(prev =>
            prev.map(step =>
                step.id === stepId ? { ...step, status } : step
            )
        );
    }, []);

    // Helper to get best valid IP
    const getValidIP = useCallback((interfaces) => {
        if (!interfaces || !Array.isArray(interfaces)) return '127.0.0.1';

        // 1. Try to find a connected IPv4 external address
        const external = interfaces.find(i => i.connected && i.addresses && i.addresses.length > 0)
            ?.addresses.find(a => a.family === 'IPv4' && !a.internal)?.address;

        if (external) return external;

        // 2. Fallback: Any IPv4 address (including internal/loopback)
        const internal = interfaces.find(i => i.addresses && i.addresses.length > 0)
            ?.addresses.find(a => a.family === 'IPv4')?.address;

        return internal || '127.0.0.1';
    }, []);

    // Real network detection
    const detectNetworkInterfaces = useCallback(async (bridge) => {
        updateStep(1, 'in-progress');
        try {
            const result = await bridge.detectNetworkInterfaces();
            const interfacesList = Array.isArray(result) ? result : (result?.interfaces || []);
            setInterfaces(interfacesList);
            updateStep(1, 'completed');

            // Find a valid IP to display
            const validIP = getValidIP(interfacesList);
            setIpAddress(validIP);

            return interfacesList; // Fixed: Use local variable instead of state
        } catch (error) {
            console.error('Network detection failed:', error);
            updateStep(1, 'failed');
            // Fallback to localhost on error
            setIpAddress('127.0.0.1');
            return [];
        }
    }, [updateStep, getValidIP]);

    // Auto-configure network
    const startAutoConfiguration = useCallback(async (bridgeInstance) => {
        const bridge = bridgeInstance || (await import('../services/electronBridge')).default;

        setConnectionStatus('scanning');
        setProgress(10);

        // Step 1: Detect interfaces
        await detectNetworkInterfaces(bridge);

        // Step 2 & 3: IP and Config
        updateStep(2, 'in-progress');
        updateStep(3, 'in-progress');

        try {
            // Real network configuration (firewall, etc)
            await bridge.configureNetwork({
                mode: mode,
                ports: [9000, 9001]
            });
            updateStep(2, 'completed');
            updateStep(3, 'completed');
        } catch (error) {
            console.warn('Network configuration warning:', error);
            // Mark as completed anyway to allow peer discovery to try
            updateStep(2, 'completed');
            updateStep(3, 'completed');
        }

        setProgress(60);
        setConnectionStatus('scanning'); // Trigger back to scanning for peer discovery

        // Step 4: Discover peer
        updateStep(4, 'in-progress');
        try {
            await bridge.discoverPeer();
            // Wait for 'peer-found' event
        } catch (e) {
            console.error('Discovery failed', e);
            updateStep(4, 'failed');
        }
    }, [mode, onConnectionUpdate, detectNetworkInterfaces, updateStep]);

    // Moved out of useEffect to be accessible in JSX
    const handlePeerDiscovered = useCallback((peer) => {
        setDiscoveredPeers(prev => {
            const exists = prev.find(p => p.ip === peer.ip);
            if (exists && exists.name === peer.name) return prev;

            const newList = exists
                ? prev.map(p => p.ip === peer.ip ? peer : p)
                : [...prev, peer];

            return newList;
        });

        updateStep(4, 'completed');
        setProgress(100);
        setConnectionStatus('connected');
    }, [updateStep]);

    // Auto-select first peer ONLY when peers change AND none are selected
    useEffect(() => {
        if (discoveredPeers.length > 0 && selectedPeers.length === 0) {
            onSelectPeers([discoveredPeers[0].ip]);
        }
    }, [discoveredPeers.length, selectedPeers.length, onSelectPeers]);

    useEffect(() => {
        // Sync with App state - providing current IP and name for legacy compatibility if needed
        // Only trigger update if status or peer count changed to avoid redundant loops
        if (connectionStatus !== lastEmittedStatus.current || discoveredPeers.length !== lastPeerCount.current) {
            onConnectionUpdate(connectionStatus, discoveredPeers[0]?.ip || '', 0, ipAddress, discoveredPeers[0]?.name || '', discoveredPeers);
            lastEmittedStatus.current = connectionStatus;
            lastPeerCount.current = discoveredPeers.length;
        }
    }, [connectionStatus, discoveredPeers, ipAddress, onConnectionUpdate]);

    // Manual connect with verification
    const handleManualConnect = useCallback(async (ip) => {
        if (!ip) return;

        setDiscoveryStatus(`Verifying ${ip}...`);
        try {
            const bridge = (await import('../services/electronBridge')).default;
            const result = await bridge.testConnection(ip);

            if (result.success) {
                handlePeerDiscovered({ ip: ip, name: 'Manual Connection' });
            } else {
                setDiscoveryStatus(`Could not reach ${ip}. Check IP and firewall.`);
                setTimeout(() => setDiscoveryStatus(''), 3000);
            }
        } catch (err) {
            console.error('Manual connection failed:', err);
            setDiscoveryStatus('Verification failed.');
        }
    }, [handlePeerDiscovered]);

    // Manual scan
    const handleManualScan = useCallback(() => {
        setDiscoveredPeers([]);
        onSelectPeers([]);
        setDiscoveryStatus('');
        setConfigSteps(prev =>
            prev.map(step => ({ ...step, status: 'pending' }))
        );
        startAutoConfiguration();
    }, [startAutoConfiguration, onSelectPeers]);


    const handleInterfacesChanged = useCallback((interfaces) => {
        console.log('Network interfaces changed, checking for new connection...');
        setInterfaces(interfaces);

        const wiredConnected = interfaces.some(i => i.type === 'wired' && i.connected);

        // Only trigger if we transition from NOT connected to connected
        if (wiredConnected && !prevWiredConnected.current &&
            connectionStatusRef.current !== 'connected' && connectionStatusRef.current !== 'configuring') {
            console.log('New wired connection detected, auto-scanning...');
            handleManualScan();
        }

        prevWiredConnected.current = wiredConnected;
    }, [handleManualScan]);

    const handleDiscoveryStatus = useCallback((data) => {
        if (data.status === 'advanced-scanning') {
            setDiscoveryStatus('UDP blocked. Trying advanced subnet scan...');
        } else if (data.status === 'idle') {
            setDiscoveryStatus('Discovery idle. Try rescan if no peers found.');
        } else {
            setDiscoveryStatus('');
        }
    }, []);

    // --- Main Effect ---

    // Detect network on component mount - Listeners set up ONCE
    useEffect(() => {
        let bridge;

        // Use a wrapper to always use the freshest ref
        const onPeer = (peer) => handlePeerDiscovered(peer);
        const onIface = (ifaces) => handleInterfacesChanged(ifaces);
        const onDiscovery = (status) => handleDiscoveryStatus(status);

        import('../services/electronBridge').then(module => {
            bridge = module.default;
            bridge.on('peer-found', onPeer);
            bridge.on('network-interfaces-changed', onIface);
            bridge.on('discovery-status', onDiscovery);

            if (mode === 'sender' || mode === 'receiver') {
                startAutoConfiguration(bridge);
            }
        });

        return () => {
            if (bridge) {
                bridge.off('peer-found', onPeer);
                bridge.off('network-interfaces-changed', onIface);
                bridge.off('discovery-status', onDiscovery);
            }
            if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
        };
        // Dependency array MUST be stable to prevent listener re-registration thrashing
    }, []); // Run once on mount

    // Get status icon
    const getStatusIcon = useCallback((status) => {
        switch (status) {
            case 'completed': return '✅';
            case 'in-progress': return '🔄';
            case 'failed': return '❌';
            default: return '⏳';
        }
    }, []);

    // Get status color
    const getStatusColor = useCallback((status) => {
        switch (status) {
            case 'completed': return 'var(--success-color)';
            case 'in-progress': return 'var(--warning-color)';
            case 'failed': return 'var(--error-color)';
            default: return 'var(--text-secondary)';
        }
    }, []);

    return (
        <div className="network-detector">
            <div className="detector-header">
                <h2>
                    <span className="header-icon">🌐</span>
                    Devices on Network
                    <span className="mode-badge">{(mode || 'sender').toUpperCase()}</span>
                </h2>
                <div className="discovery-actions">
                    <div className={`broadcast-toggle ${isBroadcast ? 'active' : ''}`} onClick={onToggleBroadcast}>
                        <span className="toggle-icon">{isBroadcast ? '📻' : '🔘'}</span>
                        <span className="toggle-label">Broadcast Mode</span>
                        <div className="toggle-switch">
                            <div className="toggle-handle"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="config-progress">
                <div className="progress-header">
                    <span>Auto-configuration Progress</span>
                    <span className="progress-percent">{progress}%</span>
                </div>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            {/* Configuration Steps */}
            <div className="config-steps">
                <h3>Configuration Steps:</h3>
                <div className="steps-list">
                    {configSteps.map(step => (
                        <div key={step.id} className="step-item">
                            <div className="step-icon" style={{ color: getStatusColor(step.status) }}>
                                {getStatusIcon(step.status)}
                            </div>
                            <div className="step-content">
                                <div className="step-name">{step.name}</div>
                                <div className="step-status">{step.status}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Connected Devices List */}
            <div className="interface-list">
                <h3>Connected Devices (Select to Send):</h3>
                {discoveredPeers.length > 0 ? (
                    <div className="peers-grid">
                        {discoveredPeers.map(peer => (
                            <div
                                key={peer.ip}
                                className={`peer-card ${selectedPeers.includes(peer.ip) ? 'selected' : ''}`}
                                onClick={() => {
                                    if (selectedPeers.includes(peer.ip)) {
                                        onSelectPeers(selectedPeers.filter(ip => ip !== peer.ip));
                                    } else {
                                        onSelectPeers([...selectedPeers, peer.ip]);
                                    }
                                }}
                            >
                                <div className="peer-checkbox">
                                    <input type="checkbox" checked={selectedPeers.includes(peer.ip)} readOnly />
                                </div>
                                <div className="peer-icon">💻</div>
                                <div className="peer-info">
                                    <div className="peer-name">{peer.name}</div>
                                    <div className="peer-ip">{peer.ip}</div>
                                </div>
                                <div className="peer-status">
                                    {selectedPeers.includes(peer.ip) ? '🎯 Target' : 'READY'}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-interfaces">Scanning for devices...</div>
                )}
            </div>

            {/* IP Configuration */}
            <div className="ip-configuration">
                <div className="ip-display">
                    <div className="ip-item">
                        <span className="ip-label">Local IP:</span>
                        <span className="ip-value">{ipAddress}</span>
                    </div>

                    <div className="discovery-status-text">
                        {discoveryStatus && (
                            <div className="discovery-msg-active">
                                <span className="scanning-loader"></span>
                                {discoveryStatus}
                            </div>
                        )}

                        {connectionStatus === 'configuring' && discoveredPeers.length === 0 && (
                            <div className="manual-connect">
                                <p>Taking too long? Enter Peer IP manually:</p>
                                <div className="manual-input-group">
                                    <input
                                        type="text"
                                        placeholder="192.168.1.XX"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleManualConnect(e.target.value);
                                            }
                                        }}
                                    />
                                    <button onClick={(e) => {
                                        const input = e.target.parentElement.querySelector('input');
                                        handleManualConnect(input.value);
                                    }}>Connect</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Connection Info */}
                {discoveredPeers.length > 0 && (
                    <div className="connection-info">
                        <div className="info-card success">
                            <div className="info-icon">📡</div>
                            <div className="info-content">
                                <h4>{isBroadcast ? 'Full-Duplex Mode Active' : 'Devices Found'}</h4>
                                <p>Discovered <strong>{discoveredPeers.length}</strong> devices. {isBroadcast ? 'Ready to send/receive simultaneously.' : 'Select targets above to start sharing.'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="action-buttons">
                    <button
                        className="btn btn-primary"
                        onClick={handleManualScan}
                        disabled={connectionStatus === 'configuring'}
                    >
                        {connectionStatus === 'configuring' ? 'Configuring...' : '🔄 Rescan Network'}
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={() => setConnectionStatus('disconnected')}
                    >
                        ⏹️ Disconnect
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NetworkDetector;