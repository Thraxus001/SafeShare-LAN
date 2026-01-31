// src/hooks/useFileTransfer.js

import { useState, useCallback, useEffect, useRef } from 'react';
import transferService from '../services/transferService';
import socketService from '../services/socketService';
import {
    formatFileSize,
    calculateProgress,
    formatSpeed,
    calculateTransferTime
} from '../utils/helpers';

/**
 * Custom hook for file transfer management
 */
const useFileTransfer = () => {
    const [transfers, setTransfers] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [currentTransfer, setCurrentTransfer] = useState(null);
    const [transferStats, setTransferStats] = useState({
        totalTransferred: 0,
        totalFiles: 0,
        averageSpeed: 0,
        totalTime: 0
    });

    const transferListeners = useRef(new Set());

    /**
     * Initialize transfer service
     */
    const initialize = useCallback(async () => {
        try {
            await transferService.initialize({
                port: 9001,
                protocol: 'tcp',
                encryption: true,
                compression: true,
                maxRetries: 3
            });

            // Set up event listeners
            transferService.on('transfer-queued', handleTransferQueued);
            transferService.on('transfer-starting', handleTransferStarting);
            transferService.on('transfer-started', handleTransferStarted);
            transferService.on('transfer-progress', handleTransferProgress);
            transferService.on('transfer-completed', handleTransferCompleted);
            transferService.on('transfer-failed', handleTransferFailed);
            transferService.on('transfer-paused', handleTransferPaused);
            transferService.on('transfer-resumed', handleTransferResumed);
            transferService.on('transfer-cancelled', handleTransferCancelled);

            console.log('Transfer service initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize transfer service:', error);
            return false;
        }
    }, []);

    /**
     * Select files for transfer
     */
    const selectFiles = useCallback((files) => {
        const fileObjects = Array.from(files).map(file => ({
            id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending',
            progress: 0,
            transferred: 0
        }));

        setSelectedFiles(prev => [...prev, ...fileObjects]);
        return fileObjects;
    }, []);

    /**
     * Remove file from selection
     */
    const removeFile = useCallback((fileId) => {
        setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
    }, []);

    /**
     * Clear all selected files
     */
    const clearSelectedFiles = useCallback(() => {
        setSelectedFiles([]);
    }, []);

    /**
     * Start file transfer
     */
    const startTransfer = useCallback(async (peerIP) => {
        if (selectedFiles.length === 0) {
            throw new Error('No files selected for transfer');
        }

        if (!peerIP) {
            throw new Error('No peer IP specified');
        }

        try {
            // Connect to peer
            await socketService.connect(peerIP, 9001);

            // Start transfer
            const transferId = await transferService.sendFiles(
                selectedFiles,
                peerIP,
                {
                    encryption: true,
                    compression: true,
                    priority: 'normal'
                }
            );

            // Clear selected files after transfer starts
            setSelectedFiles([]);

            return transferId;
        } catch (error) {
            console.error('Failed to start transfer:', error);
            throw error;
        }
    }, [selectedFiles]);

    /**
     * Pause transfer
     */
    const pauseTransfer = useCallback((transferId) => {
        return transferService.pauseTransfer(transferId);
    }, []);

    /**
     * Resume transfer
     */
    const resumeTransfer = useCallback((transferId) => {
        return transferService.resumeTransfer(transferId);
    }, []);

    /**
     * Cancel transfer
     */
    const cancelTransfer = useCallback((transferId) => {
        return transferService.cancelTransfer(transferId);
    }, []);

    /**
     * Get transfer by ID
     */
    const getTransfer = useCallback((transferId) => {
        return transferService.getTransfer(transferId);
    }, []);

    /**
     * Get all transfers
     */
    const getAllTransfers = useCallback(() => {
        return transferService.getAllTransfers();
    }, []);

    /**
     * Clear completed transfers
     */
    const clearCompletedTransfers = useCallback(() => {
        const clearedCount = transferService.clearCompletedTransfers();
        setTransfers(transferService.getAllTransfers());
        return clearedCount;
    }, []);

    /**
     * Calculate total size of selected files
     */
    const calculateTotalSize = useCallback(() => {
        return selectedFiles.reduce((total, file) => total + file.size, 0);
    }, [selectedFiles]);

    /**
     * Event handlers
     */
    const handleTransferQueued = useCallback((transfer) => {
        setTransfers(prev => [transfer, ...prev]);
        notifyListeners('transfer-queued', transfer);
    }, []);

    const handleTransferStarting = useCallback((transfer) => {
        setTransfers(prev =>
            prev.map(t =>
                t.id === transfer.id ? { ...t, status: 'preparing' } : t
            )
        );
        notifyListeners('transfer-starting', transfer);
    }, []);

    const handleTransferStarted = useCallback((transfer) => {
        setCurrentTransfer(transfer);
        setTransfers(prev =>
            prev.map(t =>
                t.id === transfer.id ? { ...t, status: 'transferring' } : t
            )
        );
        notifyListeners('transfer-started', transfer);
    }, []);

    const handleTransferProgress = useCallback((progress) => {
        setTransfers(prev =>
            prev.map(t =>
                t.id === progress.transferId
                    ? {
                        ...t,
                        progress: progress.progress,
                        transferredBytes: progress.transferredBytes,
                        speed: progress.speed
                    }
                    : t
            )
        );

        if (currentTransfer?.id === progress.transferId) {
            setCurrentTransfer(prev => ({
                ...prev,
                progress: progress.progress,
                transferredBytes: progress.transferredBytes,
                speed: progress.speed
            }));
        }

        notifyListeners('transfer-progress', progress);
    }, [currentTransfer]);

    const handleTransferCompleted = useCallback((transfer) => {
        setTransfers(prev =>
            prev.map(t =>
                t.id === transfer.id ? { ...t, ...transfer } : t
            )
        );

        if (currentTransfer?.id === transfer.id) {
            setCurrentTransfer(null);
        }

        // Update stats
        setTransferStats(prev => ({
            ...prev,
            totalTransferred: prev.totalTransferred + transfer.totalBytes,
            totalFiles: prev.totalFiles + transfer.files.length,
            averageSpeed: (prev.averageSpeed + transfer.speed) / 2,
            totalTime: prev.totalTime + (transfer.endTime - transfer.startTime)
        }));

        notifyListeners('transfer-completed', transfer);
    }, [currentTransfer]);

    const handleTransferFailed = useCallback((transfer) => {
        setTransfers(prev =>
            prev.map(t =>
                t.id === transfer.id ? { ...t, ...transfer } : t
            )
        );

        if (currentTransfer?.id === transfer.id) {
            setCurrentTransfer(null);
        }

        notifyListeners('transfer-failed', transfer);
    }, [currentTransfer]);

    const handleTransferPaused = useCallback((transfer) => {
        setTransfers(prev =>
            prev.map(t =>
                t.id === transfer.id ? { ...t, status: 'paused' } : t
            )
        );

        notifyListeners('transfer-paused', transfer);
    }, []);

    const handleTransferResumed = useCallback((transfer) => {
        setTransfers(prev =>
            prev.map(t =>
                t.id === transfer.id ? { ...t, status: 'transferring' } : t
            )
        );

        notifyListeners('transfer-resumed', transfer);
    }, []);

    const handleTransferCancelled = useCallback((transfer) => {
        setTransfers(prev =>
            prev.map(t =>
                t.id === transfer.id ? { ...t, ...transfer } : t
            )
        );

        if (currentTransfer?.id === transfer.id) {
            setCurrentTransfer(null);
        }

        notifyListeners('transfer-cancelled', transfer);
    }, [currentTransfer]);

    /**
     * Event listener management
     */
    const addEventListener = useCallback((event, callback) => {
        transferListeners.current.add({ event, callback });
    }, []);

    const removeEventListener = useCallback((event, callback) => {
        transferListeners.current.forEach(listener => {
            if (listener.event === event && listener.callback === callback) {
                transferListeners.current.delete(listener);
            }
        });
    }, []);

    const notifyListeners = useCallback((event, data) => {
        transferListeners.current.forEach(listener => {
            if (listener.event === event) {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            }
        });
    }, []);

    /**
     * Initialize on mount
     */
    useEffect(() => {
        initialize();

        // Load existing transfers
        setTransfers(transferService.getAllTransfers());

        // Cleanup
        return () => {
            // Remove event listeners
            transferService.off('transfer-queued', handleTransferQueued);
            transferService.off('transfer-starting', handleTransferStarting);
            transferService.off('transfer-started', handleTransferStarted);
            transferService.off('transfer-progress', handleTransferProgress);
            transferService.off('transfer-completed', handleTransferCompleted);
            transferService.off('transfer-failed', handleTransferFailed);
            transferService.off('transfer-paused', handleTransferPaused);
            transferService.off('transfer-resumed', handleTransferResumed);
            transferService.off('transfer-cancelled', handleTransferCancelled);

            // Cleanup services
            transferService.cleanup();
            socketService.cleanup();
        };
    }, [initialize]);

    return {
        // State
        transfers,
        selectedFiles,
        currentTransfer,
        transferStats,

        // File selection
        selectFiles,
        removeFile,
        clearSelectedFiles,
        calculateTotalSize,

        // Transfer control
        startTransfer,
        pauseTransfer,
        resumeTransfer,
        cancelTransfer,

        // Transfer info
        getTransfer,
        getAllTransfers,
        clearCompletedTransfers,

        // Event listeners
        addEventListener,
        removeEventListener,

        // Utilities
        formatFileSize,
        calculateProgress,
        formatSpeed,
        calculateTransferTime
    };
};

export default useFileTransfer;