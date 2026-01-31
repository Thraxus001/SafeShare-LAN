// src/components/ConnectionLog.jsx
import React, { useState, useEffect, useRef } from 'react';
import './ConnectionLog.css';

const ConnectionLog = ({ logs, clearLogs }) => {
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredLogs, setFilteredLogs] = useState([]);
    const logEndRef = useRef(null);

    // Filter logs based on filter and search
    useEffect(() => {
        let result = logs;

        // Apply type filter
        if (filter !== 'all') {
            result = result.filter(log => log.type === filter);
        }

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(log =>
                log.message.toLowerCase().includes(term) ||
                log.time.toLowerCase().includes(term)
            );
        }

        setFilteredLogs(result);
    }, [logs, filter, searchTerm]);

    // Scroll to bottom when logs update
    useEffect(() => {
        scrollToBottom();
    }, [filteredLogs]);

    const scrollToBottom = () => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Get log icon based on type
    const getLogIcon = (type) => {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            case 'network': return '🌐';
            case 'transfer': return '📁';
            case 'system': return '⚙️';
            default: return '📝';
        }
    };

    // Get log color based on type
    const getLogColor = (type) => {
        switch (type) {
            case 'success': return 'var(--success-color)';
            case 'error': return 'var(--error-color)';
            case 'warning': return 'var(--warning-color)';
            case 'info': return 'var(--info-color)';
            case 'network': return '#9b59b6';
            case 'transfer': return '#3498db';
            case 'system': return '#95a5a6';
            default: return 'var(--text-primary)';
        }
    };

    // Format log time
    const formatLogTime = (timeString) => {
        return timeString;
    };

    // Get log type display name
    const getLogTypeName = (type) => {
        const typeNames = {
            'success': 'Success',
            'error': 'Error',
            'warning': 'Warning',
            'info': 'Info',
            'network': 'Network',
            'transfer': 'Transfer',
            'system': 'System'
        };
        return typeNames[type] || type;
    };

    // Copy all logs to clipboard
    const copyLogsToClipboard = () => {
        const logText = filteredLogs.map(log =>
            `[${log.time}] [${log.type.toUpperCase()}] ${log.message}`
        ).join('\n');

        navigator.clipboard.writeText(logText)
            .then(() => {
                alert('Logs copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy logs:', err);
            });
    };

    // Export logs as text file
    const exportLogs = () => {
        const logText = filteredLogs.map(log =>
            `[${log.time}] [${log.type.toUpperCase()}] ${log.message}`
        ).join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etherlink-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="connection-log">
            <div className="log-header">
                <h3>
                    <span className="log-icon">📋</span>
                    Connection Log
                    <span className="log-count">{filteredLogs.length} entries</span>
                </h3>

                <div className="log-controls">
                    <div className="log-filters">
                        <button
                            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All
                        </button>
                        <button
                            className={`filter-btn ${filter === 'network' ? 'active' : ''}`}
                            onClick={() => setFilter('network')}
                        >
                            Network
                        </button>
                        <button
                            className={`filter-btn ${filter === 'transfer' ? 'active' : ''}`}
                            onClick={() => setFilter('transfer')}
                        >
                            Transfer
                        </button>
                        <button
                            className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
                            onClick={() => setFilter('error')}
                        >
                            Errors
                        </button>
                    </div>

                    <div className="log-search">
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        {searchTerm && (
                            <button
                                className="clear-search"
                                onClick={() => setSearchTerm('')}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="log-toolbar">
                <div className="toolbar-left">
                    <span className="toolbar-label">Showing:</span>
                    <span className="toolbar-value">
                        {getLogTypeName(filter)} logs
                        {searchTerm && ` matching "${searchTerm}"`}
                    </span>
                </div>

                <div className="toolbar-right">
                    <button
                        className="toolbar-btn"
                        onClick={scrollToBottom}
                        title="Scroll to bottom"
                    >
                        ⬇️ Latest
                    </button>
                    <button
                        className="toolbar-btn"
                        onClick={copyLogsToClipboard}
                        title="Copy logs to clipboard"
                    >
                        📋 Copy
                    </button>
                    <button
                        className="toolbar-btn"
                        onClick={exportLogs}
                        title="Export logs as file"
                    >
                        💾 Export
                    </button>
                    <button
                        className="toolbar-btn danger"
                        onClick={clearLogs}
                        title="Clear all logs"
                        disabled={logs.length === 0}
                    >
                        🗑️ Clear
                    </button>
                </div>
            </div>

            <div className="log-content">
                {filteredLogs.length > 0 ? (
                    <div className="log-entries">
                        {filteredLogs.map((log) => (
                            <div
                                key={log.id}
                                className="log-entry"
                                style={{ borderLeftColor: getLogColor(log.type) }}
                            >
                                <div className="log-entry-header">
                                    <div className="log-type">
                                        <span className="log-type-icon">
                                            {getLogIcon(log.type)}
                                        </span>
                                        <span
                                            className="log-type-text"
                                            style={{ color: getLogColor(log.type) }}
                                        >
                                            {getLogTypeName(log.type)}
                                        </span>
                                    </div>
                                    <div className="log-time">
                                        {formatLogTime(log.time)}
                                    </div>
                                </div>

                                <div className="log-message">
                                    {log.message}
                                </div>

                                <div className="log-meta">
                                    <span className="log-id">ID: {log.id}</span>
                                    {log.timestamp && (
                                        <span className="log-timestamp">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                ) : (
                    <div className="no-logs">
                        <div className="no-logs-icon">📭</div>
                        <h4>No Log Entries</h4>
                        <p>
                            {searchTerm
                                ? `No logs found matching "${searchTerm}"`
                                : 'Logs will appear here as events occur'
                            }
                        </p>
                        {searchTerm && (
                            <button
                                className="clear-search-btn"
                                onClick={() => setSearchTerm('')}
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="log-footer">
                <div className="log-stats">
                    <div className="stat-item">
                        <span className="stat-label">Total:</span>
                        <span className="stat-value">{logs.length}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Filtered:</span>
                        <span className="stat-value">{filteredLogs.length}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Latest:</span>
                        <span className="stat-value">
                            {logs[0] ? formatLogTime(logs[0].time) : 'N/A'}
                        </span>
                    </div>
                </div>

                <div className="log-actions">
                    <button
                        className="action-btn"
                        onClick={() => setFilter('all')}
                    >
                        🔄 Refresh
                    </button>
                    <div className="auto-scroll">
                        <span className="auto-scroll-label">Auto-scroll:</span>
                        <label className="toggle-switch">
                            <input type="checkbox" defaultChecked />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConnectionLog;