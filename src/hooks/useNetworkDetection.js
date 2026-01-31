// src/hooks/useNetworkDetection.js

import { useState, useEffect, useCallback } from 'react';
import networkService from '../services/networkService';
import { generateLinkLocalIP, isValidIP } from '../utils/helpers';

/**
 * Custom hook for network detection and configuration
 */
const useNetworkDetection = () => {
    const [networkState, setNetworkState] = useState({
        status: 'disconnected',
        interfaces: [],
        localIP: '',
        peerIP: '',
        peerName: '',
        speed: 0,
        progress: 0,
        error: null
    });

    const [configSteps, setConfigSteps] = useState([
        { id: 1, name: 'Scan interfaces', status: 'pending' },
        { id: 2, name: 'Assign IP', status: 'pending' },
        { id: 3, name: 'Configure firewall', status: 'pending' },
        { id: 4, name: 'Discover peer', status: 'pending' },
        { id: 5, name: 'Establish connection', status: 'pending' }
    ]);

    /**
     * Detect network interfaces
     */
    const detectInterfaces = useCallback(async () => {
        try {
            setNetworkState(prev => ({ ...prev, status: 'scanning', error: null }));
            updateStep(1, 'in-progress');

            const interfaces = await networkService.detectInterfaces();

            setNetworkState(prev => ({
                ...prev,
                interfaces,
                status: 'scanning'
            }));

            updateStep(1, 'completed');

            return interfaces;
        } catch (error) {
            console.error('Failed to detect interfaces:', error);
            setNetworkState(prev => ({
                ...prev,
                status: 'error',
                error: error.message
            }));
            updateStep(1, 'failed');
            throw error;
        }
    }, []);

    /**
     * Auto-configure network
     */
    const autoConfigure = useCallback(async () => {
        try {
            setNetworkState(prev => ({ ...prev, status: 'configuring', error: null }));

            // Step 2: Assign IP
            updateStep(2, 'in-progress');
            const localIP = generateLinkLocalIP();
            setNetworkState(prev => ({ ...prev, localIP }));
            await new Promise(resolve => setTimeout(resolve, 500));
            updateStep(2, 'completed');

            // Step 3: Configure firewall
            updateStep(3, 'in-progress');
            await new Promise(resolve => setTimeout(resolve, 300));
            updateStep(3, 'completed');

            // Step 4: Discover peer
            updateStep(4, 'in-progress');
            await new Promise(resolve => setTimeout(resolve, 1000));
            const peerIP = '169.254.45.13'; // Simulated peer
            setNetworkState(prev => ({ ...prev, peerIP, peerName: 'Computer-2' }));
            updateStep(4, 'completed');

            // Step 5: Establish connection
            updateStep(5, 'in-progress');
            await new Promise(resolve => setTimeout(resolve, 500));
            setNetworkState(prev => ({
                ...prev,
                status: 'connected',
                speed: 1000 // 1 Gbps
            }));
            updateStep(5, 'completed');

            return {
                success: true,
                localIP,
                peerIP,
                speed: 1000
            };
        } catch (error) {
            console.error('Auto-configuration failed:', error);
            setNetworkState(prev => ({
                ...prev,
                status: 'error',
                error: error.message
            }));
            throw error;
        }
    }, []);

    /**
     * Discover peer
     */
    const discoverPeer = useCallback(async () => {
        try {
            setNetworkState(prev => ({ ...prev, status: 'discovering' }));

            // Simulate peer discovery
            await new Promise(resolve => setTimeout(resolve, 1500));

            const peerIP = '169.254.45.13';
            setNetworkState(prev => ({
                ...prev,
                peerIP,
                peerName: 'Computer-2',
                status: 'connected',
                speed: 1000
            }));

            return {
                success: true,
                peerIP,
                peerName: 'Computer-2'
            };
        } catch (error) {
            console.error('Peer discovery failed:', error);
            setNetworkState(prev => ({
                ...prev,
                status: 'error',
                error: error.message
            }));
            throw error;
        }
    }, []);

    /**
     * Test connection speed
     */
    const testSpeed = useCallback(async () => {
        try {
            setNetworkState(prev => ({ ...prev, status: 'testing' }));

            // Simulate speed test
            await new Promise(resolve => setTimeout(resolve, 2000));

            const speed = Math.random() * 200 + 800; // 800-1000 Mbps

            setNetworkState(prev => ({
                ...prev,
                speed,
                status: 'connected'
            }));

            return speed;
        } catch (error) {
            console.error('Speed test failed:', error);
            throw error;
        }
    }, []);

    /**
     * Disconnect from peer
     */
    const disconnect = useCallback(() => {
        setNetworkState({
            status: 'disconnected',
            interfaces: networkState.interfaces,
            localIP: networkState.localIP,
            peerIP: '',
            peerName: '',
            speed: 0,
            progress: 0,
            error: null
        });

        // Reset steps
        setConfigSteps(prev =>
            prev.map(step => ({ ...step, status: 'pending' }))
        );

        return true;
    }, [networkState.interfaces, networkState.localIP]);

    /**
     * Update configuration step
     */
    const updateStep = useCallback((stepId, status) => {
        setConfigSteps(prev =>
            prev.map(step =>
                step.id === stepId ? { ...step, status } : step
            )
        );
    }, []);

    /**
     * Reset configuration
     */
    const resetConfiguration = useCallback(() => {
        setNetworkState({
            status: 'disconnected',
            interfaces: [],
            localIP: '',
            peerIP: '',
            peerName: '',
            speed: 0,
            progress: 0,
            error: null
        });

        setConfigSteps(prev =>
            prev.map(step => ({ ...step, status: 'pending' }))
        );
    }, []);

    /**
     * Get connected Ethernet interface
     */
    const getConnectedEthernet = useCallback(() => {
        return networkState.interfaces.find(iface =>
            iface.type === 'wired' && iface.connected
        );
    }, [networkState.interfaces]);

    /**
     * Initialize network detection
     */
    useEffect(() => {
        const initialize = async () => {
            try {
                await detectInterfaces();

                // Auto-configure if Ethernet is connected
                const ethernet = getConnectedEthernet();
                if (ethernet) {
                    await autoConfigure();
                }
            } catch (error) {
                console.error('Network initialization failed:', error);
            }
        };

        initialize();

        // Cleanup
        return () => {
            // Cleanup network service if needed
        };
    }, [detectInterfaces, autoConfigure, getConnectedEthernet]);

    return {
        // State
        networkState,
        configSteps,

        // Actions
        detectInterfaces,
        autoConfigure,
        discoverPeer,
        testSpeed,
        disconnect,
        resetConfiguration,
        updateStep,
        getConnectedEthernet,

        // Computed values
        isConnected: networkState.status === 'connected',
        isConfiguring: networkState.status === 'configuring',
        hasError: networkState.status === 'error',
        canTransfer: networkState.status === 'connected' && isValidIP(networkState.peerIP)
    };
};

export default useNetworkDetection;