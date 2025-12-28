
import type { Schema } from '../../amplify/data/resource';
import { calculateAttentionLevel } from './heartbeatLogic';

type Objective = Schema["StrategicObjective"]["type"];

interface BriefingSection {
    title: string;
    items: {
        headline: string;
        body: string;
        severity: 'critical' | 'warning' | 'neutral';
        id: string;
    }[];
}

export const generateExecutiveBriefing = (objectives: Objective[]): BriefingSection[] => {
    const attentionItems: Objective[] = [];
    const watchItems: Objective[] = [];
    const stableItemsWithChanges: Objective[] = [];
    const uncertainItems: Objective[] = [];

    objectives.forEach(obj => {
        const level = calculateAttentionLevel(obj);
        if (level === 'ACTION') attentionItems.push(obj);
        else if (level === 'WATCH') watchItems.push(obj);
        else {
            // Check for recent change (freshness + non-empty summary)
            // Assuming "Recent" means within last week or just simply having a summary in the latest heartbeat
            if (obj.latestHeartbeat?.summary) {
                stableItemsWithChanges.push(obj);
            }
        }

        // Check uncertainty specifically
        const isUncertain = (obj.latestHeartbeat?.systemAssessment?.uncertaintyFlags?.length || 0) > 0;
        if (isUncertain) uncertainItems.push(obj);
    });

    const sections: BriefingSection[] = [];

    // 1. Critical Attention
    if (attentionItems.length > 0) {
        sections.push({
            title: "🛑 Critical Attention Needed",
            items: attentionItems.map(obj => ({
                body: `Confidence is ${obj.latestHeartbeat?.ownerInput?.ownerConfidence ?? 'Unknown'}% and ${obj.latestHeartbeat?.systemAssessment?.confidenceTrend || 'STABLE'}. Risks: ${obj.latestHeartbeat?.ownerInput?.newRisks?.map(r => r?.description).join(', ') || 'No explicit risks listed'}.`,
                severity: 'critical',
                id: obj.id
            }))
        });
    }

    // 2. Watch List
    if (watchItems.length > 0) {
        sections.push({
            title: "⚠️ Watch List",
            items: watchItems.map(obj => ({
                headline: obj.title,
                body: `Monitor for potential degradation. Current Status: ${obj.latestHeartbeat?.ownerInput?.ownerConfidence ?? 'Unknown'}%.`,
                severity: 'warning',
                id: obj.id
            }))
        });
    }

    // 3. Uncertainty Spotlight
    if (uncertainItems.length > 0) {
        sections.push({
            title: "🔦 Uncertainty Spotlight",
            items: uncertainItems.map(obj => ({
                headline: obj.title,
                body: `Data integrity flags detected: ${obj.latestHeartbeat?.systemAssessment?.uncertaintyFlags?.join(', ')}.`,
                severity: 'warning',
                id: obj.id
            }))
        });
    }

    // 4. Notable Progress (Stable only)
    if (stableItemsWithChanges.length > 0) {
        sections.push({
            title: "✅ Notable Progress",
            items: stableItemsWithChanges.map(obj => ({
                headline: obj.title,
                body: obj.latestHeartbeat?.summary || "Progress reported.",
                severity: 'neutral',
                id: obj.id
            }))
        });
    }

    if (sections.length === 0) {
        sections.push({
            title: "Executive Summary",
            items: [{
                headline: "All clear.",
                body: "No critical items, watch items, or recent updates to report.",
                severity: 'neutral',
                id: 'default'
            }]
        });
    }

    return sections;
};
