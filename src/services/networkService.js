// src/services/networkService.js
import electronBridge from './electronBridge';

/**
 * Network Service - Handles all network-related operations
 * In a real Electron app, this would use Node.js networking APIs
 */

class NetworkService {
    constructor() {
        this.peerIP = null;
        this.localIP = null;
        this.connectionStatus = 'disconnected';
        this.interfaces = [];
        this.listeners = new Map();
    }

    /**
     * Detect network interfaces
     */
    async detectInterfaces() {
        console.log('Detecting network interfaces via Electron Bridge...');
        try {
            const interfaces = await electronBridge.detectNetworkInterfaces();
            this.interfaces = interfaces;
            this.notifyListeners('interfaces-detected', interfaces);
            return interfaces;
        } catch (error) {
            console.error('Failed to detect interfaces:', error);
            throw error;
        }
    }

    /**
     * Auto-configure network for Ethernet transfer
     */
    async autoConfigure() {
        console.log('Auto-configuring network...');

        try {
            // Step 1: Get Ethernet interface
            const ethernetInterface = this.interfaces.find(i =>
                i.type === 'wired' && i.connected
            );

            if (!ethernetInterface) {
                throw new Error('No connected Ethernet interface found');
            }

            // Step 2: Assign link-local IP if needed
            if (!this.hasLinkLocalIP(ethernetInterface)) {
                await this.assignLinkLocalIP(ethernetInterface.name);
            }

            // Step 3: Configure firewall rules
            await this.configureFirewall();

            // Step 4: Start listening for peers
            await this.startPeerDiscovery();

            this.connectionStatus = 'configuring';
            this.notifyListeners('configuring', null);

            return {
                success: true,
                interface: ethernetInterface.name,
                ip: this.localIP,
                message: 'Network auto-configured successfully'
            };

        } catch (error) {
            console.error('Auto-configuration failed:', error);
            this.notifyListeners('config-error', error.message);

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Assign link-local IP address
     */
    async assignLinkLocalIP(interfaceName) {
        console.log(`Assigning link-local IP to ${interfaceName}...`);

        // Generate random link-local IP (169.254.x.x)
        const thirdOctet = Math.floor(Math.random() * 254) + 1;
        const fourthOctet = Math.floor(Math.random() * 254) + 1;
        const ip = `169.254.${thirdOctet}.${fourthOctet}`;

        this.localIP = ip;

        // In a real app, this would execute system commands:
        // Windows: netsh interface ip set address...
        // Linux: ip addr add 169.254.x.x/16 dev eth0
        // macOS: networksetup -setmanual Ethernet 169.254.x.x 255.255.0.0

        await new Promise(resolve => setTimeout(resolve, 500));

        this.notifyListeners('ip-assigned', { ip, interface: interfaceName });

        return ip;
    }

    /**
     * Configure firewall for file transfer
     */
    async configureFirewall() {
        console.log('Configuring firewall rules...');

        // In a real app, this would configure OS firewall
        // to allow traffic on port 9001

        await new Promise(resolve => setTimeout(resolve, 300));

        this.notifyListeners('firewall-configured', null);

        return true;
    }

    /**
     * Start peer discovery
     */
    async startPeerDiscovery() {
        console.log('Starting peer discovery via Electron Bridge...');

        // Listen for peer discovered events from bridge
        electronBridge.on('peer-found', (peer) => {
            this.peerIP = peer.ip;
            this.connectionStatus = 'connected';
            this.notifyListeners('peer-found', peer);
        });

        return electronBridge.discoverPeer();
    }

    /**
     * Check if interface has link-local IP
     */
    hasLinkLocalIP(iface) {
        return iface.addresses.some(addr =>
            addr.address.startsWith('169.254.')
        );
    }

    /**
     * Ping peer to check reachability
     */
    async pingPeer(ip) {
        // Simulate ping
        await new Promise(resolve => setTimeout(resolve, 100));

        // In a real app, this would use net module or child_process
        // For simulation, always return true after delay
        return true;
    }

    /**
     * Get network status
     */
    getStatus() {
        return {
            status: this.connectionStatus,
            localIP: this.localIP,
            peerIP: this.peerIP,
            interfaces: this.interfaces,
            timestamp: new Date()
        };
    }

    /**
     * Disconnect from peer
     */
    async disconnect() {
        console.log('Disconnecting...');

        this.connectionStatus = 'disconnected';
        this.peerIP = null;

        this.notifyListeners('disconnected', null);

        return true;
    }

    /**
     * Scan for available networks
     */
    async scanNetworks() {
        console.log('Scanning networks...');

        // Simulate network scan
        await new Promise(resolve => setTimeout(resolve, 1500));

        const networks = [
            { ssid: 'EtherLink-Peer-1', signal: 100, secure: true },
            { ssid: 'EtherLink-Peer-2', signal: 85, secure: true },
            { ssid: 'Office-Network', signal: 60, secure: true }
        ];

        this.notifyListeners('networks-scanned', networks);

        return networks;
    }

    /**
     * Test connection speed
     */
    async testSpeed(peerIP = this.peerIP) {
        if (!peerIP) {
            throw new Error('No peer IP specified');
        }

        console.log(`Testing connection speed with ${peerIP}...`);

        // Simulate speed test
        await new Promise(resolve => setTimeout(resolve, 2000));

        const results = {
            ping: Math.random() * 5 + 1, // 1-6 ms
            download: Math.random() * 200 + 800, // 800-1000 Mbps
            upload: Math.random() * 200 + 800, // 800-1000 Mbps
            jitter: Math.random() * 2, // 0-2 ms
            packetLoss: 0
        };

        this.notifyListeners('speed-test-complete', results);

        return results;
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
        this.listeners.clear();
        this.connectionStatus = 'disconnected';
        this.peerIP = null;
        this.localIP = null;
    }
}

// Export singleton instance
const networkService = new NetworkService();
export default networkService;