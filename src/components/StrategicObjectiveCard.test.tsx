
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StrategicObjectiveCard } from './StrategicObjectiveCard';
import type { Schema } from '../../amplify/data/resource';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock theme to avoid import issues or just use a standard one
const theme = createTheme({});

// Mock heartbeatLogic
vi.mock('../utils/heartbeatLogic', () => ({
    calculateAttentionLevel: vi.fn((obj) => {
        if (obj.id === 'action') return 'ACTION';
        if (obj.id === 'watch') return 'WATCH';
        return 'STABLE';
    })
}));

describe('StrategicObjectiveCard', () => {
    const mockObjective = {
        id: '1',
        title: 'Test Objective',
        latestHeartbeat: {
            summary: 'Everything is fine.',
            ownerInput: { ownerConfidence: 80 },
            systemAssessment: { systemConfidence: 85, confidenceTrend: 'IMPROVING' }
        },
        organizationId: 'org-1'
    } as Schema['StrategicObjective']['type'];

    const renderCard = (objective: Schema['StrategicObjective']['type'], onClick = vi.fn()) => {
        return render(
            <ThemeProvider theme={theme}>
                <StrategicObjectiveCard objective={objective} onClick={onClick} />
            </ThemeProvider>
        );
    };

    it('renders the objective title', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderCard(mockObjective as any);
        expect(screen.getByText('Test Objective')).toBeInTheDocument();
    });

    it('displays the confidence percentage', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderCard(mockObjective as any);
        expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('displays the summary', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderCard(mockObjective as any);
        expect(screen.getByText('Everything is fine.')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const handleClick = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderCard(mockObjective as any, handleClick);
        fireEvent.click(screen.getByText('Test Objective').closest('.MuiCard-root') as Element);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('shows risk warning for ACTION level', () => {
        const actionObj = {
            ...mockObjective,
            id: 'action',
            latestHeartbeat: {
                ...mockObjective.latestHeartbeat!,
                ownerInput: {
                    ...mockObjective.latestHeartbeat!.ownerInput,
                    newRisks: [{ description: 'Bad thing' }]
                }
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderCard(actionObj as any);
        expect(screen.getByText(/Risk Drivers Identified/)).toBeInTheDocument();
    });

    it('handles legacy string confidence values', () => {
        const stringConfObj = {
            ...mockObjective,
            latestHeartbeat: {
                ...mockObjective.latestHeartbeat!,
                systemAssessment: { systemConfidence: null },
                ownerInput: { ownerConfidence: 'HIGH' }
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderCard(stringConfObj as any);
        expect(screen.getByText('90%')).toBeInTheDocument();
    });
});
