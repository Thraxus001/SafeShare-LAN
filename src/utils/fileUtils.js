// src/utils/fileUtils.js

/**
 * File operation utilities
 */

/**
 * Read file as ArrayBuffer
 */
export const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            resolve(event.target.result);
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsArrayBuffer(file);
    });
};

/**
 * Read file as text
 */
export const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            resolve(event.target.result);
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsText(file);
    });
};

/**
 * Read file as data URL
 */
export const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            resolve(event.target.result);
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsDataURL(file);
    });
};

/**
 * Split file into chunks
 */
export const splitFileIntoChunks = (file, chunkSize = 1024 * 1024) => { // 1MB chunks
    const chunks = [];
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        chunks.push({
            index: i,
            start,
            end,
            size: end - start,
            totalChunks
        });
    }

    return chunks;
};

/**
 * Get file chunk
 */
export const getFileChunk = async (file, chunkIndex, chunkSize = 1024 * 1024) => {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            resolve({
                data: event.target.result,
                index: chunkIndex,
                start,
                end,
                size: end - start,
                isLast: end >= file.size
            });
        };

        reader.onerror = (error) => {
            reject(error);
        };

        const slice = file.slice(start, end);
        reader.readAsArrayBuffer(slice);
    });
};

/**
 * Validate file
 */
export const validateFile = (file, options = {}) => {
    const {
        maxSize = Infinity,
        allowedTypes = [],
        allowedExtensions = []
    } = options;

    // Check size
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File size exceeds maximum limit of ${formatFileSize(maxSize)}`
        };
    }

    // Check type
    if (allowedTypes.length > 0 && file.type) {
        const isTypeAllowed = allowedTypes.some(type => {
            if (type.endsWith('/*')) {
                const category = type.split('/')[0];
                return file.type.startsWith(category + '/');
            }
            return file.type === type;
        });

        if (!isTypeAllowed) {
            return {
                valid: false,
                error: `File type ${file.type} is not allowed`
            };
        }
    }

    // Check extension
    if (allowedExtensions.length > 0) {
        const extension = getFileExtension(file.name);
        if (!allowedExtensions.includes(extension.toLowerCase())) {
            return {
                valid: false,
                error: `File extension .${extension} is not allowed`
            };
        }
    }

    return { valid: true };
};

/**
 * Format file size (re-export from helpers)
 */
const formatFileSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Get file extension (re-export from helpers)
 */
const getFileExtension = (fileName) => {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

/**
 * Generate file checksum
 */
export const generateFileChecksum = async (file) => {
    // For simulation, generate a simple checksum
    // In a real app, use crypto.subtle.digest('SHA-256', buffer)

    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const buffer = event.target.result;
            let hash = 0;

            // Simple hash for simulation
            for (let i = 0; i < Math.min(buffer.byteLength, 10000); i++) {
                hash = ((hash << 5) - hash) + (new Uint8Array(buffer)[i]);
                hash = hash & hash;
            }

            resolve(Math.abs(hash).toString(16));
        };

        reader.readAsArrayBuffer(file.slice(0, Math.min(file.size, 10000)));
    });
};

/**
 * Create file info object
 */
export const createFileInfo = (file) => {
    return {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        extension: getFileExtension(file.name),
        icon: getFileIcon(file.name, file.type)
    };
};

/**
 * Get file icon (re-export from helpers)
 */
const getFileIcon = (fileName, fileType = '') => {
    const name = (fileName || '').toLowerCase();
    const type = (fileType || '').toLowerCase();

    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📕';
    if (/\.(doc|docx)$/i.test(name)) return '📄';
    if (/\.(xls|xlsx|csv)$/i.test(name)) return '📊';
    if (/\.(ppt|pptx)$/i.test(name)) return '📽️';
    if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return '📦';
    if (/\.(js|jsx|ts|tsx|py|java|cpp|c|html|css)$/i.test(name)) return '💻';
    return '📁';
};

/**
 * Simulate file transfer
 */
export const simulateFileTransfer = async (file, onProgress) => {
    const fileSize = file.size;
    const chunkSize = 1024 * 1024; // 1MB
    const totalChunks = Math.ceil(fileSize / chunkSize);

    let transferred = 0;

    for (let i = 0; i < totalChunks; i++) {
        // Simulate transfer delay
        await new Promise(resolve => setTimeout(resolve, 50));

        // Update progress
        transferred += Math.min(chunkSize, fileSize - transferred);
        const progress = (transferred / fileSize) * 100;

        if (onProgress) {
            onProgress({
                progress,
                transferred,
                total: fileSize,
                speed: 1024 * 1024, // 1MB/s
                currentChunk: i + 1,
                totalChunks
            });
        }
    }

    return {
        success: true,
        fileSize,
        transferTime: totalChunks * 50,
        checksum: await generateFileChecksum(file)
    };
};

/**
 * Compress file (simulation)
 */
export const compressFile = async (file, compressionLevel = 6) => {
    console.log(`Compressing file: ${file.name} (level: ${compressionLevel})`);

    // Simulate compression
    await new Promise(resolve => setTimeout(resolve, 500));

    const compressedSize = Math.floor(file.size * (0.3 + (Math.random() * 0.3))); // 30-60% of original

    return {
        originalSize: file.size,
        compressedSize,
        ratio: (compressedSize / file.size * 100).toFixed(1) + '%',
        time: 500
    };
};

/**
 * Decompress file (simulation)
 */
export const decompressFile = async (compressedData) => {
    console.log('Decompressing file...');

    // Simulate decompression
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
        success: true,
        decompressedSize: compressedData.originalSize,
        time: 300
    };
};

/**
 * Create file download
 */
export const createFileDownload = (data, filename, type = 'application/octet-stream') => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
};

/**
 * Get file preview (for images and text)
 */
export const getFilePreview = async (file, maxSize = 1024 * 1024) => {
    if (file.size > maxSize) {
        return null; // File too large for preview
    }

    if (file.type.startsWith('image/')) {
        return readFileAsDataURL(file);
    }

    if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('xml')) {
        const text = await readFileAsText(file);
        return text.substring(0, 1000); // First 1000 characters
    }

    return null;
};

/**
 * Sort files by criteria
 */
export const sortFiles = (files, criteria = 'name', order = 'asc') => {
    const sorted = [...files];

    sorted.sort((a, b) => {
        let aValue, bValue;

        switch (criteria) {
            case 'size':
                aValue = a.size || a.file?.size || 0;
                bValue = b.size || b.file?.size || 0;
                break;

            case 'type':
                aValue = a.type || a.file?.type || '';
                bValue = b.type || b.file?.type || '';
                break;

            case 'date':
                aValue = a.lastModified || a.file?.lastModified || 0;
                bValue = b.lastModified || b.file?.lastModified || 0;
                break;

            case 'name':
            default:
                aValue = a.name || a.file?.name || '';
                bValue = b.name || b.file?.name || '';
                break;
        }

        if (order === 'desc') {
            return aValue > bValue ? -1 : 1;
        }

        return aValue > bValue ? 1 : -1;
    });

    return sorted;
};

/**
 * Filter files by criteria
 */
export const filterFiles = (files, filters = {}) => {
    return files.filter(file => {
        // Type filter
        if (filters.type && filters.type !== 'all') {
            const fileType = file.type || file.file?.type || '';
            if (!fileType.startsWith(filters.type + '/')) {
                return false;
            }
        }

        // Size filter
        if (filters.maxSize) {
            const fileSize = file.size || file.file?.size || 0;
            if (fileSize > filters.maxSize) {
                return false;
            }
        }

        // Name filter
        if (filters.name) {
            const fileName = file.name || file.file?.name || '';
            if (!fileName.toLowerCase().includes(filters.name.toLowerCase())) {
                return false;
            }
        }

        return true;
    });
};

/**
 * Calculate total size of files
 */
export const calculateTotalSize = (files) => {
    return files.reduce((total, file) => {
        return total + (file.size || file.file?.size || 0);
    }, 0);
};

/**
 * Group files by type
 */
export const groupFilesByType = (files) => {
    const groups = {};

    files.forEach(file => {
        const type = file.type || file.file?.type || 'unknown';
        const category = type.split('/')[0];

        if (!groups[category]) {
            groups[category] = {
                type: category,
                count: 0,
                totalSize: 0,
                files: []
            };
        }

        groups[category].count++;
        groups[category].totalSize += file.size || file.file?.size || 0;
        groups[category].files.push(file);
    });

    return Object.values(groups);
};