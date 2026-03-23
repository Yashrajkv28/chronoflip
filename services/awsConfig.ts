import { Amplify } from 'aws-amplify';

const required = (name: string): string => {
  const val = import.meta.env[name];
  if (!val) throw new Error(`Missing env var: ${name}. Copy .env.example to .env and fill in your AWS values.`);
  return val;
};

// Throws on missing env vars — app cannot function without AWS config.
// In production (Amplify Hosting), env vars are always set.
// In development, a clear error message guides the developer to create .env.
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: required('VITE_COGNITO_USER_POOL_ID'),
      userPoolClientId: required('VITE_COGNITO_CLIENT_ID'),
    },
  },
  API: {
    GraphQL: {
      endpoint: required('VITE_APPSYNC_ENDPOINT'),
      // Default to userPool (authenticated). Viewer routes explicitly use apiKey.
      // The API key is intentionally in the client bundle — AppSync resolver
      // auth directives (@aws_api_key) scope it to read-only viewer operations.
      defaultAuthMode: 'userPool',
      apiKey: required('VITE_APPSYNC_API_KEY'),
      region: required('VITE_AWS_REGION'),
    },
  },
});
