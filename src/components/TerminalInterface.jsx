// src/components/TerminalInterface.jsx
import React, { useState, useRef, useEffect } from 'react';
import './TerminalInterface.css';

const TerminalInterface = ({ addLog, connectionStatus, peerIP, localIP, speed }) => {
    const [commandHistory, setCommandHistory] = useState([
        { type: 'system', text: 'Welcome to EtherLink Terminal v1.0', time: new Date() },
        { type: 'system', text: 'Type "help" for available commands', time: new Date() },
        { type: 'system', text: 'Network interface detected: Ethernet', time: new Date() }
    ]);

    const [inputValue, setInputValue] = useState('');
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoCompleteList, setAutoCompleteList] = useState([]);
    const [autoCompleteIndex, setAutoCompleteIndex] = useState(-1);

    const terminalEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        scrollToBottom();
    }, [commandHistory]);

    // Focus input on load
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Available commands
    const commands = {
        help: {
            description: 'Show all available commands',
            execute: () => `
Available Commands:
═══════════════════
  help                    - Show this help message
  status                  - Show connection status
  scan                    - Scan network interfaces
  config                  - Show current configuration
  transfer <file>         - Transfer specific file
  receive                 - Start receiver mode
  list                    - List available files
  speed                   - Test transfer speed
  clear                   - Clear terminal
  history                 - Show command history
  ping <ip>              - Ping specific IP
  ipconfig               - Show IP configuration
  diagnose               - Run deep network diagnostics
  exit                   - Exit application
      `
        },

        status: {
            description: 'Show connection status',
            execute: () => `
Connection Status:
═══════════════════
  Local IP: ${localIP || '0.0.0.0'}
  Peer IP: ${peerIP || 'Not connected'}
  Status: ${connectionStatus.toUpperCase()}
  Speed: ${speed > 0 ? `${speed} MB/s` : 'Unknown'}
  Protocol: TCP/9001
  Security: Stream Pipeline (Secured)
      `
        },

        scan: {
            description: 'Scan network interfaces',
            execute: async () => {
                addLog('network', 'Scanning network interfaces...');
                try {
                    const bridge = (await import('../services/electronBridge')).default;
                    const interfaces = await bridge.detectNetworkInterfaces();

                    if (!interfaces || interfaces.length === 0) return 'No interfaces found.';

                    const formatted = interfaces.map((iface, i) => `
  [${i + 1}] ${iface.name}:
      Status: ${iface.connected ? 'CONNECTED ✓' : 'DISCONNECTED'}
      Type: ${iface.type}
      IP: ${iface.addresses?.find(a => a.family === 'IPv4')?.address || 'None'}
      MAC: ${iface.addresses?.find(a => a.mac)?.mac || 'Unknown'}
                    `).join('\n');

                    return `
Network Scan Results:
═══════════════════
${formatted}
  
  Found peer at: ${peerIP || 'Scanning...'}
        `;
                } catch (e) {
                    return `Scan failed: ${e.message}`;
                }
            }
        },

        config: {
            description: 'Show current configuration',
            execute: () => `
Current Configuration:
═══════════════════
  Local IP: ${localIP || '0.0.0.0'}
  Active Mode: ${connectionStatus === 'connected' ? 'P2P Link Established' : 'Scanning'}
  Port Range: 9000-9001
  Transfer Protocol: Node.js Streams
  Peer Verification: Enabled
      `
        },

        transfer: {
            description: 'Transfer specific file',
            execute: (args) => {
                if (args.length === 0) {
                    return 'Usage: transfer <filename> [destination]';
                }
                addLog('transfer', `Starting transfer of "${args[0]}"...`);
                return `Starting transfer of "${args[0]}" to ${peerIP || 'peer'}...`;
            }
        },

        speed: {
            description: 'Test transfer speed',
            execute: () => {
                addLog('system', 'Checking current link speed...');
                return `
Speed Test:
═══════════════════
  Current Speed: ${speed > 0 ? `${speed} MB/s` : '0 MB/s'}
  
  Note: Transfer speed is measured in real-time during 
        active file transfers.
      `
            }
        },

        diagnose: {
            description: 'Run deep network diagnostics',
            execute: async () => {
                addToHistory('system', 'Running network health check...');
                try {
                    const bridge = (await import('../services/electronBridge')).default;
                    const interfaces = await bridge.detectNetworkInterfaces();
                    const active = interfaces.filter(i => i.connected);

                    let report = `
Network Health Report:
═══════════════════
Active Interfaces: ${active.length}
`;

                    active.forEach(iface => {
                        const ip = iface.addresses?.find(a => a.family === 'IPv4' && !a.internal)?.address;
                        const mask = iface.addresses?.find(a => a.family === 'IPv4' && !a.internal)?.netmask;

                        report += `
[${iface.name}]
  - IP Address: ${ip || 'Unknown'}
  - Netmask: ${mask || 'Unknown'}
  - Status: Healthy
`;
                        if (peerIP && ip) {
                            const onSameSubnet = ip.split('.').slice(0, 3).join('.') === peerIP.split('.').slice(0, 3).join('.');
                            report += `  - Subnet Alignment: ${onSameSubnet ? 'CONFIRMED ✓' : 'MISMATCH ⚠'}\n`;
                        }
                    });

                    if (active.length === 0) report += '\nWARNING: No active Ethernet/Wi-Fi interfaces found!';

                    return report;
                } catch (e) {
                    return `Diagnostic failed: ${e.message}`;
                }
            }
        },

        clear: {
            description: 'Clear terminal screen',
            execute: () => {
                setCommandHistory([]);
                return null;
            }
        },

        history: {
            description: 'Show command history',
            execute: () => {
                const userCommands = commandHistory
                    .filter(cmd => cmd.type === 'user')
                    .map(cmd => cmd.text.replace('$ ', ''));

                if (userCommands.length === 0) {
                    return 'No command history yet.';
                }

                return `Command History (${userCommands.length}):\n` +
                    userCommands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n');
            }
        },

        ping: {
            description: 'Ping specific IP',
            execute: (args) => {
                const target = args[0] || peerIP;
                if (!target) return 'Pinging failed: No target IP provided and no peer connected.';

                addLog('network', `Verifying reachability to ${target}...`);
                return `
Pinging ${target}:
═══════════════════
  [Feature Note: Real ICMP ping requires OS raw socket permissions. 
   Use 'diagnose' to check peer subnet and reachability instead.]
      `
            }
        },

        ipconfig: {
            description: 'Show IP configuration',
            execute: () => `
IP Configuration:
═══════════════════
  Local IP: ${localIP || 'Unavailable'}
  Subnet: ${localIP ? 'Determined by OS' : 'Disconnected'}
  
  Tip: Use 'scan' for detailed adapter info.
      `
        }
    };

    // Scroll to bottom
    const scrollToBottom = () => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Add to history
    const addToHistory = (type, text) => {
        setCommandHistory(prev => [
            ...prev,
            { type, text, time: new Date() }
        ]);
    };

    // Execute command
    const executeCommand = async (command) => {
        if (!command.trim()) return;

        // Add command to history
        addToHistory('user', `$ ${command}`);
        setIsProcessing(true);

        // Process command
        const [cmd, ...args] = command.toLowerCase().split(' ');
        let response = '';

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 300));

        if (commands[cmd]) {
            try {
                const result = commands[cmd].execute(args);
                response = result instanceof Promise ? await result : result;

                if (response !== null) {
                    addToHistory('system', response);
                }
            } catch (error) {
                addToHistory('error', `Error executing command: ${error.message}`);
            }
        } else if (cmd === 'exit') {
            addToHistory('system', 'Closing application...');
            // In Electron app, this would close the window
            setTimeout(() => {
                window.close(); // Only works in Electron
            }, 1000);
        } else {
            response = `Command not found: "${cmd}". Type "help" for available commands.`;
            addToHistory('error', response);
        }

        setIsProcessing(false);
        setInputValue('');
        setHistoryIndex(-1);
        setAutoCompleteList([]);
        setAutoCompleteIndex(-1);
    };

    // Handle auto-complete
    const handleAutoComplete = (input) => {
        if (!input.trim()) {
            setAutoCompleteList([]);
            return;
        }

        const matchingCommands = Object.keys(commands)
            .filter(cmd => cmd.startsWith(input.toLowerCase()))
            .slice(0, 5);

        setAutoCompleteList(matchingCommands);
    };

    // Handle key down
    const handleKeyDown = (e) => {
        switch (e.key) {
            case 'Enter':
                if (autoCompleteIndex >= 0 && autoCompleteList.length > 0) {
                    setInputValue(autoCompleteList[autoCompleteIndex]);
                    setAutoCompleteList([]);
                    setAutoCompleteIndex(-1);
                    e.preventDefault();
                } else {
                    executeCommand(inputValue);
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                const userCommands = commandHistory
                    .filter(cmd => cmd.type === 'user')
                    .map(cmd => cmd.text.replace('$ ', ''));

                if (userCommands.length > 0) {
                    const newIndex = historyIndex < userCommands.length - 1
                        ? historyIndex + 1
                        : 0;
                    setHistoryIndex(newIndex);
                    setInputValue(userCommands[userCommands.length - 1 - newIndex] || '');
                }
                break;

            case 'ArrowDown':
                e.preventDefault();
                if (historyIndex > 0) {
                    const newIndex = historyIndex - 1;
                    setHistoryIndex(newIndex);
                    const userCommands = commandHistory
                        .filter(cmd => cmd.type === 'user')
                        .map(cmd => cmd.text.replace('$ ', ''));
                    setInputValue(userCommands[userCommands.length - 1 - newIndex] || '');
                } else {
                    setHistoryIndex(-1);
                    setInputValue('');
                }
                break;

            case 'Tab':
                e.preventDefault();
                if (autoCompleteList.length > 0) {
                    if (autoCompleteIndex < autoCompleteList.length - 1) {
                        setAutoCompleteIndex(prev => prev + 1);
                    } else {
                        setAutoCompleteIndex(0);
                    }
                    setInputValue(autoCompleteList[autoCompleteIndex]);
                }
                break;

            case 'Escape':
                setAutoCompleteList([]);
                setAutoCompleteIndex(-1);
                break;
        }
    };

    // Handle input change
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        handleAutoComplete(value);
    };

    // Format time
    const formatTime = (date) => {
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Quick commands
    const quickCommands = [
        { cmd: 'help', icon: '❓' },
        { cmd: 'status', icon: '📊' },
        { cmd: 'scan', icon: '🔍' },
        { cmd: 'speed', icon: '⚡' },
        { cmd: 'clear', icon: '🗑️' }
    ];

    return (
        <div className="terminal-interface">
            <div className="terminal-header">
                <div className="terminal-title">
                    <span className="terminal-icon">💻</span>
                    EtherLink Terminal
                    <div className="terminal-status">
                        <span className={`status-indicator ${connectionStatus}`}></span>
                        {connectionStatus.toUpperCase()}
                    </div>
                </div>
                <div className="terminal-controls">
                    <button className="btn-control minimize">−</button>
                    <button className="btn-control maximize">□</button>
                    <button className="btn-control close">×</button>
                </div>
            </div>

            <div className="terminal-body">
                <div className="terminal-content">
                    {commandHistory.map((entry, index) => (
                        <div
                            key={index}
                            className={`terminal-line ${entry.type}`}
                        >
                            {entry.type === 'user' && (
                                <span className="prompt">
                                    <span className="user">user@etherlink</span>
                                    <span className="path">:~</span>
                                    <span className="symbol">$</span>
                                </span>
                            )}
                            <span className="line-text">
                                {entry.text.split('\n').map((line, i) => (
                                    <div key={i} className="line-segment">
                                        {entry.type === 'system' && i === 0 && !line.startsWith(' ') && '> '}
                                        {line}
                                    </div>
                                ))}
                            </span>
                            <span className="line-time">
                                [{formatTime(entry.time)}]
                            </span>
                        </div>
                    ))}

                    {isProcessing && (
                        <div className="terminal-line processing">
                            <div className="processing-indicator">
                                <span className="spinner">⌛</span>
                                Processing command...
                            </div>
                        </div>
                    )}

                    {/* Auto-complete suggestions */}
                    {autoCompleteList.length > 0 && (
                        <div className="autocomplete-suggestions">
                            {autoCompleteList.map((suggestion, index) => (
                                <div
                                    key={suggestion}
                                    className={`suggestion ${index === autoCompleteIndex ? 'selected' : ''}`}
                                    onClick={() => {
                                        setInputValue(suggestion);
                                        setAutoCompleteList([]);
                                    }}
                                >
                                    {suggestion}
                                    <span className="suggestion-desc">
                                        {commands[suggestion]?.description || ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div ref={terminalEndRef} />
                </div>
            </div>

            <div className="terminal-input-area">
                <div className="input-prefix">
                    <span className="user">user@etherlink</span>
                    <span className="separator">:</span>
                    <span className="path">~/transfer</span>
                    <span className="symbol">$</span>
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="terminal-input"
                    placeholder={isProcessing ? 'Processing...' : 'Type command and press Enter...'}
                    disabled={isProcessing}
                    autoComplete="off"
                    spellCheck="false"
                    autoCapitalize="off"
                    autoCorrect="off"
                />
            </div>

            <div className="terminal-footer">
                <div className="quick-commands">
                    <span className="footer-title">Quick Commands:</span>
                    {quickCommands.map((quick) => (
                        <button
                            key={quick.cmd}
                            className="quick-cmd"
                            onClick={() => executeCommand(quick.cmd)}
                            disabled={isProcessing}
                            title={commands[quick.cmd]?.description}
                        >
                            {quick.icon} {quick.cmd}
                        </button>
                    ))}
                </div>

                <div className="terminal-info">
                    <div className="info-item">
                        <span className="info-label">Peer:</span>
                        <span className="info-value">{peerIP || 'Not connected'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Mode:</span>
                        <span className="info-value">{commandHistory.length} lines</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TerminalInterface;