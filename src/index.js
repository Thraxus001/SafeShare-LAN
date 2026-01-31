// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './components/App.css';
import App from './components/App';

// Initialize global services
import networkService from './services/networkService';
import transferService from './services/transferService';
import electronBridge from './services/electronBridge';

// Make services available globally for debugging
if (process.env.NODE_ENV === 'development') {
    window.services = {
        networkService,
        transferService,
        electronBridge
    };
}

// Initialize Electron bridge
electronBridge.initialize().then(result => {
    console.log(`Running in ${result.mode} mode`);
}).catch(error => {
    console.error('Failed to initialize Electron bridge:', error);
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Hide loading screen when app is ready
window.addEventListener('load', () => {
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 500);
});