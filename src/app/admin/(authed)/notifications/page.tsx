
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Award } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import SendNotificationButton from './send-notification-button';

export const dynamic = 'force-dynamic';

const AdminNotificationsPage: FC = () => {

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Notifications</h1>
        <p className="text-lg text-muted-foreground">Send push notifications to your users.</p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Award className="mr-2 h-6 w-6 text-primary" />
            LP Points Reminder
          </CardTitle>
          <CardDescription>
            Send a notification to all users with their current and yesterday's LP Points balance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription>
              <p>This will send a personalized push notification to every user who has enabled them. The message will be dynamic:</p>
              <div className="space-y-2 mt-2">
                <p className="italic bg-muted p-2 rounded-md text-sm">
                  <span className="font-semibold">If points were earned yesterday:</span><br/>
                  "You earned [Y] LP points yesterday! 🎉"
                </p>
                 <p className="italic bg-muted p-2 rounded-md text-sm">
                  <span className="font-semibold">If no points were earned:</span><br/>
                  "Check your LP Points! ✨"
                </p>
              </div>
              <p className="mt-2 text-xs">The body of the notification for all users will be: "Your total is now [X]. Keep pulsing to earn more!"</p>
            </AlertDescription>
          </Alert>
          <SendNotificationButton />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotificationsPage;
