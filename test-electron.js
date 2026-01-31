console.log('Electron version:', process.versions.electron);
console.log('Node version:', process.version);
try {
    const electron = require('electron');
    console.log('Electron require type:', typeof electron);
    console.log('Electron keys:', Object.keys(electron));
} catch (e) {
    console.log('Error requiring electron:', e.message);
}
