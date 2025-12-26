import { useState, useEffect } from 'react';
import type { Schema } from '../../amplify/data/resource';

interface Props {
    objective: Schema['StrategicObjective']['type'];
}

export function StrategicObjectiveCard({ objective }: Props) {
    const [outcomeCount, setOutcomeCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchDetails = async () => {
            try {
                // Fetch outcomes to get count
                const { data: outcomes } = await objective.outcomes();
                if (mounted) {
                    setOutcomeCount(outcomes.length);
                }
            } catch (e) {
                console.error("Error fetching objective details", e);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchDetails();
        return () => { mounted = false; };
    }, [objective]);

    return (
        <div className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'left',
            height: '100%',
            justifyContent: 'space-between'
        }}>
            <div>
                <h3 style={{ marginTop: 0, fontSize: '1.25rem' }}>{objective.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineClamp: 3, overflow: 'hidden' }}>
                    {objective.description || "No description provided."}
                </p>
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {loading ? '...' : `${outcomeCount} Outcomes`}
                </div>
                <button style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>View Details</button>
            </div>
        </div>
    );
}
