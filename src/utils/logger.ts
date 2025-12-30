/**
 * Simple logger utility to control console output based on environment.
 * Logs are enabled if:
 * 1. We are in development mode (import.meta.env.DEV)
 * 2. Or if VITE_ENABLE_DEBUG_LOGS is set to 'true' in production.
 */

const isDebugEnabled = () => {
    return import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';
};

export const logger = {
    log: (...args: any[]) => {
        if (isDebugEnabled()) {
            console.log(...args);
        }
    },
    warn: (...args: any[]) => {
        if (isDebugEnabled()) {
            console.warn(...args);
        }
    },
    error: (...args: any[]) => {
        // Errors should arguably always be logged, or at least in most cases.
        // But we can stick to the pattern if strict silence is desired.
        // Usually, errors are important enough to see even in prod console unless captured by a service.
        // For now, let's allow them always, but maybe silence them if strictly requested.
        // However, standard practice is console.error is fine.
        // Let's wrap it anyway for consistency, but maybe default to showing errors unless explicitly silenced?
        console.error(...args);
    },
    debug: (...args: any[]) => {
        if (isDebugEnabled()) {
            console.debug(...args);
        }
    }
};
