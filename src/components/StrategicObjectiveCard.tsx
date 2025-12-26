import { useState, useEffect } from 'react';
import type { Schema } from '../../amplify/data/resource';

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClick: () => void;
}

export function StrategicObjectiveCard({ objective, onClick }: Props) {
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
        <div
            className="card card-interactive"
            onClick={onClick}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
        >
            <div>
                <h3 style={{ textDecoration: 'none' }}>{objective.title}</h3>
                <p className="mt-4" style={{ lineClamp: 3, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}>
                    {objective.description || "No description provided."}
                </p>
            </div>

            <div className="flex-between mt-4" style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div className="text-small text-muted" style={{ fontWeight: 500 }}>
                    {loading ? '...' : `${outcomeCount} Outcomes`}
                </div>
                <div style={{ color: 'var(--color-primary)', fontSize: '1.2rem' }}>&rsaquo;</div>
            </div>
        </div>
    );
}
