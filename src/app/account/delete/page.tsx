
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Settings, AlertTriangle, ListOrdered } from 'lucide-react';
import Link from 'next/link';

export default function DeleteAccountPage() {
  return (
    <div className="flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="container mx-auto w-full max-w-2xl space-y-6">
        <Card className="shadow-lg border-border/60">
            <CardHeader>
                <CardTitle className="flex items-center text-3xl font-bold">
                    <AlertTriangle className="w-8 h-8 mr-3 text-destructive" />
                    Account Deletion Guide
                </CardTitle>
                <CardDescription>
                    How to permanently delete your LocalPulse account.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
                <div className="p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg text-yellow-800 dark:text-yellow-300">
                    <p className="font-semibold">Please read carefully before proceeding. Account deletion is permanent and cannot be undone.</p>
                </div>
                
                <h3 className="text-xl font-semibold flex items-center pt-2">
                    <ListOrdered className="w-5 h-5 mr-2 text-primary"/>
                    Steps to Delete Your Account
                </h3>

                <ol className="list-decimal list-inside space-y-4 text-foreground/90">
                    <li>
                        <strong>Navigate to Your Profile:</strong> Log in to your account and go to your profile page. You can do this by clicking the 
                        <span className="inline-block mx-1.5 p-1 bg-muted rounded-md align-middle"><User className="h-4 w-4" /></span>
                         Profile icon in the navigation bar.
                    </li>
                    <li>
                        <strong>Find the Settings Section:</strong> On your profile page, scroll down to find the "Settings" card.
                        <div className="my-2 p-4 bg-muted/50 border rounded-md flex items-center gap-2 text-sm">
                            <Settings className="w-5 h-5 text-primary"/>
                            <span>This is what the Settings section looks like.</span>
                        </div>
                    </li>
                    <li>
                        <strong>Click "Delete Account":</strong> Inside the Settings card, you will find a red button labeled "Delete Account." Click this button to begin the process.
                    </li>
                    <li>
                        <strong>Confirm Deletion:</strong> A confirmation pop-up will appear. To finalize the deletion, you must click the "Yes, delete my account" button.
                    </li>
                </ol>

                 <h3 className="text-xl font-semibold pt-4 border-t mt-6">What Happens to Your Data?</h3>
                 <ul className="list-disc list-inside space-y-2 text-foreground/90">
                    <li>Your user profile, including your name, email, and profile picture, will be permanently deleted.</li>
                    <li>All of your likes, comments, and follows will be removed.</li>
                    <li>Your posts will **not** be deleted. Instead, they will become "anonymous" and will no longer be linked to you.</li>
                 </ul>
                 <p className="text-sm text-muted-foreground pt-4">
                    If you have any questions, please contact our support team before deleting your account.
                 </p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
