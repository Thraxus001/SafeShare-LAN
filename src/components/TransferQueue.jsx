// src/components/TransferQueue.jsx
import React, { useState, useEffect } from 'react';
import './TransferQueue.css';

const TransferQueue = ({ transfers, clearTransfers, activeTransfer, onTransferAction }) => {
    const [sortBy, setSortBy] = useState('time');
    const [sortOrder, setSortOrder] = useState('desc');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortedTransfers, setSortedTransfers] = useState([]);

    // Sort and filter transfers
    useEffect(() => {
        let result = [...transfers];

        // Filter by status
        if (filterStatus !== 'all') {
            result = result.filter(transfer => transfer.status === filterStatus);
        }

        // Sort transfers
        result.sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'name':
                    aValue = a.name || '';
                    bValue = b.name || '';
                    break;
                case 'size':
                    aValue = a.size || 0;
                    bValue = b.size || 0;
                    break;
                case 'progress':
                    aValue = a.progress || 0;
                    bValue = b.progress || 0;
                    break;
                case 'speed':
                    aValue = a.speed || 0;
                    bValue = b.speed || 0;
                    break;
                case 'time':
                default:
                    aValue = a.startTime || 0;
                    bValue = b.startTime || 0;
                    break;
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        setSortedTransfers(result);
    }, [transfers, sortBy, sortOrder, filterStatus]);

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format time
    const formatTime = (date) => {
        if (!date) return 'Unknown';
        const time = new Date(date);
        return time.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Calculate total transferred size
    const calculateTotalTransferred = () => {
        return transfers.reduce((total, transfer) => {
            if (transfer.status === 'completed') {
                return total + (transfer.size || 0);
            }
            return total;
        }, 0);
    };

    // Get status icon
    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return '✅';
            case 'transferring': return '🔄';
            case 'queued': return '⏳';
            case 'failed': return '❌';
            case 'paused': return '⏸️';
            default: return '📝';
        }
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'var(--success-color)';
            case 'transferring': return 'var(--info-color)';
            case 'queued': return 'var(--warning-color)';
            case 'failed': return 'var(--error-color)';
            case 'paused': return '#95a5a6';
            default: return 'var(--text-secondary)';
        }
    };

    // Get status text
    const getStatusText = (status) => {
        return status.charAt(0).toUpperCase() + status.slice(1);
    };


    // Handle transfer action
    const handleTransferAction = (transferId, action) => {
        console.log(`${action} transfer ${transferId}`);
        if (onTransferAction) {
            onTransferAction(transferId, action);
        }
    };

    // Sort handler
    const handleSort = (column) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    // Get sort icon
    const getSortIcon = (column) => {
        if (sortBy !== column) return '↕️';
        return sortOrder === 'asc' ? '⬆️' : '⬇️';
    };

    return (
        <div className="transfer-queue">
            <div className="queue-header">
                <h3>
                    <span className="queue-icon">📊</span>
                    Transfer Queue
                    <span className="queue-count">{transfers.length} transfers</span>
                </h3>

                <div className="queue-stats">
                    <div className="stat-card">
                        <div className="stat-icon">✅</div>
                        <div className="stat-info">
                            <div className="stat-value">
                                {transfers.filter(t => t.status === 'completed').length}
                            </div>
                            <div className="stat-label">Completed</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">🔄</div>
                        <div className="stat-info">
                            <div className="stat-value">
                                {transfers.filter(t => t.status === 'transferring').length}
                            </div>
                            <div className="stat-label">Active</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">📦</div>
                        <div className="stat-info">
                            <div className="stat-value">
                                {formatFileSize(calculateTotalTransferred())}
                            </div>
                            <div className="stat-label">Total</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="queue-controls">
                <div className="controls-left">
                    <div className="filter-group">
                        <span className="filter-label">Filter:</span>
                        <div className="filter-buttons">
                            {[
                                { id: 'all', label: 'All', icon: '📁' },
                                { id: 'transferring', label: 'Active', icon: '🔄' },
                                { id: 'queued', label: 'Queued', icon: '⏳' },
                                { id: 'completed', label: 'Done', icon: '✅' },
                                { id: 'paused', label: 'Paused', icon: '⏸️' },
                                { id: 'failed', label: 'Failed', icon: '❌' }
                            ].map((filter) => (
                                <button
                                    key={filter.id}
                                    className={`filter-btn ${filterStatus === filter.id ? 'active' : ''}`}
                                    onClick={() => setFilterStatus(filter.id)}
                                    title={`Show ${filter.label} transfers`}
                                >
                                    <span className="btn-icon">{filter.icon}</span>
                                    <span className="btn-text">{filter.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="sort-group">
                        <span className="sort-label">Sort by:</span>
                        <div className="sort-buttons">
                            {['time', 'name', 'size', 'progress', 'speed'].map((column) => (
                                <button
                                    key={column}
                                    className={`sort-btn ${sortBy === column ? 'active' : ''}`}
                                    onClick={() => handleSort(column)}
                                >
                                    {column.charAt(0).toUpperCase() + column.slice(1)}
                                    <span className="sort-icon">{getSortIcon(column)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="controls-right">
                    <button
                        className="control-btn"
                        onClick={() => {
                            // Resume all paused transfers
                            transfers.forEach(t => {
                                if (t.status === 'paused') {
                                    handleTransferAction(t.id, 'resume');
                                }
                            });
                        }}
                        disabled={!transfers.some(t => t.status === 'paused')}
                    >
                        ▶️ Resume All
                    </button>

                    <button
                        className="control-btn"
                        onClick={() => {
                            // Pause all active transfers
                            transfers.forEach(t => {
                                if (t.status === 'transferring') {
                                    handleTransferAction(t.id, 'pause');
                                }
                            });
                        }}
                        disabled={!transfers.some(t => t.status === 'transferring')}
                    >
                        ⏸️ Pause All
                    </button>

                    <button
                        className="control-btn danger"
                        onClick={clearTransfers}
                        disabled={transfers.length === 0}
                    >
                        🗑️ Clear All
                    </button>
                </div>
            </div>

            {/* Queue Content */}
            <div className="queue-content">
                {sortedTransfers.length > 0 ? (
                    <div className="queue-table">
                        <div className="table-header">
                            <div className="table-cell" style={{ width: '40%' }}>
                                <button
                                    className="header-btn"
                                    onClick={() => handleSort('name')}
                                >
                                    File/Transfer
                                    <span className="sort-icon">{getSortIcon('name')}</span>
                                </button>
                            </div>
                            <div className="table-cell" style={{ width: '15%' }}>
                                <button
                                    className="header-btn"
                                    onClick={() => handleSort('size')}
                                >
                                    Size
                                    <span className="sort-icon">{getSortIcon('size')}</span>
                                </button>
                            </div>
                            <div className="table-cell" style={{ width: '15%' }}>
                                <button
                                    className="header-btn"
                                    onClick={() => handleSort('progress')}
                                >
                                    Progress
                                    <span className="sort-icon">{getSortIcon('progress')}</span>
                                </button>
                            </div>
                            <div className="table-cell" style={{ width: '15%' }}>
                                <button
                                    className="header-btn"
                                    onClick={() => handleSort('status')}
                                >
                                    Status
                                </button>
                            </div>
                            <div className="table-cell actions" style={{ width: '15%' }}>
                                Actions
                            </div>
                        </div>

                        <div className="table-body">
                            {sortedTransfers.map((transfer) => (
                                <div
                                    key={transfer.id}
                                    className={`table-row ${transfer.id === activeTransfer?.id ? 'active' : ''}`}
                                >
                                    <div className="table-cell" style={{ width: '40%' }}>
                                        <div className="transfer-info">
                                            <div className="transfer-icon">
                                                {getStatusIcon(transfer.status)}
                                            </div>
                                            <div className="transfer-details">
                                                <div className="transfer-name">
                                                    {transfer.name || `${transfer.files?.length || 1} file(s)`}
                                                </div>
                                                <div className="transfer-meta">
                                                    <span className="transfer-time">
                                                        {formatTime(transfer.startTime)}
                                                    </span>
                                                    {transfer.speed > 0 && (
                                                        <>
                                                            <span className="meta-separator">•</span>
                                                            <span className="transfer-speed">
                                                                ⚡ {Number(transfer.speed || 0).toFixed(0)} MB/s
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="table-cell" style={{ width: '15%' }}>
                                        <div className="transfer-size">
                                            {formatFileSize(transfer.size || 0)}
                                        </div>
                                    </div>

                                    <div className="table-cell" style={{ width: '15%' }}>
                                        <div className="transfer-progress">
                                            <div className="progress-container">
                                                <div className="progress-bar">
                                                    <div
                                                        className="progress-fill"
                                                        style={{
                                                            width: `${transfer.progress || 0}%`,
                                                            background: getStatusColor(transfer.status)
                                                        }}
                                                    ></div>
                                                </div>
                                                <span className="progress-text">
                                                    {(transfer.progress || 0).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="table-cell" style={{ width: '15%' }}>
                                        <div
                                            className="transfer-status"
                                            style={{ color: getStatusColor(transfer.status) }}
                                        >
                                            {getStatusIcon(transfer.status)}
                                            {getStatusText(transfer.status)}
                                        </div>
                                    </div>

                                    <div className="table-cell actions" style={{ width: '15%' }}>
                                        <div className="transfer-actions">
                                            {transfer.status === 'transferring' && (
                                                <button
                                                    className="action-btn"
                                                    onClick={() => handleTransferAction(transfer.id, 'pause')}
                                                    title="Pause transfer"
                                                >
                                                    ⏸️
                                                </button>
                                            )}

                                            {transfer.status === 'paused' && (
                                                <button
                                                    className="action-btn"
                                                    onClick={() => handleTransferAction(transfer.id, 'resume')}
                                                    title="Resume transfer"
                                                >
                                                    ▶️
                                                </button>
                                            )}

                                            {transfer.status === 'queued' && (
                                                <button
                                                    className="action-btn"
                                                    onClick={() => handleTransferAction(transfer.id, 'start')}
                                                    title="Start transfer"
                                                >
                                                    ▶️
                                                </button>
                                            )}

                                            <button
                                                className="action-btn danger"
                                                onClick={() => handleTransferAction(transfer.id, 'cancel')}
                                                title="Cancel transfer"
                                            >
                                                ✕
                                            </button>

                                            {transfer.status === 'completed' && (
                                                <button
                                                    className="action-btn success"
                                                    onClick={() => handleTransferAction(transfer.id, 'open')}
                                                    title="Open file location"
                                                >
                                                    📂
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="empty-queue">
                        <div className="empty-icon">📭</div>
                        <h4>Transfer Queue Empty</h4>
                        <p>No transfers in queue. Start transferring files to see them here.</p>
                        {filterStatus !== 'all' && (
                            <button
                                className="clear-filter-btn"
                                onClick={() => setFilterStatus('all')}
                            >
                                Clear Filter
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Queue Summary */}
            {sortedTransfers.length > 0 && (
                <div className="queue-summary">
                    <div className="summary-left">
                        <div className="summary-item">
                            <span className="summary-label">Showing:</span>
                            <span className="summary-value">
                                {sortedTransfers.length} of {transfers.length} transfers
                            </span>
                        </div>

                        <div className="summary-item">
                            <span className="summary-label">Total size:</span>
                            <span className="summary-value">
                                {formatFileSize(
                                    sortedTransfers.reduce((total, t) => total + (t.size || 0), 0)
                                )}
                            </span>
                        </div>
                    </div>

                    <div className="summary-right">
                        <div className="summary-item">
                            <span className="summary-label">Active transfers:</span>
                            <span className="summary-value">
                                {sortedTransfers.filter(t => t.status === 'transferring').length}
                            </span>
                        </div>

                        <div className="summary-item">
                            <span className="summary-label">Avg speed:</span>
                            <span className="summary-value">
                                {(() => {
                                    const activeTransfers = sortedTransfers.filter(t =>
                                        t.status === 'transferring' && t.speed > 0
                                    );
                                    if (activeTransfers.length === 0) return '0 MB/s';
                                    const avgSpeed = activeTransfers.reduce((sum, t) => sum + t.speed, 0) /
                                        activeTransfers.length;
                                    return `${Number(avgSpeed).toFixed(1)} MB/s`;
                                })()}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransferQueue;