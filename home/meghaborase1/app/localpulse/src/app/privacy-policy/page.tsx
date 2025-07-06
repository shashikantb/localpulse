
import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck, Bell, AlertTriangle, User, Settings, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const PrivacyPolicyPage: NextPage = () => {
  return (
    <main className="flex min-h-svh flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-3xl space-y-8 py-8">
        <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4 pt-6 px-6 bg-gradient-to-br from-card to-muted/10 rounded-t-xl">
            <CardTitle className="text-3xl font-bold text-primary flex items-center">
              <ShieldCheck className="w-8 h-8 mr-3 text-accent" />
              Privacy Policy & Account Deletion
            </CardTitle>
            <CardDescription>
                Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
              <div className="space-y-6 text-foreground/90">
                
                <section>
                    <Alert variant="default" className="bg-accent/10 border-accent/30">
                        <Bell className="h-5 w-5 text-accent" />
                        <AlertTitle className="font-bold text-base text-accent-foreground/90">
                            Prominent Disclosure for Location Access
                        </AlertTitle>
                        <AlertDescription className="text-foreground/80">
                            LocalPulse collects location data to deliver city-wise news, alerts, and real-time updates relevant to your area. This is essential for the core functionality of the app. This data is never sold to third parties.
                        </AlertDescription>
                    </Alert>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">1. Information We Collect</h2>
                  <p>We may collect and process information such as your name, email, location data, device information, and usage information to provide and improve our service.</p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">2. How We Use Your Information</h2>
                  <p>We use your information to personalize content, send relevant notifications, improve the app, and for security purposes.</p>
                </section>

                <section id="delete-account" className="space-y-2 pt-4 border-t mt-6">
                    <h2 className="text-xl font-semibold text-destructive flex items-center"><Trash2 className="w-5 h-5 mr-2" />Account Deletion</h2>
                    <p>You have the right to permanently delete your account and associated data. Please follow these steps:</p>
                    
                    <ol className="list-decimal list-inside space-y-4 text-foreground/90 my-4 p-4 border bg-muted/50 rounded-lg">
                        <li>
                            <strong>Navigate to Your Profile:</strong> Log in and go to your profile page by clicking the 
                            <span className="inline-block mx-1.5 p-1 bg-muted rounded-md align-middle"><User className="h-4 w-4" /></span>
                             Profile icon in the navigation bar.
                        </li>
                        <li>
                            <strong>Find Settings:</strong> On your profile page, find the "Settings" card, usually near the bottom.
                             <div className="my-2 p-2 bg-background/50 border rounded-md flex items-center gap-2 text-sm">
                                <Settings className="w-4 h-4 text-primary"/>
                                <span>Look for the Settings section.</span>
                            </div>
                        </li>
                        <li>
                            <strong>Click "Delete Account":</strong> Inside Settings, click the red "Delete Account" button.
                        </li>
                        <li>
                            <strong>Confirm Deletion:</strong> A confirmation pop-up will appear. This is your final chance to cancel. To proceed, click the final confirmation button.
                        </li>
                    </ol>

                    <h3 className="text-lg font-medium text-foreground/80 pt-2">What Happens When You Delete Your Account?</h3>
                    <p className="font-semibold text-destructive">This action is permanent and cannot be undone.</p>
                     <ul className="list-disc list-inside space-y-2 text-foreground/90">
                        <li>Your user profile, including your name, email, and profile picture, will be permanently deleted.</li>
                        <li>All of your likes, comments, and follower relationships will be removed.</li>
                        <li>Your posts will **not** be deleted. Instead, they will become "anonymous" and will no longer be linked to your account.</li>
                     </ul>
                </section>

                <p className="font-bold text-lg text-destructive pt-4 border-t mt-6">
                  Note: This privacy policy provides a general overview. For specific details relevant to your usage and jurisdiction, please review the full legal documentation or contact support.
                </p>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default PrivacyPolicyPage;
