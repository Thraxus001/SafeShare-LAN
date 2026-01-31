// src/utils/helpers.js

/**
 * Utility helpers for the application
 */

/**
 * Format file size in human readable format
 */
export const formatFileSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format time duration
 */
export const formatDuration = (milliseconds) => {
    if (milliseconds < 1000) {
        return `${milliseconds}ms`;
    }

    const seconds = Math.floor(milliseconds / 1000);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
        return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m`;
};

/**
 * Format date/time
 */
export const formatDateTime = (date, includeSeconds = true) => {
    if (!date) return 'N/A';

    const d = new Date(date);

    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        ...(includeSeconds && { second: '2-digit' })
    };

    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], timeOptions);
};

/**
 * Get file icon based on file type
 */
export const getFileIcon = (fileName, fileType = '') => {
    const name = (fileName || '').toLowerCase();
    const type = (fileType || '').toLowerCase();

    // Images
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(name)) {
        return '🖼️';
    }

    // Videos
    if (type.startsWith('video/') || /\.(mp4|avi|mov|wmv|flv|mkv|webm)$/i.test(name)) {
        return '🎬';
    }

    // Audio
    if (type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg)$/i.test(name)) {
        return '🎵';
    }

    // Documents
    if (/\.(pdf)$/i.test(name)) {
        return '📕';
    }

    if (/\.(doc|docx)$/i.test(name)) {
        return '📄';
    }

    if (/\.(xls|xlsx|csv)$/i.test(name)) {
        return '📊';
    }

    if (/\.(ppt|pptx)$/i.test(name)) {
        return '📽️';
    }

    if (/\.(txt|rtf|md)$/i.test(name)) {
        return '📝';
    }

    // Archives
    if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(name)) {
        return '📦';
    }

    // Code files
    if (/\.(js|jsx|ts|tsx|py|java|cpp|c|html|css|scss|json|xml|yml|yaml)$/i.test(name)) {
        return '💻';
    }

    // Executables
    if (/\.(exe|dmg|app|msi|bat|sh)$/i.test(name)) {
        return '⚙️';
    }

    // Default
    return '📁';
};

/**
 * Get file type category
 */
export const getFileCategory = (fileName, fileType = '') => {
    const name = (fileName || '').toLowerCase();
    const type = (fileType || '').toLowerCase();

    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type.startsWith('audio/')) return 'Audio';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('document') || /\.(doc|docx|txt|rtf)$/i.test(name)) return 'Document';
    if (type.includes('spreadsheet') || /\.(xls|xlsx|csv)$/i.test(name)) return 'Spreadsheet';
    if (type.includes('presentation') || /\.(ppt|pptx)$/i.test(name)) return 'Presentation';
    if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'Archive';
    if (/\.(exe|dmg|app|msi)$/i.test(name)) return 'Executable';

    return 'Other';
};

/**
 * Generate a unique ID
 */
export const generateId = (prefix = 'id') => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Validate IP address
 */
export const isValidIP = (ip) => {
    // IPv4 validation
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    // Link-local IP range (169.254.0.0/16)
    if (ipv4Regex.test(ip)) {
        const parts = ip.split('.').map(Number);
        if (parts[0] === 169 && parts[1] === 254) {
            return true;
        }
    }

    return false;
};

/**
 * Generate random link-local IP
 */
export const generateLinkLocalIP = () => {
    const thirdOctet = Math.floor(Math.random() * 254) + 1;
    const fourthOctet = Math.floor(Math.random() * 254) + 1;
    return `169.254.${thirdOctet}.${fourthOctet}`;
};

/**
 * Calculate transfer time estimate
 */
export const calculateTransferTime = (fileSize, speed) => {
    if (!speed || speed <= 0) return 'Calculating...';

    const bytesPerSecond = speed * 1024 * 1024; // Convert MB/s to bytes/s
    const seconds = fileSize / bytesPerSecond;

    if (seconds < 60) {
        return `${Math.ceil(seconds)} seconds`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.ceil(seconds % 60);

    if (minutes < 60) {
        return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m`;
};

/**
 * Calculate progress percentage
 */
export const calculateProgress = (transferred, total) => {
    if (!total || total <= 0) return 0;
    return Math.min(100, (transferred / total) * 100);
};

/**
 * Format speed
 */
export const formatSpeed = (bytesPerSecond) => {
    if (bytesPerSecond < 1024) {
        return `${bytesPerSecond.toFixed(1)} B/s`;
    }

    const kb = bytesPerSecond / 1024;
    if (kb < 1024) {
        return `${kb.toFixed(1)} KB/s`;
    }

    const mb = kb / 1024;
    if (mb < 1024) {
        return `${mb.toFixed(1)} MB/s`;
    }

    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB/s`;
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text) => {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
};

/**
 * Download data as file
 */
export const downloadFile = (data, filename, type = 'text/plain') => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Generate checksum for data
 */
export const generateChecksum = async (data) => {
    // Simple checksum for simulation
    // In a real app, use crypto.subtle.digest()
    let hash = 0;
    const str = typeof data === 'string' ? data : JSON.stringify(data);

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
};

/**
 * Sleep/delay function
 */
export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            const delay = baseDelay * Math.pow(2, i);
            console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
            await sleep(delay);
        }
    }
};

/**
 * Parse command line arguments
 */
export const parseCommand = (command) => {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { cmd, args, raw: command };
};

/**
 * Validate file name
 */
export const isValidFileName = (fileName) => {
    if (!fileName || fileName.length === 0) return false;

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(fileName)) return false;

    // Check for reserved names (Windows)
    const reservedNames = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    const nameWithoutExt = fileName.split('.')[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) return false;

    // Check length
    if (fileName.length > 255) return false;

    return true;
};

/**
 * Get file extension
 */
export const getFileExtension = (fileName) => {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text, maxLength) => {
    if (!text || text.length <= maxLength) return text;

    return text.substring(0, maxLength - 3) + '...';
};

/**
 * Generate password for secure transfer
 */
export const generatePassword = (length = 12) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }

    return password;
};

/**
 * Measure execution time
 */
export const measureTime = async (fn, label = 'Operation') => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;

    console.log(`${label} took ${duration.toFixed(2)}ms`);
    return { result, duration };
};