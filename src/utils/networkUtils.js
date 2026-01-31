// src/utils/networkUtils.js

/**
 * Network-specific utilities
 */

/**
 * Check if IP is in link-local range
 */
export const isLinkLocalIP = (ip) => {
    const parts = ip.split('.').map(Number);
    return parts[0] === 169 && parts[1] === 254;
};

/**
 * Get network interface by name
 */
export const getInterfaceByName = (interfaces, name) => {
    return interfaces.find(iface =>
        iface.name.toLowerCase() === name.toLowerCase()
    );
};

/**
 * Get connected Ethernet interface
 */
export const getConnectedEthernet = (interfaces) => {
    return interfaces.find(iface =>
        iface.type === 'wired' && iface.connected
    );
};

/**
 * Calculate network mask from prefix length
 */
export const prefixLengthToMask = (prefixLength) => {
    const mask = [];
    for (let i = 0; i < 4; i++) {
        const n = Math.min(prefixLength, 8);
        mask.push(256 - Math.pow(2, 8 - n));
        prefixLength -= n;
    }
    return mask.join('.');
};

/**
 * Calculate prefix length from subnet mask
 */
export const maskToPrefixLength = (mask) => {
    const parts = mask.split('.').map(Number);
    return parts.reduce((count, part) => {
        return count + part.toString(2).split('1').length - 1;
    }, 0);
};

/**
 * Check if two IPs are in same subnet
 */
export const isSameSubnet = (ip1, ip2, subnetMask) => {
    const ip1Parts = ip1.split('.').map(Number);
    const ip2Parts = ip2.split('.').map(Number);
    const maskParts = subnetMask.split('.').map(Number);

    for (let i = 0; i < 4; i++) {
        if ((ip1Parts[i] & maskParts[i]) !== (ip2Parts[i] & maskParts[i])) {
            return false;
        }
    }

    return true;
};

/**
 * Get broadcast address
 */
export const getBroadcastAddress = (ip, subnetMask) => {
    const ipParts = ip.split('.').map(Number);
    const maskParts = subnetMask.split('.').map(Number);
    const broadcast = [];

    for (let i = 0; i < 4; i++) {
        broadcast.push(ipParts[i] | (~maskParts[i] & 255));
    }

    return broadcast.join('.');
};

/**
 * Get network address
 */
export const getNetworkAddress = (ip, subnetMask) => {
    const ipParts = ip.split('.').map(Number);
    const maskParts = subnetMask.split('.').map(Number);
    const network = [];

    for (let i = 0; i < 4; i++) {
        network.push(ipParts[i] & maskParts[i]);
    }

    return network.join('.');
};

/**
 * Generate random MAC address
 */
export const generateMacAddress = () => {
    const hexDigits = '0123456789ABCDEF';
    let mac = '';

    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 2; j++) {
            mac += hexDigits[Math.floor(Math.random() * 16)];
        }
        if (i < 5) mac += ':';
    }

    return mac;
};

/**
 * Parse network interface data
 */
export const parseInterfaceData = (iface) => {
    return {
        name: iface.name || 'Unknown',
        type: iface.type || 'unknown',
        connected: iface.connected || false,
        ip: iface.addresses?.[0]?.address || '',
        mac: iface.addresses?.[0]?.mac || generateMacAddress(),
        speed: iface.speed || 'Unknown',
        mtu: iface.mtu || 1500
    };
};

/**
 * Simulate network scan
 */
export const simulateNetworkScan = async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));

    return [
        {
            name: 'Ethernet',
            type: 'wired',
            connected: true,
            ip: '169.254.45.12',
            mac: '00:1A:2B:3C:4D:5E',
            speed: '1 Gbps',
            mtu: 1500
        },
        {
            name: 'Wi-Fi',
            type: 'wireless',
            connected: false,
            ip: '',
            mac: '00:1A:2B:3C:4D:5F',
            speed: '0 Mbps',
            mtu: 1500
        }
    ];
};

/**
 * Simulate peer discovery
 */
export const simulatePeerDiscovery = async (localIP) => {
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate peer IP in same link-local range
    const parts = localIP.split('.').map(Number);
    const peerThirdOctet = parts[2] === 45 ? 46 : 45;
    const peerIP = `169.254.${peerThirdOctet}.13`;

    return {
        success: true,
        peerIP,
        peerName: 'Computer-2',
        protocol: 'TCP/9001',
        timestamp: new Date()
    };
};

/**
 * Simulate connection test
 */
export const simulateConnectionTest = async (peerIP) => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
        success: true,
        peerIP,
        ping: Math.random() * 5 + 1, // 1-6 ms
        download: Math.random() * 200 + 800, // 800-1000 Mbps
        upload: Math.random() * 200 + 800, // 800-1000 Mbps
        jitter: Math.random() * 2, // 0-2 ms
        packetLoss: 0,
        timestamp: new Date()
    };
};

/**
 * Calculate network throughput
 */
export const calculateThroughput = (fileSize, transferTime) => {
    if (!transferTime || transferTime <= 0) return 0;

    const bytesPerSecond = fileSize / (transferTime / 1000);
    return bytesPerSecond / (1024 * 1024); // Convert to MB/s
};

/**
 * Estimate transfer time
 */
export const estimateTransferTime = (fileSize, networkSpeed) => {
    if (!networkSpeed || networkSpeed <= 0) return Infinity;

    // Convert network speed from Mbps to bytes/s
    const bytesPerSecond = (networkSpeed * 1024 * 1024) / 8;
    return (fileSize / bytesPerSecond) * 1000; // Return in milliseconds
};

/**
 * Get default transfer port
 */
export const getDefaultPort = () => {
    return 9001;
};

/**
 * Get available ports for transfer
 */
export const getAvailablePorts = (count = 10) => {
    const ports = [];
    const startPort = 9000;

    for (let i = 0; i < count; i++) {
        ports.push(startPort + i);
    }

    return ports;
};

/**
 * Validate port number
 */
export const isValidPort = (port) => {
    const portNum = parseInt(port, 10);
    return portNum >= 1 && portNum <= 65535;
};

/**
 * Get network protocol name
 */
export const getProtocolName = (protocol) => {
    const protocols = {
        'tcp': 'TCP',
        'udp': 'UDP',
        'http': 'HTTP',
        'https': 'HTTPS',
        'ftp': 'FTP',
        'sftp': 'SFTP'
    };

    return protocols[protocol.toLowerCase()] || protocol.toUpperCase();
};

/**
 * Format network speed
 */
export const formatNetworkSpeed = (speedInMbps) => {
    if (speedInMbps < 1) {
        return `${(speedInMbps * 1000).toFixed(0)} Kbps`;
    }

    if (speedInMbps < 1000) {
        return `${speedInMbps.toFixed(1)} Mbps`;
    }

    return `${(speedInMbps / 1000).toFixed(2)} Gbps`;
};

/**
 * Get network quality indicator
 */
export const getNetworkQuality = (ping, jitter, packetLoss) => {
    let score = 100;

    // Deduct points based on metrics
    if (ping > 100) score -= 40;
    else if (ping > 50) score -= 20;
    else if (ping > 20) score -= 10;

    if (jitter > 10) score -= 30;
    else if (jitter > 5) score -= 15;
    else if (jitter > 2) score -= 5;

    if (packetLoss > 5) score -= 50;
    else if (packetLoss > 2) score -= 25;
    else if (packetLoss > 0) score -= 10;

    if (score >= 80) return { level: 'excellent', color: '#2ecc71', score };
    if (score >= 60) return { level: 'good', color: '#f39c12', score };
    if (score >= 40) return { level: 'fair', color: '#e67e22', score };
    return { level: 'poor', color: '#e74c3c', score };
};