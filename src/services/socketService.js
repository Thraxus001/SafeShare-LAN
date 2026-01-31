// src/services/socketService.js

/**
 * Socket Service - Handles WebSocket/TCP socket communications
 * For real-time communication between peers
 */

class SocketService {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.listeners = new Map();
        this.messageQueue = [];
    }

    /**
     * Connect to peer
     */
    async connect(peerIP, port = 9001) {
        if (this.isConnected) {
            console.warn('Already connected to peer');
            return { success: true, alreadyConnected: true };
        }

        console.log(`Connecting to peer at ${peerIP}:${port}...`);

        try {
            // In a real app, this would create a WebSocket or TCP socket
            // For simulation, create a mock connection
            await this.createMockConnection(peerIP, port);

            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.peerConnection = { ip: peerIP, port };

            // Start heartbeat
            this.startHeartbeat();

            // Process queued messages
            this.processMessageQueue();

            this.notifyListeners('connected', {
                peerIP,
                port,
                protocol: 'TCP',
                timestamp: new Date()
            });

            return {
                success: true,
                peerIP,
                port,
                message: 'Connected to peer successfully'
            };

        } catch (error) {
            console.error('Failed to connect to peer:', error);

            this.notifyListeners('connection-error', {
                error: error.message,
                peerIP,
                port
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create mock connection for simulation
     */
    async createMockConnection(peerIP, port) {
        // Simulate connection delay
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                // 90% success rate for simulation
                if (Math.random() > 0.1) {
                    resolve();
                } else {
                    reject(new Error('Connection refused by peer'));
                }
            }, 500);
        });

        // Create mock socket with event simulation
        this.socket = {
            send: (data) => {
                console.log('Socket send:', data);
                // Simulate network delay
                setTimeout(() => {
                    this.simulateIncomingMessage(data);
                }, 50);
                return true;
            },

            close: () => {
                this.isConnected = false;
                this.peerConnection = null;
                console.log('Socket closed');
            }
        };
    }

    /**
     * Disconnect from peer
     */
    disconnect() {
        if (!this.isConnected) {
            return { success: true, alreadyDisconnected: true };
        }

        console.log('Disconnecting from peer...');

        // Stop heartbeat
        this.stopHeartbeat();

        // Close socket
        if (this.socket && this.socket.close) {
            this.socket.close();
        }

        this.isConnected = false;
        this.peerConnection = null;
        this.messageQueue = [];

        this.notifyListeners('disconnected', {
            timestamp: new Date(),
            message: 'Disconnected from peer'
        });

        return {
            success: true,
            message: 'Disconnected successfully'
        };
    }

    /**
     * Send message to peer
     */
    async sendMessage(type, data, options = {}) {
        if (!this.isConnected || !this.socket) {
            // Queue message for when connection is established
            if (options.queueIfDisconnected !== false) {
                this.messageQueue.push({ type, data, timestamp: new Date() });
                console.log('Message queued (connection not established):', type);

                return {
                    success: false,
                    queued: true,
                    message: 'Message queued for later delivery'
                };
            }

            throw new Error('Not connected to peer');
        }

        const message = {
            id: this.generateMessageId(),
            type,
            data,
            timestamp: new Date(),
            ...options
        };

        try {
            // Simulate sending
            const success = this.socket.send(JSON.stringify(message));

            if (!success) {
                throw new Error('Failed to send message');
            }

            this.notifyListeners('message-sent', message);

            return {
                success: true,
                messageId: message.id,
                timestamp: message.timestamp
            };

        } catch (error) {
            console.error('Failed to send message:', error);

            this.notifyListeners('send-error', {
                error: error.message,
                message
            });

            // Attempt to reconnect if needed
            if (options.retryOnFailure !== false) {
                await this.handleSendFailure();
            }

            throw error;
        }
    }

    /**
     * Send file chunk
     */
    async sendFileChunk(fileId, chunkIndex, totalChunks, chunkData, checksum) {
        const message = {
            type: 'file-chunk',
            fileId,
            chunkIndex,
            totalChunks,
            data: chunkData,
            checksum,
            timestamp: new Date()
        };

        return this.sendMessage('file-transfer', message, {
            priority: 'high',
            retryOnFailure: true
        });
    }

    /**
     * Request file transfer
     */
    async requestFileTransfer(files) {
        const message = {
            type: 'transfer-request',
            files: files.map(file => ({
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            })),
            timestamp: new Date()
        };

        return this.sendMessage('file-transfer', message);
    }

    /**
     * Acknowledge file chunk
     */
    async acknowledgeChunk(fileId, chunkIndex, success = true, error = null) {
        const message = {
            type: 'chunk-ack',
            fileId,
            chunkIndex,
            success,
            error,
            timestamp: new Date()
        };

        return this.sendMessage('file-transfer', message);
    }

    /**
     * Handle send failure
     */
    async handleSendFailure() {
        this.reconnectAttempts++;

        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            try {
                await this.reconnect();
                return true;
            } catch (error) {
                console.error('Reconnection failed:', error);
                return false;
            }
        } else {
            console.error('Max reconnection attempts reached');
            this.notifyListeners('reconnection-failed', {
                attempts: this.reconnectAttempts
            });
            return false;
        }
    }

    /**
     * Reconnect to peer
     */
    async reconnect() {
        if (!this.peerConnection) {
            throw new Error('No previous connection to reconnect to');
        }

        // Disconnect first
        this.disconnect();

        // Wait a bit before reconnecting
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Reconnect
        return this.connect(this.peerConnection.ip, this.peerConnection.port);
    }

    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendMessage('heartbeat', {
                    timestamp: new Date(),
                    clientId: 'etherlink-client'
                }, {
                    priority: 'low',
                    retryOnFailure: false
                }).catch(error => {
                    console.warn('Heartbeat failed:', error);
                });
            }
        }, 30000); // Every 30 seconds

        console.log('Heartbeat started');
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('Heartbeat stopped');
        }
    }

    /**
     * Process queued messages
     */
    processMessageQueue() {
        if (this.messageQueue.length === 0) return;

        console.log(`Processing ${this.messageQueue.length} queued messages...`);

        // Process messages in order
        const processNext = () => {
            if (this.messageQueue.length === 0 || !this.isConnected) return;

            const message = this.messageQueue.shift();
            this.sendMessage(message.type, message.data)
                .then(() => {
                    console.log('Queued message sent:', message.type);
                    processNext();
                })
                .catch(error => {
                    console.error('Failed to send queued message:', error);
                    // Re-queue if still relevant
                    if (Date.now() - message.timestamp < 60000) { // 1 minute
                        this.messageQueue.unshift(message);
                    }
                    setTimeout(processNext, 1000);
                });
        };

        processNext();
    }

    /**
     * Simulate incoming message (for simulation mode)
     */
    simulateIncomingMessage(originalMessage) {
        try {
            const parsed = JSON.parse(originalMessage);

            // Simulate response based on message type
            let response = null;

            switch (parsed.type) {
                case 'heartbeat':
                    response = {
                        type: 'heartbeat-ack',
                        timestamp: new Date(),
                        originalId: parsed.id
                    };
                    break;

                case 'file-transfer':
                    if (parsed.data.type === 'transfer-request') {
                        response = {
                            type: 'transfer-response',
                            requestId: parsed.id,
                            accepted: true,
                            timestamp: new Date()
                        };
                    } else if (parsed.data.type === 'file-chunk') {
                        response = {
                            type: 'chunk-ack',
                            fileId: parsed.data.fileId,
                            chunkIndex: parsed.data.chunkIndex,
                            success: true,
                            timestamp: new Date()
                        };
                    }
                    break;

                default:
                    response = {
                        type: 'ack',
                        originalId: parsed.id,
                        timestamp: new Date()
                    };
            }

            if (response) {
                // Simulate receiving the response
                setTimeout(() => {
                    this.handleIncomingMessage(JSON.stringify(response));
                }, 100);
            }

        } catch (error) {
            console.error('Error simulating response:', error);
        }
    }

    /**
     * Handle incoming message
     */
    handleIncomingMessage(messageData) {
        try {
            const message = JSON.parse(messageData);

            console.log('Incoming message:', message.type);

            // Notify listeners
            this.notifyListeners('message-received', message);

            // Handle specific message types
            switch (message.type) {
                case 'heartbeat-ack':
                    this.notifyListeners('heartbeat-ack', message);
                    break;

                case 'transfer-response':
                    this.notifyListeners('transfer-response', message);
                    break;

                case 'chunk-ack':
                    this.notifyListeners('chunk-ack', message);
                    break;

                case 'file-chunk':
                    this.notifyListeners('file-chunk-received', message);
                    break;

                case 'transfer-request':
                    this.notifyListeners('transfer-requested', message);
                    break;
            }

        } catch (error) {
            console.error('Error handling incoming message:', error);
            this.notifyListeners('message-error', {
                error: error.message,
                rawData: messageData
            });
        }
    }

    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            peerConnection: this.peerConnection,
            reconnectAttempts: this.reconnectAttempts,
            messageQueueLength: this.messageQueue.length,
            timestamp: new Date()
        };
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
        this.disconnect();
        this.stopHeartbeat();
        this.listeners.clear();
        this.messageQueue = [];
    }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;