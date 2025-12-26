import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface Props {
    organizationId: string;
    onClose: () => void;
    onSuccess: (newObjective: Schema['StrategicObjective']['type']) => void;
}

interface NewInitiative {
    title: string;
    description: string;
}

interface NewKeyResult {
    statement: string;
    initiatives: NewInitiative[];
}

interface NewOutcome {
    title: string;
    description: string;
    keyResults: NewKeyResult[];
}

export function CreateObjectiveForm({ organizationId, onClose, onSuccess }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [outcomes, setOutcomes] = useState<NewOutcome[]>([]);
    const [loading, setLoading] = useState(false);

    const addOutcome = () => {
        setOutcomes([...outcomes, { title: '', description: '', keyResults: [] }]);
    };

    const updateOutcome = (index: number, field: keyof NewOutcome, value: string) => {
        const newOutcomes = [...outcomes];
        (newOutcomes[index] as any)[field] = value;
        setOutcomes(newOutcomes);
    };

    const addKeyResult = (outcomeIndex: number) => {
        const newOutcomes = [...outcomes];
        newOutcomes[outcomeIndex].keyResults.push({ statement: '', initiatives: [] });
        setOutcomes(newOutcomes);
    };

    const updateKeyResult = (outcomeIndex: number, krIndex: number, value: string) => {
        const newOutcomes = [...outcomes];
        newOutcomes[outcomeIndex].keyResults[krIndex].statement = value;
        setOutcomes(newOutcomes);
    };

    const addInitiative = (outcomeIndex: number, krIndex: number) => {
        const newOutcomes = [...outcomes];
        newOutcomes[outcomeIndex].keyResults[krIndex].initiatives.push({ title: '', description: '' });
        setOutcomes(newOutcomes);
    };

    const updateInitiative = (outcomeIndex: number, krIndex: number, initIndex: number, field: keyof NewInitiative, value: string) => {
        const newOutcomes = [...outcomes];
        (newOutcomes[outcomeIndex].keyResults[krIndex].initiatives[initIndex] as any)[field] = value;
        setOutcomes(newOutcomes);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Create Objective
            const { data: obj, errors: objErrors } = await client.models.StrategicObjective.create({
                organizationId,
                title,
                description,
                status: 'active'
            });
            if (objErrors) throw new Error(objErrors[0].message);
            if (!obj) throw new Error('Failed to create objective');

            // 2. Create nested entities
            for (const outcomeData of outcomes) {
                const { data: outcome, errors: outErrors } = await client.models.Outcome.create({
                    organizationId,
                    strategicObjectiveId: obj.id,
                    title: outcomeData.title,
                    description: outcomeData.description,
                    status: 'active'
                });
                if (outErrors) console.error("Outcome creation error", outErrors);

                if (outcome) {
                    for (const krData of outcomeData.keyResults) {
                        const { data: kr, errors: krErrors } = await client.models.KeyResult.create({
                            organizationId,
                            strategicObjectiveId: obj.id,
                            outcomeId: outcome.id,
                            statement: krData.statement,
                            status: 'active'
                        });
                        if (krErrors) console.error("KR creation error", krErrors);

                        if (kr) {
                            for (const initData of krData.initiatives) {
                                const { errors: initErrors } = await client.models.Initiative.create({
                                    organizationId,
                                    title: initData.title,
                                    description: initData.description,
                                    linkedEntities: {
                                        strategicObjectiveIds: [obj.id],
                                        outcomeIds: [outcome.id],
                                        keyResultIds: [kr.id]
                                    }
                                });
                                if (initErrors) console.error("Initiative creation error", initErrors);
                            }
                        }
                    }
                }
            }

            onSuccess(obj);
            onClose();
        } catch (e) {
            console.error(e);
            alert('Error creating objective structure');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="flex-between mb-4">
                    <h2>Create Strategic Objective</h2>
                    <button type="button" className="btn-text text-muted" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label className="text-small text-muted" style={{ display: 'block', marginBottom: '0.4rem' }}>Title</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            placeholder="e.g. Expand Market Share"
                        />
                    </div>

                    <div>
                        <label className="text-small text-muted" style={{ display: 'block', marginBottom: '0.4rem' }}>Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Briefly describe the objective..."
                        />
                    </div>

                    <hr style={{ borderColor: 'var(--border-subtle)', width: '100%' }} />

                    <div>
                        <div className="flex-between mb-4">
                            <h3>Outcomes</h3>
                            <button type="button" className="btn-secondary text-small" onClick={addOutcome}>+ Add Outcome</button>
                        </div>

                        {outcomes.map((outcome, oIdx) => (
                            <div key={oIdx} className="card mb-4" style={{ padding: '1rem', border: '1px solid var(--border-subtle)' }}>
                                <div className="mb-4">
                                    <input
                                        placeholder="Outcome Title (e.g. Increase Customer Retention)"
                                        value={outcome.title}
                                        onChange={e => updateOutcome(oIdx, 'title', e.target.value)}
                                        style={{ fontWeight: 600 }}
                                    />
                                </div>

                                <div style={{ paddingLeft: '1rem', borderLeft: '2px solid var(--border-subtle)' }}>
                                    <div className="flex-between mb-4">
                                        <h4 className="text-muted text-small">Key Results</h4>
                                        <button type="button" className="btn-text text-small" onClick={() => addKeyResult(oIdx)}>+ Add KR</button>
                                    </div>

                                    {outcome.keyResults.map((kr, kIdx) => (
                                        <div key={kIdx} className="mb-4">
                                            <input
                                                placeholder="KR Statement (e.g. Achieve 95% Renewal Rate)"
                                                value={kr.statement}
                                                onChange={e => updateKeyResult(oIdx, kIdx, e.target.value)}
                                                className="mb-4"
                                            />

                                            <div style={{ paddingLeft: '1rem' }}>
                                                <div className="flex-between mb-4">
                                                    <h5 className="text-muted text-small">Initiatives</h5>
                                                    <button type="button" className="btn-text text-small" onClick={() => addInitiative(oIdx, kIdx)}>+ Add Initiative</button>
                                                </div>

                                                {kr.initiatives.map((init, iIdx) => (
                                                    <div key={iIdx} className="mb-4">
                                                        <input
                                                            placeholder="Initiative Title"
                                                            value={init.title}
                                                            onChange={e => updateInitiative(oIdx, kIdx, iIdx, 'title', e.target.value)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex-between mt-4" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Strategic Objective & Tree'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
