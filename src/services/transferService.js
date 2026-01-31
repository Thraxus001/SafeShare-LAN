// src/services/transferService.js
import electronBridge from './electronBridge';

/**
 * Transfer Service - Handles file transfer operations
 */

class TransferService {
    constructor() {
        this.transfers = new Map();
        this.activeTransfers = new Set();
        this.listeners = new Map();
        this.transferIdCounter = 0;
        this.chunkSize = 1024 * 1024; // 1MB chunks
    }

    /**
     * Initialize transfer service
     */
    async initialize(config = {}) {
        console.log('Initializing transfer service...');

        this.config = {
            port: config.port || 9001,
            protocol: config.protocol || 'tcp',
            encryption: config.encryption !== false,
            compression: config.compression !== false,
            maxRetries: config.maxRetries || 3,
            ...config
        };

        this.notifyListeners('initialized', this.config);

        return this.config;
    }

    /**
     * Send files to peer
     */
    async sendFiles(files, peerIP, options = {}) {
        const transferId = this.generateTransferId();

        const transfer = {
            id: transferId,
            files: Array.isArray(files) ? files : [files],
            peerIP,
            status: 'queued',
            progress: 0,
            transferredBytes: 0,
            totalBytes: this.calculateTotalSize(files),
            startTime: null,
            endTime: null,
            speed: 0,
            options
        };

        this.transfers.set(transferId, transfer);
        this.activeTransfers.add(transferId);

        this.notifyListeners('transfer-queued', transfer);

        // Start transfer
        setTimeout(() => this.processTransfer(transferId), 100);

        return transferId;
    }

    /**
     * Process a transfer
     */
    async processTransfer(transferId) {
        const transfer = this.transfers.get(transferId);
        if (!transfer) return;

        transfer.status = 'preparing';
        transfer.startTime = new Date();
        this.notifyListeners('transfer-starting', transfer);

        const handleProgress = (data) => {
            // Match progress to current transfer if possible, or just assume it is this one
            // Data: { status, filename, progress, sent, total }

            // Should verify filename matches one of the files in transfer
            const file = transfer.files.find(f => (f.name || f.file.name) === data.filename);
            if (file) {
                transfer.progress = data.progress;
                transfer.transferredBytes = data.sent; // Note: this is per file in backend, might need aggregation for multi-file
                // For now, assuming single file or simple progress
                transfer.speed = 0; // Backend doesn't send speed yet, could calculate

                this.notifyListeners('transfer-progress', {
                    transferId,
                    progress: transfer.progress,
                    transferredBytes: transfer.transferredBytes,
                    totalBytes: transfer.totalBytes,
                    speed: 0,
                    currentFile: data.filename
                });
            }
        };

        // Listen for progress
        electronBridge.on('transfer-progress', handleProgress);

        try {
            // Establish connection (optional, bridge handles it usually? No, bridge just sends)
            // But we might want to check connection first?
            // electronBridge.transferFiles handles the transfer.

            transfer.status = 'transferring';
            this.notifyListeners('transfer-started', transfer);

            // Prepare files data for bridge
            const filesData = transfer.files.map(f => ({
                path: f.path || f.file.path, // Need path for backend to read
                name: f.name || f.file.name,
                size: f.size || f.file.size
            }));

            // Start transfer via bridge
            const result = await electronBridge.transferFiles({
                transferId,
                files: filesData,
                peerIP: transfer.peerIP
            });

            if (!result.success) throw new Error(result.error);

            // Complete transfer
            transfer.status = 'completed';
            transfer.endTime = new Date();
            transfer.progress = 100;
            this.activeTransfers.delete(transferId);

            this.notifyListeners('transfer-completed', transfer);

        } catch (error) {
            console.error(`Transfer ${transferId} failed:`, error);

            transfer.status = 'failed';
            transfer.error = error.message;
            transfer.endTime = new Date();
            this.activeTransfers.delete(transferId);

            this.notifyListeners('transfer-failed', transfer);
        } finally {
            electronBridge.off('transfer-progress', handleProgress);
        }
    }

    /**
     * Transfer a single file
     */
    async transferFile(transferId, file) {
        const transfer = this.transfers.get(transferId);
        if (!transfer) return;

        const fileSize = file.size || file.file.size || 0;
        const chunks = Math.ceil(fileSize / this.chunkSize);

        console.log(`Transferring file: ${file.name || file.file.name}, Size: ${fileSize}, Chunks: ${chunks}`);

        // Simulate file transfer
        for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
            if (transfer.status !== 'transferring') {
                break; // Transfer was paused or cancelled
            }

            // Simulate chunk transfer
            await new Promise(resolve => setTimeout(resolve, 50));

            // Update progress
            const chunkProgress = ((chunkIndex + 1) / chunks) * 100;
            const fileProgress = chunkProgress / transfer.files.length;
            transfer.progress = Math.min(100,
                (transfer.progress || 0) + fileProgress
            );

            // Update transferred bytes
            const chunkSize = Math.min(this.chunkSize, fileSize - (chunkIndex * this.chunkSize));
            transfer.transferredBytes += chunkSize;

            // Calculate speed
            const elapsed = (new Date() - transfer.startTime) / 1000; // seconds
            transfer.speed = elapsed > 0 ? transfer.transferredBytes / elapsed : 0;

            this.notifyListeners('transfer-progress', {
                transferId,
                progress: transfer.progress,
                transferredBytes: transfer.transferredBytes,
                totalBytes: transfer.totalBytes,
                speed: transfer.speed,
                currentFile: file.name || file.file.name,
                fileProgress: chunkProgress
            });
        }
    }

    /**
     * Establish connection to peer
     */
    async establishConnection(peerIP) {
        console.log(`Establishing connection to ${peerIP}...`);

        // In a real app, this would create a socket connection
        // For simulation, just wait a bit
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            success: true,
            peerIP,
            protocol: this.config.protocol,
            port: this.config.port,
            timestamp: new Date()
        };
    }

    /**
     * Pause a transfer
     */
    pauseTransfer(transferId) {
        const transfer = this.transfers.get(transferId);
        if (transfer && transfer.status === 'transferring') {
            transfer.status = 'paused';
            this.notifyListeners('transfer-paused', transfer);
            return true;
        }
        return false;
    }

    /**
     * Resume a transfer
     */
    resumeTransfer(transferId) {
        const transfer = this.transfers.get(transferId);
        if (transfer && transfer.status === 'paused') {
            transfer.status = 'transferring';
            this.notifyListeners('transfer-resumed', transfer);

            // Continue processing
            setTimeout(() => this.processTransfer(transferId), 100);
            return true;
        }
        return false;
    }

    /**
     * Cancel a transfer
     */
    async cancelTransfer(transferId) {
        const transfer = this.transfers.get(transferId);
        if (transfer) {
            transfer.status = 'cancelled';
            transfer.endTime = new Date();
            this.activeTransfers.delete(transferId);

            // Notify backend to cancel
            try {
                await electronBridge.cancelTransfer(transferId);
            } catch (err) {
                console.error('Failed to cancel transfer in backend:', err);
            }

            this.notifyListeners('transfer-cancelled', transfer);
            return true;
        }
        return false;
    }

    /**
     * Get transfer by ID
     */
    getTransfer(transferId) {
        return this.transfers.get(transferId);
    }

    /**
     * Get all transfers
     */
    getAllTransfers() {
        return Array.from(this.transfers.values());
    }

    /**
     * Get active transfers
     */
    getActiveTransfers() {
        return Array.from(this.activeTransfers)
            .map(id => this.transfers.get(id))
            .filter(Boolean);
    }

    /**
     * Clear completed transfers
     */
    clearCompletedTransfers() {
        const completed = Array.from(this.transfers.entries())
            .filter(([_, transfer]) =>
                ['completed', 'failed', 'cancelled'].includes(transfer.status)
            );

        completed.forEach(([id]) => {
            this.transfers.delete(id);
            this.activeTransfers.delete(id);
        });

        this.notifyListeners('transfers-cleared', {
            count: completed.length
        });

        return completed.length;
    }

    /**
     * Calculate total size of files
     */
    calculateTotalSize(files) {
        const fileArray = Array.isArray(files) ? files : [files];
        return fileArray.reduce((total, file) => {
            return total + (file.size || file.file?.size || 0);
        }, 0);
    }

    /**
     * Generate unique transfer ID
     */
    generateTransferId() {
        return `transfer_${Date.now()}_${++this.transferIdCounter}`;
    }

    /**
     * Event listener system
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.transfers.clear();
        this.activeTransfers.clear();
        this.listeners.clear();
    }
}

// Export singleton instance
const transferService = new TransferService();
export default transferService;