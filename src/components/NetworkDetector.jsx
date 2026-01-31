// src/components/NetworkDetector.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './NetworkDetector.css';

const NetworkDetector = ({ onConnectionUpdate, mode }) => {
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [ipAddress, setIpAddress] = useState('0.0.0.0');
    const [peerIP, setPeerIP] = useState('');
    const [peerName, setPeerName] = useState('');
    const [interfaces, setInterfaces] = useState([]);
    const [progress, setProgress] = useState(0);
    const [discoveryStatus, setDiscoveryStatus] = useState('');
    const [configSteps, setConfigSteps] = useState([
        { id: 1, name: 'Scan interfaces', status: 'pending' },
        { id: 2, name: 'Assign IP', status: 'pending' },
        { id: 3, name: 'Configure network', status: 'pending' },
        { id: 4, name: 'Discover peer', status: 'pending' },
        { id: 5, name: 'Establish connection', status: 'pending' }
    ]);
    const prevWiredConnected = useRef(false);
    const connectionStatusRef = useRef(connectionStatus);
    const ipAddressRef = useRef(ipAddress);
    const connectionTimerRef = useRef(null);

    // Update refs when state changes
    useEffect(() => {
        connectionStatusRef.current = connectionStatus;
    }, [connectionStatus]);

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

        setConnectionStatus('configuring');
        onConnectionUpdate('configuring', '', 0, ipAddressRef.current);
        setProgress(0);

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
        setPeerIP(peer.ip);
        setPeerName(peer.name);

        setConnectionStatus(prevStatus => {
            if (prevStatus === 'connected') return prevStatus;

            console.log('Peer found, updating steps:', peer.ip);
            updateStep(4, 'completed');
            updateStep(5, 'in-progress');

            if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
            connectionTimerRef.current = setTimeout(() => {
                updateStep(5, 'completed');
                setProgress(100);
                setConnectionStatus('connected');
                onConnectionUpdate('connected', peer.ip, 1000, ipAddressRef.current, peer.name);
                connectionTimerRef.current = null;
            }, 300);

            return 'connected';
        });
    }, [onConnectionUpdate, updateStep]);

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
        setPeerIP('');
        setPeerName('');
        setDiscoveryStatus('');
        setConfigSteps(prev =>
            prev.map(step => ({ ...step, status: 'pending' }))
        );
        startAutoConfiguration();
    }, [startAutoConfiguration]);


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

    // Detect network on component mount
    useEffect(() => {
        let bridge;
        import('../services/electronBridge').then(module => {
            bridge = module.default;
            bridge.on('peer-found', handlePeerDiscovered);
            bridge.on('network-interfaces-changed', handleInterfacesChanged);
            bridge.on('discovery-status', handleDiscoveryStatus);

            if (mode === 'sender' || mode === 'receiver') {
                startAutoConfiguration(bridge);
            }
        });

        return () => {
            if (bridge) {
                bridge.off('peer-found', handlePeerDiscovered);
                bridge.off('network-interfaces-changed', handleInterfacesChanged);
                bridge.off('discovery-status', handleDiscoveryStatus);
            }
            if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
        };
    }, [mode, startAutoConfiguration, handlePeerDiscovered, handleInterfacesChanged, handleDiscoveryStatus]);

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
                    Network Configuration
                    <span className="mode-badge">{(mode || 'sender').toUpperCase()}</span>
                </h2>
                <div className="status-badge-container">
                    <div className={`status-badge ${connectionStatus}`}>
                        {connectionStatus.toUpperCase()}
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

            {/* Network Interfaces */}
            <div className="interface-list">
                <h3>Detected Interfaces:</h3>
                {interfaces.length > 0 ? (
                    <div className="interfaces-grid">
                        {interfaces.map(iface => (
                            <div key={iface.id || iface.name} className={`interface-card ${iface.connected ? 'connected' : 'disconnected'}`}>
                                <div className="interface-icon">
                                    {iface.type === 'wired' ? '🔌' : '📡'}
                                </div>
                                <div className="interface-info">
                                    <div className="interface-name">{iface.name}</div>
                                    <div className="interface-type">{iface.type}</div>
                                    <div className="interface-speed">{iface.speed}</div>
                                </div>
                                <div className="interface-status">
                                    {iface.connected ? '✅ Connected' : '❌ Disconnected'}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-interfaces">No network interfaces detected</div>
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

                        {connectionStatus === 'configuring' && !peerIP && (
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
                {connectionStatus === 'connected' && (
                    <div className="connection-info">
                        <div className="info-card success">
                            <div className="info-icon">✅</div>
                            <div className="info-content">
                                <h4>Ready for Transfer!</h4>
                                <p>Secure connection established with <strong>{peerName || peerIP}</strong> at {peerIP}</p>
                                <div className="connection-stats">
                                    <span className="stat-item">⚡ Active</span>
                                    <span className="stat-item">🔒 Secure</span>
                                    <span className="stat-item">📶 Connection Established</span>
                                </div>
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