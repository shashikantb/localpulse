
'use server';

import { getNearbyBusinessesDb, searchNearbyPostsDb } from '@/lib/db';

export interface LocalSearchInput {
  query: string;
  latitude: number;
  longitude: number;
}

export interface LocalSearchOutput {
  message: string;
}

const BUSINESS_KEYWORDS = ['business', 'shop', 'store', 'restaurant', 'bakery', 'saloon', 'parlour', 'service', 'mechanic', 'plumber', 'electrician', 'cafe', 'find'];
const POST_KEYWORDS = ['latest', 'post', 'pulse', 'news', 'traffic', 'event', 'roadblock', 'update'];
const HELP_KEYWORDS = ['help', 'what can you do', 'info', 'assistance', 'support', 'how do you work'];


function formatBusinesses(businesses: any[]): string {
  if (businesses.length === 0) {
    return "I couldn't find any businesses matching your search. Please try a different search term.";
  }

  const businessList = businesses
    .map(b => {
        const distanceKm = b.distance ? (b.distance / 1000).toFixed(1) : null;
        const mapsLink = b.latitude && b.longitude ? `[View on Map](https://www.google.com/maps?q=${b.latitude},${b.longitude})` : '';
        const distanceInfo = distanceKm ? `(approx. ${distanceKm} km away)` : '';
        
        return `- **${b.name}** (${b.business_category}) ${distanceInfo}\n  ${mapsLink}`;
    })
    .join('\n');
  
  return `I found the following businesses nearby:\n${businessList}`;
}


function formatPosts(posts: any[]): string {
  if (posts.length === 0) {
    return "I couldn't find any recent posts matching your search.";
  }

  const postList = posts
    .map(p => `- **${p.authorname || 'Anonymous'}:** "${p.content}"`)
    .join('\n');
  
  return `Here are the latest posts I found:\n${postList}`;
}


export async function localSearch(input: LocalSearchInput): Promise<LocalSearchOutput> {
  const queryLower = input.query.toLowerCase();

  const isHelpQuery = HELP_KEYWORDS.some(keyword => queryLower.includes(keyword));
  if (isHelpQuery) {
    return {
        message: "I can help you with two main things:\n\n1.  **Find local businesses:** Ask me to find a specific type of shop, like `\"restaurants near me\"` or `\"find a plumber\"`.\n\n2.  **Get local updates:** Ask me about recent posts, like `\"latest news\"` or `\"any traffic updates?\"`."
    };
  }

  const isBusinessQuery = BUSINESS_KEYWORDS.some(keyword => queryLower.includes(keyword));
  const isPostQuery = POST_KEYWORDS.some(keyword => queryLower.includes(keyword));

  if (isBusinessQuery) {
    const businesses = await getNearbyBusinessesDb({
      latitude: input.latitude,
      longitude: input.longitude,
      limit: 5,
      offset: 0,
      category: input.query, 
    });
    return { message: formatBusinesses(businesses) };
  }

  if (isPostQuery) {
    const posts = await searchNearbyPostsDb({
      latitude: input.latitude,
      longitude: input.longitude,
      query: input.query,
      limit: 5,
    });
    return { message: formatPosts(posts) };
  }
  
  // Fallback if no keywords match
  const businesses = await getNearbyBusinessesDb({
      latitude: input.latitude,
      longitude: input.longitude,
      limit: 5,
      offset: 0,
      category: input.query,
  });

  if (businesses.length > 0) {
    return { message: formatBusinesses(businesses) };
  }

  return { message: "My apologies, I couldn't find anything for that query. You can ask me to find businesses like 'restaurants' or 'plumbers', or ask about recent events with 'latest news' or 'traffic updates'." };
}
