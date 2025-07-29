
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatabaseZap, Bot } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import SeedContentButton from './seed-content-button';

export const dynamic = 'force-dynamic';

const CITIES = ['Mumbai', 'Pune', 'Nashik'];

const AdminSeedingPage: FC = () => {

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Content Seeding</h1>
        <p className="text-lg text-muted-foreground">Use AI to populate the feed with location-specific content.</p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <DatabaseZap className="mr-2 h-6 w-6 text-primary" />
            Seed City Content
          </CardTitle>
          <CardDescription>
            Generate and post 5-7 anonymous, realistic-sounding "pulses" for a selected city.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Bot className="h-4 w-4" />
            <AlertTitle>How it Works</AlertTitle>
            <AlertDescription>
              <p>This tool uses a Generative AI model to create fictional but plausible local updates for the selected city. The posts are published anonymously and geo-tagged to appear in that city's feed.</p>
              <p className="mt-2 text-xs text-muted-foreground">
                This is great for making the app feel active to new users. The content is not real news.
              </p>
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {CITIES.map((city) => (
                <SeedContentButton key={city} city={city} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSeedingPage;
