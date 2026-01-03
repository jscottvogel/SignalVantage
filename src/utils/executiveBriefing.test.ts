
import { describe, it, expect, vi } from 'vitest';
import { generateExecutiveBriefing } from './executiveBriefing';
import type { Schema } from '../../amplify/data/resource';
import * as heartbeatLogic from './heartbeatLogic';

// Mock calculateAttentionLevel to isolate logic
vi.mock('./heartbeatLogic', async (importOriginal) => {
    const mod = await importOriginal<typeof heartbeatLogic>();
    return {
        ...mod,
        calculateAttentionLevel: vi.fn(),
    };
});

describe('generateExecutiveBriefing', () => {
    it('returns "All clear" when no objectives provided', () => {
        const result = generateExecutiveBriefing([]);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Executive Summary');
        expect(result[0].items[0].headline).toBe('All clear.');
    });

    it('returns "All clear" when objectives have no notable status', () => {
        vi.mocked(heartbeatLogic.calculateAttentionLevel).mockReturnValue('STABLE');
        const objectives = [{ id: '1', title: 'Obj 1' }] as unknown as Schema['StrategicObjective']['type'][];
        const result = generateExecutiveBriefing(objectives);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Executive Summary');
    });

    it('groups ACTION items under Critical Attention', () => {
        vi.mocked(heartbeatLogic.calculateAttentionLevel).mockReturnValue('ACTION');
        const objectives = [{
            id: '1',
            title: 'Critical Obj',
            latestHeartbeat: {
                ownerInput: { ownerConfidence: 30, newRisks: [{ description: 'Big Risk' }] },
                systemAssessment: { confidenceTrend: 'DECLINING' }
            }
        }] as unknown as Schema['StrategicObjective']['type'][];

        const result = generateExecutiveBriefing(objectives);
        const section = result.find(s => s.title.includes('Critical Attention'));
        expect(section).toBeDefined();
        expect(section?.items[0].headline).toBe('Critical Obj');
        expect(section?.items[0].body).toContain('Big Risk');
    });

    it('groups WATCH items under Watch List', () => {
        vi.mocked(heartbeatLogic.calculateAttentionLevel).mockReturnValue('WATCH');
        const objectives = [{
            id: '2',
            title: 'Watch Obj',
            latestHeartbeat: {
                ownerInput: { ownerConfidence: 60 },
            }
        }] as unknown as Schema['StrategicObjective']['type'][];

        const result = generateExecutiveBriefing(objectives);
        const section = result.find(s => s.title.includes('Watch List'));
        expect(section).toBeDefined();
        expect(section?.items[0].headline).toBe('Watch Obj');
    });

    it('identifies Uncertainty Spotlight items', () => {
        // Logic handles both attention level AND uncertainty
        vi.mocked(heartbeatLogic.calculateAttentionLevel).mockReturnValue('STABLE');
        const objectives = [{
            id: '3',
            title: 'Uncertain Obj',
            latestHeartbeat: {
                systemAssessment: { uncertaintyFlags: ['Vague Input'] }
            }
        }] as unknown as Schema['StrategicObjective']['type'][];

        const result = generateExecutiveBriefing(objectives);
        const section = result.find(s => s.title.includes('Uncertainty Spotlight'));
        expect(section).toBeDefined();
        expect(section?.items[0].body).toContain('Vague Input');
    });

    it('identifies Notable Progress for STABLE items with summary', () => {
        vi.mocked(heartbeatLogic.calculateAttentionLevel).mockReturnValue('STABLE');
        const objectives = [{
            id: '4',
            title: 'Progress Obj',
            latestHeartbeat: {
                summary: 'Achieved XYZ',
                systemAssessment: { uncertaintyFlags: [] }
            }
        }] as unknown as Schema['StrategicObjective']['type'][];

        const result = generateExecutiveBriefing(objectives);
        const section = result.find(s => s.title.includes('Notable Progress'));
        expect(section).toBeDefined();
        expect(section?.items[0].body).toBe('Achieved XYZ');
    });
});
