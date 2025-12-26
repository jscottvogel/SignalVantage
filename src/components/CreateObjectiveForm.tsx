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
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, overflowY: 'auto'
        }}>
            <div className="card" style={{ width: '800px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface)' }}>
                <h2>Create Strategic Objective</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>

                    <div>
                        <label>Title</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            style={{ width: '100%', padding: '0.5rem', background: '#333', color: 'white', border: '1px solid #555' }}
                        />
                    </div>

                    <div>
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', background: '#333', color: 'white', border: '1px solid #555' }}
                        />
                    </div>

                    <hr style={{ borderColor: 'var(--border-color)', width: '100%' }} />

                    <h3>Outcomes</h3>
                    {outcomes.map((outcome, oIdx) => (
                        <div key={oIdx} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1rem' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <input
                                    placeholder="Outcome Title"
                                    value={outcome.title}
                                    onChange={e => updateOutcome(oIdx, 'title', e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', background: '#222', color: 'white', border: 'none' }}
                                />
                            </div>

                            <div style={{ marginLeft: '20px', borderLeft: '2px solid var(--primary-color)', paddingLeft: '10px' }}>
                                <h4>Key Results</h4>
                                {outcome.keyResults.map((kr, kIdx) => (
                                    <div key={kIdx} style={{ marginBottom: '1rem' }}>
                                        <input
                                            placeholder="KR Statement"
                                            value={kr.statement}
                                            onChange={e => updateKeyResult(oIdx, kIdx, e.target.value)}
                                            style={{ width: '100%', padding: '0.5rem', background: '#222', color: 'white', border: 'none' }}
                                        />

                                        <div style={{ marginLeft: '20px', marginTop: '5px' }}>
                                            <h5 style={{ margin: '5px 0' }}>Initiatives</h5>
                                            {kr.initiatives.map((init, iIdx) => (
                                                <div key={iIdx} style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
                                                    <input
                                                        placeholder="Initiative Title"
                                                        value={init.title}
                                                        onChange={e => updateInitiative(oIdx, kIdx, iIdx, 'title', e.target.value)}
                                                        style={{ flex: 1, padding: '0.3rem', background: '#222', color: 'white', border: 'none' }}
                                                    />
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addInitiative(oIdx, kIdx)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>+ Add Initiative</button>
                                        </div>
                                    </div>
                                ))}
                                <button type="button" onClick={() => addKeyResult(oIdx)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>+ Add Key Result</button>
                            </div>
                        </div>
                    ))}

                    <button type="button" onClick={addOutcome} style={{ alignSelf: 'flex-start' }}>+ Add Outcome</button>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid #666' }}>Cancel</button>
                        <button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create All'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
