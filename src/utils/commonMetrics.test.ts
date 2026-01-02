
import { describe, it, expect } from 'vitest';
import { COMMON_METRICS } from './commonMetrics';

describe('COMMON_METRICS', () => {
    it('is an array of metric definitions', () => {
        expect(Array.isArray(COMMON_METRICS)).toBe(true);
        expect(COMMON_METRICS.length).toBeGreaterThan(0);
    });

    it('contains valid metric definitions', () => {
        COMMON_METRICS.forEach(metric => {
            expect(metric).toHaveProperty('category');
            expect(metric).toHaveProperty('name');
            expect(metric).toHaveProperty('unit');
            expect(metric).toHaveProperty('description');
        });
    });

    it('contains specific core metrics', () => {
        const nps = COMMON_METRICS.find(m => m.name === 'Net Promoter Score (NPS)');
        expect(nps).toBeDefined();
        expect(nps?.category).toBe('Customer & Growth');
    });
});
