import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { generateBriefing } from './functions/generate-briefing/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  generateBriefing,
});

backend.generateBriefing.resources.lambda.addToRolePolicy({
  Effect: 'Allow',
  Action: ['bedrock:InvokeModel'],
  Resource: 'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0',
});
