
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
import { getGcsClient, getGcsBucketName } from '@/lib/gcs';
import { getJson } from 'google-search-results-nodejs';

// Define city coordinates
const cityCoordinates: { [key: string]: { lat: number; lon: number } } = {
  Mumbai: { lat: 19.076, lon: 72.8777 },
  Pune: { lat: 18.5204, lon: 73.8567 },
  Nashik: { lat: 20.0112, lon: 73.7909 },
  Dhule: { lat: 20.9042, lon: 74.7749 },
  Shirpur: { lat: 21.3486, lon: 74.8797 },
  Dondaicha: { lat: 21.3197, lon: 74.5765 },
};

const SeedContentInputSchema = z.object({
  city: z.string().describe('The city name, e.g., "Mumbai".'),
});
export type SeedContentInput = z.infer<typeof SeedContentInputSchema>;

const SeedContentOutputSchema = z.object({
  posts: z.array(
    z.object({
      content: z.string().describe('The rewritten, engaging local news update or "pulse" for the app.'),
      photo_hint: z
        .string()
        .optional()
        .describe(
          'A simple 1-2 word description for a photo if this post would benefit from one. E.g., "traffic jam" or "food festival". Omit if no photo is needed.'
        ),
    })
  ),
});
export type SeedContentOutput = z.infer<typeof SeedContentOutputSchema>;

// Tool for the AI to search the web for real news
const searchTheWeb = ai.defineTool(
    {
        name: 'searchTheWeb',
        description: 'Searches the web for recent news and updates for a specific city.',
        inputSchema: z.object({
            query: z.string().describe('The search query, e.g., "latest news in Mumbai".'),
        }),
        outputSchema: z.object({
            results: z.array(z.object({
                title: z.string(),
                link: z.string(),
                snippet: z.string(),
            })),
        }),
    },
    async (input) => {
        if (!process.env.SERPAPI_API_KEY) {
            throw new Error('SERPAPI_API_KEY environment variable is not set. Cannot perform web search.');
        }

        const json = await getJson({
            engine: 'google',
            q: input.query,
            api_key: process.env.SERPAPI_API_KEY,
        });

        const results = (json.organic_results || []).slice(0, 5).map(res => ({
            title: res.title,
            link: res.link,
            snippet: res.snippet,
        }));

        return { results };
    }
);


// Helper function to upload base64 image to GCS
async function uploadImageToGcs(base64Data: string, city: string): Promise<string> {
    const gcsClient = getGcsClient();
    const bucketName = getGcsBucketName();

    if (!gcsClient || !bucketName) {
        throw new Error('GCS not configured. Cannot upload image.');
    }
    
    // Extract mime type and data from data URI
    const match = base64Data.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error('Invalid base64 image data URI format.');
    }
    const contentType = match[1];
    const data = match[2];

    const buffer = Buffer.from(data, 'base64');
    const fileName = `seeded-content/${city.toLowerCase().replace(' ', '-')}/${Date.now()}.png`;
    const file = gcsClient.bucket(bucketName).file(fileName);

    await file.save(buffer, {
        metadata: { contentType: contentType },
        public: true, // Make the file publicly readable
    });
    
    // Return the public URL
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
}


const generateContentPrompt = ai.definePrompt({
    name: 'seedContentPrompt',
    input: { schema: SeedContentInputSchema },
    output: { schema: SeedContentOutputSchema },
    model: 'googleai/gemini-2.0-flash',
    tools: [searchTheWeb],
    prompt: `You are an AI for a social media app called LocalPulse. Your task is to act as a local news curator.
    
    1. First, use the 'searchTheWeb' tool to find 2-3 of the most recent and relevant news updates for the city of {{{city}}}, India. Use a search query like "latest news in {{{city}}}".
    2. For each piece of news you find, rewrite it into a short, realistic, and engaging local news update or "pulse" for the app.
    3. Keep each pulse under 280 characters.
    4. For each rewritten pulse, provide a simple 1-2 word "photo_hint" describing a suitable image (e.g., "new metro line", "road construction", "community event"). Omit the photo_hint if no photo is suitable.
    5. The tone should be informative but casual, like a real person sharing an update.
    6. DO NOT use hashtags.

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
    const { output } = await generateContentPrompt(input);
    if (!output || !output.posts || output.posts.length === 0) {
        return { success: false, message: 'AI failed to generate content.', postCount: 0 };
    }
    
    // 2. Loop through the generated content and create posts
    let createdCount = 0;
    for (const post of output.posts) {
        if (post.content) {
            let mediaUrls: string[] | undefined = undefined;
            let mediaType: 'image' | undefined = undefined;
            
            // If there's a photo hint, generate an image
            if(post.photo_hint) {
                 try {
                    const { media } = await ai.generate({
                        model: 'googleai/gemini-2.0-flash-preview-image-generation',
                        prompt: `A realistic photo of ${post.photo_hint} in ${input.city}, India.`,
                        config: { responseModalities: ['TEXT', 'IMAGE'] },
                    });

                    if (media && media.url) {
                        const publicUrl = await uploadImageToGcs(media.url, input.city);
                        mediaUrls = [publicUrl];
                        mediaType = 'image';
                    }
                } catch (imgError) {
                    console.error(`Failed to generate or upload image for hint "${post.photo_hint}":`, imgError);
                    // Continue without an image if generation fails
                }
            }
            
            const postDataForDb: DbNewPost = {
              content: post.content,
              latitude: cityCoords.lat,
              longitude: cityCoords.lon,
              mediaurls: mediaUrls,
              mediatype: mediaType,
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
