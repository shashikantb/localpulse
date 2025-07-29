
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
      content: z.string(),
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
    prompt: `You are an AI for a social media app called LocalPulse. Your task is to generate 5 to 7 short, realistic, and engaging local news updates or "pulses" for the city of {{{city}}}.

    Guidelines:
    - Keep each pulse under 280 characters.
    - Cover a variety of topics: traffic, local events, public service announcements, interesting observations, new business openings, etc.
    - For about half of the posts, provide a simple 1-2 word "photo_hint" describing a suitable image (e.g., "traffic jam", "food festival", "stray dog", "sunset view"). Omit the photo_hint for text-only posts.
    - The tone should be informative but casual, like a real person sharing an update.
    - DO NOT use hashtags.
    - Generate completely fictional but plausible content. Do not use real, time-sensitive news.

    Example for Mumbai:
    - "Heads up, there's a big traffic jam on the Western Express Highway near Andheri. Might want to take the metro!", photo_hint: "traffic jam"
    - "Wow, the sea link looks absolutely stunning in the monsoon mist today."
    - "Looks like they're setting up for a food festival at the Bandra Kurla Complex this weekend. Smells amazing!", photo_hint: "food festival"

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
