console.log('Env variables:', JSON.stringify(process.env, null, 2));
console.log('Electron API available:', !!process.versions.electron);
try {
    const electron = require('electron');
    console.log('Require electron result type:', typeof electron);
} catch (e) { console.log(e); }
