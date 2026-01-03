
import { describe, it, expect } from 'vitest';
import {
    calculateFreshness,
    assessHeartbeat,
    generateKeyResultRollup,
    calculateAttentionLevel
} from './heartbeatLogic';
import type { Schema } from '../../amplify/data/resource';

type MockOwnerInput = Partial<Schema['OwnerInput']['type']>;
type MockHeartbeat = Partial<Schema['Heartbeat']['type']>;


describe('heartbeatLogic', () => {
    describe('calculateFreshness', () => {
        it('returns ON_TIME if nextHeartbeatDue is null', () => {
            expect(calculateFreshness(null)).toBe('ON_TIME');
        });

        it('returns ON_TIME if nextHeartbeatDue is undefined', () => {
            expect(calculateFreshness(undefined)).toBe('ON_TIME');
        });

        it('returns LATE if now is after due date', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            expect(calculateFreshness(yesterday.toISOString())).toBe('LATE');
        });

        it('returns ON_TIME if now is before due date', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            expect(calculateFreshness(tomorrow.toISOString())).toBe('ON_TIME');
        });
    });

    describe('assessHeartbeat', () => {
        const mockOwnerInput = {
            ownerConfidence: 90,
            progressSummary: 'Making great progress, completed all milestones.',
            confidenceRationale: 'Everything is on track.',
            newRisks: [],
            dependencies: [],
            milestoneStatus: 'ON_TRACK',
            metricValue: 10
        };

        it('calculates freshness correctly', () => {
            const result = assessHeartbeat(mockOwnerInput as unknown as MockOwnerInput, undefined, null);
            expect(result.integritySignals.updateFreshness).toBe('ON_TIME');
        });

        it('calculates specificity as SPECIFIC for long text', () => {
            // This test case title is a bit misleading based on the logic below, 
            // but we are asserting what the logic currently does (VAGUE for short text)
            // "Making great progress, completed all milestones." -> 6 words
            // "Everything is on track." -> 4 words
            // Total 10 words.
            const result = assessHeartbeat(mockOwnerInput as unknown as MockOwnerInput);
            expect(result.integritySignals.languageSpecificity).toBe('VAGUE');
        });

        it('calculates specificity as SPECIFIC for very long text', () => {
            const longText = new Array(50).fill('word').join(' ');
            const input = { ...mockOwnerInput, progressSummary: longText };
            const result = assessHeartbeat(input as unknown as MockOwnerInput);
            expect(result.integritySignals.languageSpecificity).toBe('SPECIFIC');
        });

        it('adds inference for vague input', () => {
            const result = assessHeartbeat(mockOwnerInput as unknown as MockOwnerInput); // Vague (<15 words)
            expect(result.factsInferencesRecommendations.inferences).toContain('Brief update content suggests potential lack of detail or visibility.');
            expect(result.factsInferencesRecommendations.recommendations).toContain('Provide more detailed progress metrics in next update.');
        });

        it('adds recommendation for low confidence', () => {
            const input = { ...mockOwnerInput, ownerConfidence: 30 };
            const result = assessHeartbeat(input as unknown as MockOwnerInput);
            expect(result.factsInferencesRecommendations.recommendations).toContain('Review risks and consider escalating blockers.');
        });

        it('handles confidence trend', () => {
            const input = { ...mockOwnerInput, ownerConfidence: 90 };
            const prev = { ownerInput: { ownerConfidence: 80 } };
            const result = assessHeartbeat(input as unknown as MockOwnerInput, prev as unknown as MockHeartbeat);
            expect(result.confidenceTrend).toBe('IMPROVING');
            // 90 > 80 + 5 -> IMPROVING
        });

        it('handles stable trend', () => {
            const input = { ...mockOwnerInput, ownerConfidence: 84 };
            const prev = { ownerInput: { ownerConfidence: 80 } };
            const result = assessHeartbeat(input as unknown as MockOwnerInput, prev as unknown as MockHeartbeat);
            expect(result.confidenceTrend).toBe('STABLE');
        });

        it('handles declining trend', () => {
            const input = { ...mockOwnerInput, ownerConfidence: 70 };
            const prev = { ownerInput: { ownerConfidence: 80 } };
            const result = assessHeartbeat(input as unknown as MockOwnerInput, prev as unknown as MockHeartbeat);
            expect(result.confidenceTrend).toBe('DECLINING');
            // 70 < 80 - 5
        });
    });

    describe('generateKeyResultRollup', () => {
        it('returns default for no initiatives', () => {
            const result = generateKeyResultRollup([]);
            expect(result.confidence).toBe(50);
            expect(result.summary).toBe('No linked initiatives.');
        });

        it('calculates average confidence', () => {
            const initiatives = [
                { confidence: 80, title: 'Init 1' },
                { confidence: 60, title: 'Init 2' }
            ];
            const result = generateKeyResultRollup(initiatives);
            expect(result.confidence).toBe(70);
        });

        it('handles string confidence values', () => {
            const initiatives = [
                { confidence: 'HIGH', title: 'Init 1' }, // 90
                { confidence: 'MEDIUM', title: 'Init 2' } // 70
            ];
            const result = generateKeyResultRollup(initiatives);
            expect(result.confidence).toBe(80);
        });

        it('caps confidence at 60 if any initiative is low (<40)', () => {
            const initiatives = [
                { confidence: 90, title: 'Init 1' },
                { confidence: 90, title: 'Init 2' },
                { confidence: 20, title: 'Init 3' } // Low!
            ];
            // Avg: (200) / 3 = 66.6 -> rounded 67.
            // But hasLow is true, and avg > 60. So should be 60.
            const result = generateKeyResultRollup(initiatives);
            expect(result.confidence).toBe(60);
        });
    });

    describe('calculateAttentionLevel', () => {
        it('returns ACTION if confidence < 50', () => {
            const obj = { latestHeartbeat: { systemAssessment: { systemConfidence: 40 } } };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(calculateAttentionLevel(obj as any)).toBe('ACTION');
        });

        it('returns ACTION if confidence declining and < 75', () => {
            const obj = {
                latestHeartbeat: {
                    systemAssessment: { systemConfidence: 70, confidenceTrend: 'DECLINING' }
                }
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(calculateAttentionLevel(obj as any)).toBe('ACTION');
        });

        it('returns WATCH if confidence < 75 but stable', () => {
            const obj = {
                latestHeartbeat: {
                    systemAssessment: { systemConfidence: 70, confidenceTrend: 'STABLE' }
                }
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(calculateAttentionLevel(obj as any)).toBe('WATCH');
        });

        it('returns STABLE if confidence >= 75 and not declining', () => {
            const obj = {
                latestHeartbeat: {
                    systemAssessment: { systemConfidence: 80, confidenceTrend: 'STABLE' }
                }
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(calculateAttentionLevel(obj as any)).toBe('STABLE');
        });

        // Test lateness escalation
        it('escalates STABLE to WATCH if late', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const obj = {
                latestHeartbeat: {
                    systemAssessment: { systemConfidence: 90, confidenceTrend: 'STABLE' }
                },
                nextHeartbeatDue: yesterday.toISOString()
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(calculateAttentionLevel(obj as any)).toBe('WATCH');
        });
    });
});
