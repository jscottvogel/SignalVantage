import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any unauthenticated user can "create", "read", "update", 
and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  Organization: a
    .model({
      name: a.string().required(),
      members: a.hasMany('Membership', 'organizationId'),
      objectives: a.hasMany('StrategicObjective', 'organizationId'),
      outcomes: a.hasMany('Outcome', 'organizationId'),
      keyResults: a.hasMany('KeyResult', 'organizationId'),
      initiatives: a.hasMany('Initiative', 'organizationId'),
    })
    .authorization((allow) => [allow.authenticated()]),
  UserProfile: a
    .model({
      email: a.string(),
      preferredName: a.string(),
      memberships: a.hasMany('Membership', 'userProfileId'),
    })
    .authorization((allow) => [allow.owner()]),
  Membership: a
    .model({
      role: a.enum(['OWNER', 'MEMBER']),
      organizationId: a.id().required(),
      userProfileId: a.id().required(),
      organization: a.belongsTo('Organization', 'organizationId'),
      user: a.belongsTo('UserProfile', 'userProfileId'),
    })
    .authorization((allow) => [allow.authenticated()]),

  Timeframe: a.customType({
    startDate: a.date(),
    endDate: a.date(),
  }),

  ObjectiveOwner: a.customType({
    userId: a.id(),
    displayName: a.string(),
    role: a.string(),
  }),

  Benefit: a.customType({
    type: a.string(),
    statement: a.string(),
    notes: a.string(),
  }),

  MetricBaseline: a.customType({
    value: a.float(),
    asOf: a.date(),
  }),

  MetricTarget: a.customType({
    value: a.float(),
    by: a.date(),
  }),

  DataSource: a.customType({
    type: a.string(),
    description: a.string(),
  }),

  Metric: a.customType({
    name: a.string(),
    unit: a.string(),
    direction: a.string(),
    baseline: a.ref('MetricBaseline'),
    target: a.ref('MetricTarget'),
    dataSource: a.ref('DataSource'),
  }),

  Confidence: a.customType({
    overall: a.string(),
    trend: a.string(),
    asOf: a.datetime(),
    drivers: a.string().array(),
    limitations: a.string().array(),
  }),

  HeartbeatSource: a.customType({
    type: a.string(),
    id: a.string(),
    initiativeId: a.string(),
    timestamp: a.datetime(),
  }),

  LatestHeartbeat: a.customType({
    heartbeatId: a.string(),
    summary: a.string(),
    timestamp: a.datetime(),
    systemAssessment: a.ref('SystemAssessment'),
    sources: a.ref('HeartbeatSource').array(),
    ownerInput: a.ref('OwnerInput'),
  }),

  // Initiative Custom Types
  LinkedEntities: a.customType({
    strategicObjectiveIds: a.string().array(),
    outcomeIds: a.string().array(),
    keyResultIds: a.string().array(),
  }),

  InitiativeTimeframe: a.customType({
    startDate: a.date(),
    targetDate: a.date(),
  }),

  InitiativeState: a.customType({
    lifecycle: a.string(),
    health: a.string(),
    updatedAt: a.datetime(),
  }),

  HeartbeatCadence: a.customType({
    frequency: a.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']),
    dayOfWeek: a.enum(['MON', 'TUES', 'WED', 'THU', 'FRI', 'SAT', 'SUN']),
    hour: a.integer(), // 0-23
  }),

  Risk: a.customType({
    id: a.string(),
    description: a.string(),
    impact: a.string(),
    probability: a.string(),
  }),

  Dependency: a.customType({
    id: a.string(),
    description: a.string(),
    owner: a.string(),
    status: a.string(),
  }),

  OwnerInput: a.customType({
    progressSummary: a.string(),
    milestoneStatus: a.string(),
    ownerConfidence: a.string(),
    confidenceRationale: a.string(),
    newRisks: a.ref('Risk').array(),
    dependencies: a.ref('Dependency').array(),
  }),

  IntegritySignals: a.customType({
    updateFreshness: a.string(),
    languageSpecificity: a.string(),
    signalConsistency: a.string(),
  }),

  FIR: a.customType({
    facts: a.string().array(),
    inferences: a.string().array(),
    recommendations: a.string().array(),
  }),

  SystemAssessment: a.customType({
    systemConfidence: a.string(),
    confidenceTrend: a.string(),
    integritySignals: a.ref('IntegritySignals'),
    uncertaintyFlags: a.string().array(),
    factsInferencesRecommendations: a.ref('FIR'),
  }),

  EvidenceLink: a.customType({
    type: a.string(),
    sourceId: a.string(),
    submittedBy: a.string(),
    submittedAt: a.datetime(),
  }),

  InitiativeHeartbeat: a.customType({
    heartbeatId: a.string(),
    summary: a.string(),
    timestamp: a.datetime(),
    ownerInput: a.ref('OwnerInput'),
    systemAssessment: a.ref('SystemAssessment'),
    evidenceLinks: a.ref('EvidenceLink').array(),
  }),



  Audit: a.customType({
    createdBy: a.string(),
    updatedBy: a.string(),
    version: a.integer(),
  }),

  Heartbeat: a
    .model({
      type: a.enum(['SCHEDULED', 'EVENT_TRIGGERED']),
      status: a.enum(['PENDING', 'COMPLETED']),

      timestamp: a.datetime().required(),
      authorId: a.id(),

      ownerInput: a.ref('OwnerInput'),
      systemAssessment: a.ref('SystemAssessment'),

      initiativeId: a.id(),
      initiative: a.belongsTo('Initiative', 'initiativeId'),

      keyResultId: a.id(),
      keyResult: a.belongsTo('KeyResult', 'keyResultId'),

      strategicObjectiveId: a.id(),
      strategicObjective: a.belongsTo('StrategicObjective', 'strategicObjectiveId'),

      outcomeId: a.id(),
      outcome: a.belongsTo('Outcome', 'outcomeId'),
    })
    .authorization((allow) => [allow.authenticated()]),

  StrategicObjective: a
    .model({
      title: a.string().required(),
      description: a.string(),
      timeframe: a.ref('Timeframe'),
      owner: a.ref('ObjectiveOwner'),
      tags: a.string().array(),
      status: a.enum(['active', 'draft', 'closed', 'archived']),
      latestHeartbeat: a.ref('InitiativeHeartbeat'), // Using the richer heartbeat type
      heartbeats: a.hasMany('Heartbeat', 'strategicObjectiveId'),
      heartbeatCadence: a.ref('HeartbeatCadence'),
      nextHeartbeatDue: a.datetime(),

      organizationId: a.id().required(),
      organization: a.belongsTo('Organization', 'organizationId'),
      outcomes: a.hasMany('Outcome', 'strategicObjectiveId'),
      keyResults: a.hasMany('KeyResult', 'strategicObjectiveId'),
    })
    .authorization((allow) => [allow.authenticated()]),

  Outcome: a
    .model({
      title: a.string().required(),
      description: a.string(),
      benefit: a.ref('Benefit'),
      timeframe: a.ref('Timeframe'),
      owner: a.ref('ObjectiveOwner'),
      tags: a.string().array(),
      status: a.enum(['active', 'draft', 'closed', 'archived']),
      latestHeartbeat: a.ref('InitiativeHeartbeat'),
      heartbeats: a.hasMany('Heartbeat', 'outcomeId'),
      heartbeatCadence: a.ref('HeartbeatCadence'),
      nextHeartbeatDue: a.datetime(),

      organizationId: a.id().required(),
      organization: a.belongsTo('Organization', 'organizationId'),

      strategicObjectiveId: a.id().required(),
      strategicObjective: a.belongsTo('StrategicObjective', 'strategicObjectiveId'),
      keyResults: a.hasMany('KeyResult', 'outcomeId'),
    })
    .authorization((allow) => [allow.authenticated()]),

  KeyResult: a
    .model({
      statement: a.string().required(),
      metric: a.ref('Metric'),
      measurementCadence: a.string(),
      owners: a.ref('ObjectiveOwner').array(),
      status: a.enum(['active', 'draft', 'closed', 'archived']),
      confidence: a.ref('Confidence'),
      latestHeartbeat: a.ref('LatestHeartbeat'),
      heartbeats: a.hasMany('Heartbeat', 'keyResultId'),
      heartbeatCadence: a.ref('HeartbeatCadence'),
      nextHeartbeatDue: a.datetime(),

      organizationId: a.id().required(),
      organization: a.belongsTo('Organization', 'organizationId'),

      strategicObjectiveId: a.id().required(),
      strategicObjective: a.belongsTo('StrategicObjective', 'strategicObjectiveId'),

      outcomeId: a.id().required(),
      outcome: a.belongsTo('Outcome', 'outcomeId'),
    })
    .authorization((allow) => [allow.authenticated()]),

  Initiative: a
    .model({
      title: a.string().required(),
      description: a.string(),
      linkedEntities: a.ref('LinkedEntities'),
      owner: a.ref('ObjectiveOwner'),
      timeframe: a.ref('InitiativeTimeframe'),
      state: a.ref('InitiativeState'),
      heartbeatCadence: a.ref('HeartbeatCadence'),
      nextHeartbeatDue: a.datetime(),
      latestHeartbeat: a.ref('InitiativeHeartbeat'),
      heartbeats: a.hasMany('Heartbeat', 'initiativeId'),
      audit: a.ref('Audit'),

      organizationId: a.id().required(),
      organization: a.belongsTo('Organization', 'organizationId'),
    })
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
