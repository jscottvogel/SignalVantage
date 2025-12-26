import { useState, useEffect } from 'react';
import type { Schema } from '../../amplify/data/resource';

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClose: () => void;
}

export function ObjectiveDetailModal({ objective, onClose }: Props) {
    const [outcomes, setOutcomes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchTree = async () => {
            try {
                // Fetch outcomes, then for each outcome fetch KeyResults, then Initiatives
                const { data: outcomesRes } = await objective.outcomes();

                const outcomesWithChildren = await Promise.all(
                    outcomesRes.map(async (outcome) => {
                        const { data: krs } = await outcome.keyResults();

                        const krsWithInitiatives = await Promise.all(
                            krs.map(async (kr) => {
                                // Currently fetching initiatives from the top level list because we didn't add the nested relation directly to KR?
                                // Wait, in schema: Relationship between KeyResult and Initiative isn't explicit hasMany in my last recall of resource.ts?
                                // Checking resource.ts memory... 
                                // Ah, I made Initiative belong to Organization. Did I link it to KR?
                                // Looking at schema: linkedEntities is a JSON type, but I didn't add explicit HasMany/BelongsTo for Initiative->KR.
                                // However, I did add `initiatives` hasMany to Organization. 
                                // For this display, I might have to query Initiatives by filtering `linkedEntities.keyResultIds` implicitly or explicitly.
                                // Wait, the resource.ts I updated added `initiatives: a.hasMany('Initiative', 'organizationId')` to Org.
                                // It defined `Initiative` with `linkedEntities.ref('LinkedEntities')`.
                                // It did NOT define a graph relationship between KR and Initiative (no `hasMany` on KR).
                                // So I have to fetch all initiatives for the org (or filtered) and map them manually, OR update the schema.
                                // Given the constraints and time, I'll fetch organization.initiatives() and filter in memory for this MVP since data volume is low.

                                return { ...kr, initiatives: [] }; // Placeholder until I fetch them properly
                            })
                        );

                        return { ...outcome, keyResults: krsWithInitiatives };
                    })
                );

                // NOW: Fetch all initiatives for this objective to distribute them.
                // Actually, efficiently:
                const { data: org } = await objective.organization();
                if (!org) {
                    console.error("No organization found for objective");
                    return;
                }
                const { data: allInitiatives } = await org.initiatives();

                // Map initiatives to KRs
                const outcomesFinal = outcomesWithChildren.map(outcome => ({
                    ...outcome,
                    keyResults: outcome.keyResults.map((kr: any) => ({
                        ...kr,
                        initiatives: allInitiatives.filter(init =>
                            init.linkedEntities?.keyResultIds?.includes(kr.id)
                        )
                    }))
                }));

                if (mounted) {
                    setOutcomes(outcomesFinal);
                }
            } catch (e) {
                console.error("Error fetching detail tree", e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchTree();
        return () => { mounted = false; };
    }, [objective]);

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="flex-between mb-4 pb-4 border-b border-gray-200">
                    <div>
                        <span className="text-xs uppercase font-bold text-gray-500">Strategic Objective</span>
                        <h2 className="text-xl font-bold text-navy-900 mt-1">{objective.title}</h2>
                    </div>
                    <button onClick={onClose} className="btn-text text-2xl leading-none">&times;</button>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Description</h3>
                    <p className="text-gray-700">{objective.description || "No description provided."}</p>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading details...</div>
                ) : (
                    <div className="space-y-6">
                        {outcomes.length === 0 ? (
                            <p className="italic text-gray-500">No outcomes defined.</p>
                        ) : outcomes.map(outcome => (
                            <div key={outcome.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">Outcome</span>
                                    <h4 className="font-semibold text-gray-900">{outcome.title}</h4>
                                </div>

                                <div className="pl-4 border-l-2 border-gray-300 space-y-4">
                                    {outcome.keyResults.length === 0 ? (
                                        <p className="text-sm text-gray-500 italic">No Key Results</p>
                                    ) : outcome.keyResults.map((kr: any) => (
                                        <div key={kr.id}>
                                            <div className="flex items-start gap-2 mb-2">
                                                <div className="mt-1 w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">{kr.statement}</p>
                                                    <div className="text-xs text-gray-500 mt-1">Metric: {kr.metric?.name || 'N/A'}</div>
                                                </div>
                                            </div>

                                            {/* Initiatives */}
                                            {kr.initiatives.length > 0 && (
                                                <div className="ml-4 mt-2 space-y-2">
                                                    {kr.initiatives.map((init: any) => (
                                                        <div key={init.id} className="bg-white p-2 rounded border border-gray-200 text-sm shadow-sm">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-purple-600 font-bold text-xs uppercase">Init</span>
                                                                <span className="text-gray-700">{init.title}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
