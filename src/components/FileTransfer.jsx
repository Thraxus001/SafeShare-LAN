// src/components/FileTransfer.jsx
import React, { useState, useRef, useEffect } from 'react';
import './FileTransfer.css';

const FileTransfer = ({ connectionStatus, peerIP, selectedPeers, isBroadcast, mode, onTransferStart, activeTransfer, history }) => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [transferHistory, setTransferHistory] = useState([]);
    const [currentTransfer, setCurrentTransfer] = useState(null);

    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    // Initialize with sample history
    // useEffect(() => {
    //     // Mock data removed
    //     setTransferHistory([]);
    // }, []);

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Calculate total size
    const calculateTotalSize = () => {
        return selectedFiles.reduce((total, file) => total + file.size, 0);
    };

    // Get file icon based on type
    const getFileIcon = (file) => {
        const name = file.name.toLowerCase();
        const type = file.type;

        if (type.startsWith('image/')) return '🖼️';
        if (type.startsWith('video/')) return '🎬';
        if (type.startsWith('audio/')) return '🎵';
        if (name.includes('.pdf')) return '📕';
        if (name.match(/\.(zip|rar|7z|tar|gz)$/)) return '📦';
        if (name.match(/\.(doc|docx|txt|rtf)$/)) return '📄';
        if (name.match(/\.(xls|xlsx|csv)$/)) return '📊';
        if (name.match(/\.(ppt|pptx)$/)) return '📽️';
        if (name.match(/\.(js|jsx|ts|tsx|py|java|cpp|c|html|css)$/)) return '💻';
        return '📁';
    };

    // Handle file selection
    const handleFileSelect = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            addFilesToList(files);
        }
    };

    // Handle drag and drop
    const handleDragEnter = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        if (!dropZoneRef.current.contains(e.relatedTarget)) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            addFilesToList(files);
        }
    };

    // Add files to selected list
    const addFilesToList = (files) => {
        const filesWithInfo = files.map(file => ({
            id: Date.now() + Math.random(),
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            icon: getFileIcon(file),
            status: 'pending'
        }));

        setSelectedFiles(prev => [...prev, ...filesWithInfo]);
    };

    // Remove file from list
    const removeFile = (fileId) => {
        setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
    };

    // Clear all files
    const clearAllFiles = () => {
        setSelectedFiles([]);
    };

    // Start file transfer
    const startTransfer = () => {
        if (selectedFiles.length === 0) {
            alert('Please select files to transfer');
            return;
        }

        if (connectionStatus !== 'connected') {
            alert('Please establish connection first');
            return;
        }

        const transferData = {
            files: selectedFiles.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type,
                path: f.file.path // Required for Electron to read file
            })),
            totalSize: calculateTotalSize(),
            peerIP: isBroadcast ? selectedPeers[0] : peerIP, // Base IP (App.js handles loop)
            selectedPeers: isBroadcast ? selectedPeers : [peerIP],
            timestamp: new Date()
        };

        // Create transfer entry
        const transferEntry = {
            id: Date.now(),
            name: `${selectedFiles.length} file(s)`,
            size: calculateTotalSize(),
            status: 'transferring',
            progress: 0,
            speed: 0,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            files: selectedFiles
        };

        setCurrentTransfer(transferEntry);
        // We don't add to history here yet, we will rely on history prop if available
        // setTransferHistory(prev => [transferEntry, ...prev]);

        // Call parent callback
        onTransferStart(transferData);
    };

    // Use real active transfer from props if available
    const transfer = activeTransfer;

    // Calculate transfer time estimate
    const calculateTimeEstimate = (size, speed) => {
        if (!speed) return 'Calculating...';
        const seconds = size / (speed * 1024 * 1024); // Convert MB/s to bytes/s
        if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
        if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
        return `${Math.ceil(seconds / 3600)} hours`;
    };

    return (
        <div className="file-transfer">
            <div className="transfer-header">
                <h2>
                    <span className="header-icon">📁</span>
                    File Transfer
                    <span className="transfer-mode">
                        {isBroadcast ? 'Broadcast (Full-Duplex)' : (mode === 'sender' ? 'Sending' : 'Receiving')}
                    </span>
                </h2>
                <div className="connection-status">
                    {connectionStatus === 'connected' ? (
                        <div className="connected-info">
                            <span className="status-dot connected"></span>
                            {isBroadcast ? `${selectedPeers.length} Targets Selected` : `Connected to ${peerIP}`}
                        </div>
                    ) : (
                        <div className="disconnected-info">
                            <span className="status-dot disconnected"></span>
                            Not Connected
                        </div>
                    )}
                </div>
            </div>

            {/* File Drop Zone */}
            <div
                ref={dropZoneRef}
                className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className="drop-content">
                    <div className="drop-icon">
                        {isDragging ? '📂' : '📎'}
                    </div>
                    <h3>Drag & Drop Files Here</h3>
                    <p>or click to select files from your computer</p>
                    <p className="drop-info">
                        Supports any file type • No size limits • Direct transfer
                    </p>

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="file-input"
                        id="file-input"
                    />

                    <button
                        className="btn-select"
                        onClick={() => fileInputRef.current.click()}
                    >
                        📁 Select Files
                    </button>
                </div>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
                <div className="selected-files">
                    <div className="files-header">
                        <h4>Selected Files ({selectedFiles.length})</h4>
                        <div className="files-stats">
                            <span className="total-size">
                                Total: {formatFileSize(calculateTotalSize())}
                            </span>
                            <button
                                className="btn-clear"
                                onClick={clearAllFiles}
                            >
                                🗑️ Clear All
                            </button>
                        </div>
                    </div>

                    <div className="files-list">
                        {selectedFiles.map((file) => (
                            <div key={file.id} className="file-item">
                                <div className="file-icon">
                                    {file.icon}
                                </div>
                                <div className="file-info">
                                    <div className="file-name" title={file.name}>
                                        {file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name}
                                    </div>
                                    <div className="file-details">
                                        <span className="file-size">{formatFileSize(file.size)}</span>
                                        <span className="file-type">{file.type || 'Unknown type'}</span>
                                    </div>
                                </div>
                                <button
                                    className="btn-remove"
                                    onClick={() => removeFile(file.id)}
                                    title="Remove file"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Current Transfer */}
            {transfer && (
                <div className="current-transfer">
                    <div className="transfer-header">
                        <h4>Transfer in Progress</h4>
                        <div className="transfer-stats">
                            <span className="speed">⚡ {Number(transfer.speed || 0).toFixed(0)} MB/s</span>
                            <span className="progress">{Number(transfer.progress || 0).toFixed(1)}%</span>
                        </div>
                    </div>

                    <div className="transfer-progress">
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${transfer.progress}%` }}
                            ></div>
                        </div>
                        <div className="progress-details">
                            <div className="detail-item">
                                <span className="label">Time Remaining:</span>
                                <span className="value">
                                    {calculateTimeEstimate(
                                        transfer.size * (1 - transfer.progress / 100),
                                        transfer.speed
                                    )}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Transferred:</span>
                                <span className="value">
                                    {formatFileSize(transfer.size * (transfer.progress / 100))}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Total:</span>
                                <span className="value">{formatFileSize(transfer.size)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Controls */}
            <div className="transfer-controls">
                <button
                    className={`btn-transfer ${(connectionStatus !== 'connected' || selectedPeers.length === 0 || (mode === 'receiver' && !isBroadcast)) ? 'disabled' : ''}`}
                    onClick={startTransfer}
                    disabled={connectionStatus !== 'connected' || selectedPeers.length === 0 || (mode === 'receiver' && !isBroadcast)}
                    title={mode === 'receiver' && !isBroadcast ? 'Switch to Sender mode or enable Broadcast to send files' : ''}
                >
                    {isBroadcast ? `📡 Broadcast to ${selectedPeers.length} Devices` : (mode === 'sender' ? '📤 Send Files' : '📥 Waiting for Files...')}
                    {selectedPeers.length > 0 && ` (${selectedFiles.length} files)`}
                </button>

                <div className="transfer-actions">
                    <button
                        className="btn-action"
                        onClick={() => fileInputRef.current.click()}
                        title="Add more files"
                    >
                        ➕ Add Files
                    </button>
                    <button
                        className="btn-action"
                        onClick={clearAllFiles}
                        disabled={selectedFiles.length === 0}
                        title="Clear selected files"
                    >
                        🗑️ Clear
                    </button>
                </div>
            </div>

            {/* Transfer History */}
            <div className="transfer-history">
                <div className="history-header">
                    <h4>Transfer History</h4>
                    <span className="history-count">{(history || transferHistory).length} transfers</span>
                </div>

                <div className="history-list">
                    {(history || transferHistory).length > 0 ? (
                        (history || transferHistory).map((transferItem) => (
                            <div key={transferItem.id} className={`history-item ${transferItem.status}`}>
                                <div className="history-icon">
                                    {transferItem.status === 'completed' ? '✅' :
                                        transferItem.status === 'transferring' ? '🔄' : '⏳'}
                                </div>
                                <div className="history-info">
                                    <div className="history-name">{transferItem.name || (transferItem.files?.[0]?.name)}</div>
                                    <div className="history-details">
                                        <span className="size">{formatFileSize(transferItem.size || (transferItem.files?.[0]?.size || 0))}</span>
                                        <span className="time">{transferItem.time || (transferItem.startTime ? new Date(transferItem.startTime).toLocaleTimeString() : '')}</span>
                                        {transferItem.speed > 0 && (
                                            <span className="speed">⚡ {Number(transferItem.speed).toFixed(0)} MB/s</span>
                                        )}
                                    </div>
                                </div>
                                <div className="history-status">
                                    {transferItem.status === 'transferring' ? (
                                        <div className="progress-indicator">
                                            <div className="mini-progress">
                                                <div
                                                    className="mini-progress-fill"
                                                    style={{ width: `${transferItem.progress}%` }}
                                                ></div>
                                            </div>
                                            <span>{Number(transferItem.progress || 0).toFixed(0)}%</span>
                                        </div>
                                    ) : (
                                        <span className={`status-text ${transferItem.status}`}>
                                            {transferItem.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-history">
                            No transfer history yet. Select files and start transferring!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(FileTransfer);