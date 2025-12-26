import { createTheme } from '@mui/material/styles';

/**
 * Executive Palette
 * Neutral, professional, high-contrast text, subtle accents.
 */
export const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#0f172a', // Navy/Slate for primary actions (Executive feel)
            light: '#334155',
            dark: '#020617',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#2563eb', // Professional Blue for accents/links
            light: '#60a5fa',
            dark: '#1d4ed8',
            contrastText: '#ffffff',
        },
        background: {
            default: '#f8fafc', // Very light slate gray
            paper: '#ffffff',
        },
        text: {
            primary: '#1e293b', // Slate 800 - softer than pure black
            secondary: '#64748b', // Slate 500
        },
        error: {
            main: '#ef4444',
        },
        warning: {
            main: '#f59e0b',
        },
        success: {
            main: '#10b981',
        },
        info: {
            main: '#3b82f6',
        },
        divider: '#e2e8f0',
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontWeight: 700,
            fontSize: '2rem',
            letterSpacing: '-0.02em',
            color: '#0f172a',
        },
        h2: {
            fontWeight: 600,
            fontSize: '1.5rem',
            letterSpacing: '-0.01em',
            color: '#0f172a',
        },
        h3: {
            fontWeight: 600,
            fontSize: '1.25rem',
            color: '#1e293b',
        },
        h4: {
            fontWeight: 600,
            fontSize: '1.125rem',
            color: '#1e293b',
        },
        body1: {
            fontSize: '1rem',
            lineHeight: 1.6,
            color: '#334155',
        },
        body2: {
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: '#475569',
        },
        button: {
            fontWeight: 600,
            textTransform: 'none', // No all-caps
        },
    },
    shape: {
        borderRadius: 8, // Softens the look
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: 'none',
                    },
                },
                containedPrimary: {
                    '&:hover': {
                        backgroundColor: '#334155',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', // Tailwind shadow-sm equivalent
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease-in-out',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                elevation1: {
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                },
                colorSuccess: {
                    backgroundColor: '#dcfce7',
                    color: '#166534',
                },
                colorWarning: {
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                },
                colorError: {
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                },
                colorInfo: {
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                }
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#0f172a', // Dark sidebar
                    color: '#f1f5f9',
                    borderRight: 'none',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    borderBottom: '1px solid #e2e8f0',
                    boxShadow: 'none',
                },
            },
        },
    },
});
