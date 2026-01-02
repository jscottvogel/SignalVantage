import { describe, it, expect, vi } from 'vitest';

// Mock the Amplify resource file to prevent loading backend packages
vi.mock('../../amplify/data/resource', () => ({
    Schema: {}
}));

import { fetchObjectiveHierarchy } from './objectiveDataUtils';

describe('objectiveDataUtils', () => {
    describe('fetchObjectiveHierarchy', () => {
        it('should aggregate dependencies from all levels and sort them', async () => {
            // Mock Data
            const mockObjective = {
                id: 'obj-1',
                dependencies: vi.fn().mockResolvedValue({ data: [{ id: 'dep-1', description: 'Obj Dep', dueDate: '2025-01-10' }] }),
                risks: vi.fn().mockResolvedValue({ data: [] }),
                outcomes: vi.fn().mockResolvedValue({
                    data: [
                        {
                            id: 'out-1',
                            keyResults: vi.fn().mockResolvedValue({
                                data: [{
                                    id: 'kr-1',
                                    dependencies: vi.fn().mockResolvedValue({ data: [{ id: 'dep-3', description: 'KR Dep', dueDate: '2025-01-01' }] })
                                }]
                            }),
                            dependencies: vi.fn().mockResolvedValue({ data: [{ id: 'dep-2', description: 'Outcome Dep', dueDate: '2025-01-20' }] })
                        }
                    ]
                }),
                organization: vi.fn().mockResolvedValue({ data: { id: 'org-1' } })
            };

            const mockClient = {
                models: {
                    StrategicObjective: {
                        get: vi.fn().mockResolvedValue({ data: mockObjective })
                    },
                    Initiative: {
                        list: vi.fn().mockResolvedValue({
                            data: [
                                {
                                    id: 'init-1',
                                    linkedEntities: { keyResultIds: ['kr-1'] },
                                    dependencies: vi.fn().mockResolvedValue({ data: [{ id: 'dep-4', description: 'Init Dep', dueDate: '2025-01-05' }] })
                                }
                            ]
                        })
                    }
                }
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await fetchObjectiveHierarchy(mockClient, mockObjective as any);

            expect(result.dependencies).toHaveLength(4);
            // Check sorting by date (dep-3 is earliest)
            expect(result.dependencies[0].id).toBe('dep-3'); // 2025-01-01
            expect(result.dependencies[1].id).toBe('dep-4'); // 2025-01-05
            expect(result.dependencies[2].id).toBe('dep-1'); // 2025-01-10
            expect(result.dependencies[3].id).toBe('dep-2'); // 2025-01-20
        });

        it('should handle missing organization gracefully', async () => {
            const mockObjective = {
                id: 'obj-1',
                dependencies: vi.fn().mockResolvedValue({ data: [] }),
                risks: vi.fn().mockResolvedValue({ data: [] }),
                outcomes: vi.fn().mockResolvedValue({ data: [] }),
                organization: vi.fn().mockResolvedValue({ data: null })
            };

            const mockClient = {
                models: {
                    StrategicObjective: {
                        get: vi.fn().mockResolvedValue({ data: mockObjective })
                    }
                }
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await fetchObjectiveHierarchy(mockClient, mockObjective as any);
            expect(result.allInitiatives).toHaveLength(0);
        });
    });
});
