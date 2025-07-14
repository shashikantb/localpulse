import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  // Disabling these features is crucial to prevent Next.js build errors,
  // as they pull in server-side dependencies incompatible with Webpack.
  enableTracingAndMetrics: false,
});
