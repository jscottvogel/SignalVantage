import { createTheme, alpha } from '@mui/material/styles';

/**
 * Executive Palette & Theme
 * Focus: High data density, clean lines, maximum readability.
 * Palette: Slate/Navy (Trust), White/Gray (Cleanliness), Subtle Borders.
 */

// Brand Colors
const brand = {
    navy: '#0f172a',
    slate: '#64748b',
    blue: '#2563eb',
    background: '#f8fafc',
    paper: '#ffffff',
    border: '#e2e8f0',
};

export const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: brand.navy,
            light: '#334155',
            dark: '#020617',
            contrastText: '#ffffff',
        },
        secondary: {
            main: brand.blue,
            light: '#60a5fa',
            dark: '#1d4ed8',
            contrastText: '#ffffff',
        },
        background: {
            default: brand.background,
            paper: brand.paper,
        },
        text: {
            primary: '#1e293b', // Slate 800
            secondary: '#64748b', // Slate 500
        },
        divider: brand.border,
        action: {
            hover: alpha(brand.navy, 0.04),
            selected: alpha(brand.navy, 0.08),
        },
        success: { main: '#10b981', contrastText: '#fff' },
        warning: { main: '#f59e0b', contrastText: '#fff' },
        error: { main: '#ef4444', contrastText: '#fff' },
        info: { main: '#3b82f6', contrastText: '#fff' },
    },
    typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', color: brand.navy },
        h2: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.015em', color: brand.navy },
        h3: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em', color: brand.navy },
        h4: { fontSize: '1.125rem', fontWeight: 600, color: brand.navy },
        h5: { fontSize: '1rem', fontWeight: 600, color: brand.navy },
        h6: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: brand.slate },
        subtitle1: { fontSize: '1rem', fontWeight: 500, color: '#334155' },
        subtitle2: { fontSize: '0.875rem', fontWeight: 500, color: '#475569' },
        body1: { fontSize: '0.9375rem', lineHeight: 1.6, color: '#334155' }, // Slightly smaller for density
        body2: { fontSize: '0.8125rem', lineHeight: 1.5, color: '#64748b' },
        button: { fontWeight: 600, textTransform: 'none' },
        caption: { fontSize: '0.75rem', color: '#94a3b8' },
    },
    shape: {
        borderRadius: 6,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: brand.background,
                    scrollbarColor: "#cbd5e1 transparent",
                    "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
                        backgroundColor: "transparent",
                        width: "8px",
                        height: "8px",
                    },
                    "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
                        borderRadius: 8,
                        backgroundColor: "#cbd5e1",
                        minHeight: 24,
                        border: "2px solid transparent",
                        backgroundClip: "content-box",
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    boxShadow: 'none',
                    padding: '6px 16px',
                    '&:hover': {
                        boxShadow: 'none',
                        backgroundColor: alpha(brand.navy, 0.9), // Darken slightly
                    },
                },
                containedPrimary: {
                    '&:hover': {
                        backgroundColor: '#334155',
                    }
                },
                outlined: {
                    borderColor: brand.border,
                    color: brand.navy,
                    '&:hover': {
                        borderColor: brand.slate,
                        backgroundColor: alpha(brand.navy, 0.04),
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                    border: `1px solid ${brand.border}`,
                    borderRadius: 8,
                },
            },
        },
        MuiPaper: {
            defaultProps: {
                elevation: 0,
            },
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
                outlined: {
                    border: `1px solid ${brand.border}`,
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 12,
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', // Deep shadow for modals
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    padding: '16px 24px',
                    borderBottom: `1px solid ${brand.border}`,
                    backgroundColor: '#ffffff',
                },
            },
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    padding: '16px 24px',
                    borderTop: `1px solid ${brand.border}`,
                    backgroundColor: '#f8fafc',
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    borderRight: 'none',
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    margin: '4px 8px',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        },
                    },
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                },
            },
        },
        MuiListItemIcon: {
            styleOverrides: {
                root: {
                    color: '#94a3b8',
                    minWidth: 40,
                },
            },
        },
        MuiListItemText: {
            styleOverrides: {
                primary: {
                    fontSize: '0.875rem',
                    fontWeight: 500,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                    borderRadius: 4,
                    height: 24,
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 6,
                        '& fieldset': {
                            borderColor: brand.border,
                        },
                        '&:hover fieldset': {
                            borderColor: brand.slate,
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: brand.blue,
                            borderWidth: 1,
                        },
                    },
                },
            },
        },
    },
});
