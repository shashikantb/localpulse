
'use server';
/**
 * @fileOverview A local helper AI agent.
 *
 * - localHelper - A function that handles responding to user queries about their local area.
 * - LocalHelperInput - The input type for the localHelper function.
 * - LocalHelperOutput - The return type for the localHelper function.
 */

import { ai } from '@/ai/ai-instance';
import { getNearbyBusinessesDb } from '@/lib/db';
import type { BusinessUser } from '@/lib/db-types';
import { z } from 'zod';

const LocalHelperInputSchema = z.object({
  query: z.string().describe('The user question about their local area.'),
  latitude: z.number().describe('The latitude of the user.'),
  longitude: z.number().describe('The longitude of the user.'),
});
export type LocalHelperInput = z.infer<typeof LocalHelperInputSchema>;

export type LocalHelperOutput = string;

// Tool for the AI to find nearby businesses
const findNearbyBusinessesTool = ai.defineTool(
  {
    name: 'findNearbyBusinesses',
    description:
      'Finds nearby businesses based on the user\'s location and an optional category. Use this to answer questions about local services, shops, or restaurants.',
    inputSchema: z.object({
      category: z
        .string()
        .optional()
        .describe(
          'A specific business category to filter by, e.g., "Restaurant", "Plumber", "Hardware Store".'
        ),
    }),
    outputSchema: z.array(
      z.object({
        name: z.string(),
        business_category: z.string().nullable(),
        distance: z.number().nullable(),
      })
    ),
  },
  async (input, context) => {
    const { latitude, longitude } = context.flow.input as LocalHelperInput;

    const businesses = await getNearbyBusinessesDb({
      latitude,
      longitude,
      category: input.category,
      limit: 5, // Limit to top 5 results for concise answers
      offset: 0,
    });

    return businesses.map((b: BusinessUser) => ({
      name: b.name,
      business_category: b.business_category,
      distance: b.distance,
    }));
  }
);

// The main flow for the Local Helper
const localHelperFlow = ai.defineFlow(
  {
    name: 'localHelperFlow',
    inputSchema: LocalHelperInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const llmResponse = await ai.generate({
      prompt: `You are a friendly and helpful local guide for the LocalPulse app.
               Your goal is to answer the user's question based on the data provided by the available tools.
               Be concise and helpful. If you find businesses, present them clearly, perhaps as a list.
               If you can't find anything, say so politely.
               User's Question: ${input.query}`,
      tools: [findNearbyBusinessesTool],
      model: 'googleai/gemini-2.0-flash', // Use a powerful model for tool use
    });

    return llmResponse.text;
  }
);

export async function localHelper(
  input: LocalHelperInput
): Promise<LocalHelperOutput> {
  return localHelperFlow(input);
}
