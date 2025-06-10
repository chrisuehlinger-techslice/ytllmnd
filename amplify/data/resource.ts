import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Chat: a
    .model({
      systemPrompt: a.string().required(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
  
  Message: a
    .model({
      chatId: a.id().required(),
      content: a.string().required(),
      role: a.enum(['user', 'assistant']),
      timestamp: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
