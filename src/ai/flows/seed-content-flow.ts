
'use server';
/**
 * @fileOverview An AI flow for seeding the database with realistic, fictional content.
 *
 * - seedCityContent - A function that handles generating and posting content for a city.
 * - SeedContentInput - The input type for the seedCityContent function.
 * - SeedContentOutput - The return type for the seedCityContent function.
 */

import { ai } from '@/ai/ai-instance';
import { addPostDb } from '@/lib/db';
import type { DbNewPost } from '@/lib/db-types';
import { z } from 'zod';

// Define city coordinates
const cityCoordinates: { [key: string]: { lat: number; lon: number } } = {
  Mumbai: { lat: 19.076, lon: 72.8777 },
  Pune: { lat: 18.5204, lon: 73.8567 },
  Nashik: { lat: 20.0112, lon: 73.7909 },
};

const SeedContentInputSchema = z.object({
  city: z.string().describe('The city name, e.g., "Mumbai".'),
});
export type SeedContentInput = z.infer<typeof SeedContentInputSchema>;

const SeedContentOutputSchema = z.object({
  posts: z.array(
    z.object({
      content: z.string(),
    })
  ),
});
export type SeedContentOutput = z.infer<typeof SeedContentOutputSchema>;


const prompt = ai.definePrompt({
    name: 'seedContentPrompt',
    input: { schema: SeedContentInputSchema },
    output: { schema: SeedContentOutputSchema },
    model: 'googleai/gemini-2.0-flash', // Specify the model to use
    prompt: `You are an AI for a social media app called LocalPulse. Your task is to generate 5 to 7 short, realistic, and engaging local news updates or "pulses" for the city of {{{city}}}.

    Guidelines:
    - Keep each pulse under 280 characters.
    - Cover a variety of topics: traffic, local events, public service announcements, interesting observations, new business openings, etc.
    - The tone should be informative but casual, like a real person sharing an update.
    - DO NOT use hashtags.
    - Generate completely fictional but plausible content. Do not use real, time-sensitive news.

    Example for Mumbai:
    - "Heads up, there's a big traffic jam on the Western Express Highway near Andheri. Might want to take the metro!"
    - "Wow, the sea link looks absolutely stunning in the monsoon mist today."
    - "Looks like they're setting up for a food festival at the Bandra Kurla Complex this weekend. Smells amazing!"

    Generate the content for the city of {{{city}}}.`,
});


const seedContentFlow = ai.defineFlow(
  {
    name: 'seedContentFlow',
    inputSchema: SeedContentInputSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      postCount: z.number(),
    }),
  },
  async (input) => {
    const cityCoords = cityCoordinates[input.city];
    if (!cityCoords) {
        return { success: false, message: `City "${input.city}" not supported.`, postCount: 0 };
    }

    // 1. Generate the content from the AI
    const { output } = await prompt(input);
    if (!output || !output.posts || output.posts.length === 0) {
        return { success: false, message: 'AI failed to generate content.', postCount: 0 };
    }
    
    // 2. Loop through the generated content and create posts
    let createdCount = 0;
    for (const post of output.posts) {
        if (post.content) {
            const postDataForDb: DbNewPost = {
              content: post.content,
              latitude: cityCoords.lat,
              longitude: cityCoords.lon,
              city: input.city,
              authorid: null, // Post as anonymous
              is_family_post: false,
              hide_location: false,
              hashtags: [],
            };
            await addPostDb(postDataForDb);
            createdCount++;
        }
    }

    return { 
        success: true, 
        message: `Successfully seeded ${createdCount} posts for ${input.city}.`,
        postCount: createdCount
    };
  }
);


export async function seedCityContent(city: string) {
    if (!cityCoordinates[city]) {
        throw new Error(`City "${city}" is not supported for content seeding.`);
    }
    return await seedContentFlow({ city });
}
