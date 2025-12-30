import { defineFunction } from '@aws-amplify/backend';

export const generateBriefing = defineFunction({
    name: 'generate-briefing',
    entry: './handler.ts',
    timeoutSeconds: 60, // Give LLM time to think
});
