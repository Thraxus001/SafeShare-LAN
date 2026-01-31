const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipcRenderer', {
    send: (channel, data) => {
        // Whitelist channels if needed
        let validChannels = ['detect-network-interfaces', 'configure-network', 'discover-peer', 'test-connection', 'select-files', 'transfer-files', 'cancel-transfer', 'get-system-info', 'open-folder', 'show-notification'];
        // Allowing all for now based on current electronBridge implementation
        ipcRenderer.send(channel, data);
    },
    invoke: (channel, data) => {
        return ipcRenderer.invoke(channel, data);
    },
    on: (channel, func) => {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
    },
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
