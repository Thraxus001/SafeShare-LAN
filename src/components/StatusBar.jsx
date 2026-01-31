// src/components/StatusBar.jsx
import React, { useState, useEffect } from 'react';
import './StatusBar.css';

const StatusBar = ({ connection, transferActive, mode, totalTransferred, transfersCount, speed, downloadsDir, onSelectDownloadsDir, peerIP, peerName }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [memoryUsage, setMemoryUsage] = useState(0);

    // Update time and system info
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        // Get real memory usage
        const updateSystemInfo = async () => {
            try {
                const bridge = (await import('../services/electronBridge')).default;
                const info = await bridge.getSystemInfo();
                if (info && info.memory) {
                    const total = info.memory.total;
                    const free = info.memory.free;
                    const used = total - free;
                    const percent = Math.round((used / total) * 100);
                    setMemoryUsage(percent);
                }
            } catch (e) {
                // Fallback or ignore
            }
        };

        const memoryTimer = setInterval(updateSystemInfo, 5000);
        updateSystemInfo(); // Initial call

        return () => {
            clearInterval(timer);
            clearInterval(memoryTimer);
        };
    }, []);

    // Format time
    const formatTime = (date) => {
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Format date
    const formatDate = (date) => {
        return date.toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    // Get connection status color
    const getConnectionColor = () => {
        switch (connection) {
            case 'connected': return '#2ecc71';
            case 'configuring': return '#f39c12';
            case 'disconnected': return '#e74c3c';
            default: return '#95a5a6';
        }
    };

    // Get connection text
    const getConnectionText = () => {
        switch (connection) {
            case 'connected': return 'Connected';
            case 'configuring': return 'Configuring';
            case 'disconnected': return 'Disconnected';
            default: return 'Unknown';
        }
    };

    return (
        <div className="status-bar">
            <div className="status-section left">
                <div className="status-item">
                    <span className="status-label">Status:</span>
                    <div className="connection-status">
                        <div
                            className="status-dot"
                            style={{ backgroundColor: getConnectionColor() }}
                        ></div>
                        <span className="status-text">{getConnectionText()}</span>
                        {connection === 'connected' && (
                            <span className="peer-info-mini" style={{ marginLeft: '8px', opacity: 0.8, fontSize: '0.85em' }}>
                                ({peerName || peerIP})
                            </span>
                        )}
                    </div>
                </div>

                <div className="status-item">
                    <span className="status-label">Mode:</span>
                    <span className="status-value mode">
                        {mode === 'sender' ? '📤 Sender' : '📥 Receiver'}
                    </span>
                </div>

                {transferActive && (
                    <div className="status-item">
                        <span className="status-label">Speed:</span>
                        <span className="status-value speed">
                            ⚡ {Number(speed || 0).toFixed(1)} MB/s
                        </span>
                    </div>
                )}

                <div className="status-item downloads">
                    <span className="status-label">Saving to:</span>
                    <span className="status-value path" title={downloadsDir}>
                        {downloadsDir ? (downloadsDir.length > 25 ? '...' + downloadsDir.slice(-22) : downloadsDir) : 'Not Set'}
                    </span>
                    <button className="change-dir-btn" onClick={onSelectDownloadsDir}>
                        Change
                    </button>
                </div>
            </div>

            <div className="status-section center">
                <div className="app-info">
                    <span className="app-name">EtherLink v1.0</span>
                    <span className="app-separator">•</span>
                    <span className="app-status">
                        {transferActive ? 'Transferring...' : 'Ready'}
                    </span>
                </div>

                {transfersCount > 0 && (
                    <div className="transfer-stats">
                        <span className="stats-item">
                            📦 {transfersCount} transfer{transfersCount !== 1 ? 's' : ''}
                        </span>
                        {totalTransferred > 0 && (
                            <>
                                <span className="stats-separator">•</span>
                                <span className="stats-item">
                                    📊 {formatBytes(totalTransferred)}
                                </span>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="status-section right">
                <div className="status-item">
                    <span className="status-label">Memory:</span>
                    <div className="memory-usage">
                        <div className="memory-bar">
                            <div
                                className="memory-fill"
                                style={{ width: `${memoryUsage}%` }}
                            ></div>
                        </div>
                        <span className="memory-percent">{memoryUsage}%</span>
                    </div>
                </div>

                <div className="status-item">
                    <span className="status-label">Time:</span>
                    <span className="status-value time">
                        {formatTime(currentTime)}
                    </span>
                </div>

                <div className="status-item">
                    <span className="status-label">Date:</span>
                    <span className="status-value date">
                        {formatDate(currentTime)}
                    </span>
                </div>
            </div>
        </div>
    );
};

// Helper function to format bytes
const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default StatusBar;