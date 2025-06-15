
import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck } from 'lucide-react';

const PrivacyPolicyPage: NextPage = () => {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-3xl space-y-8 py-8">
        <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4 pt-6 px-6 bg-gradient-to-br from-card to-muted/10 rounded-t-xl">
            <CardTitle className="text-3xl font-bold text-primary flex items-center">
              <ShieldCheck className="w-8 h-8 mr-3 text-accent" />
              Privacy Policy for LocalPulse
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
              <div className="space-y-6 text-foreground/90">
                <p className="text-sm text-muted-foreground">
                  Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>

                <p className="font-bold text-lg text-destructive">
                  IMPORTANT: This is a placeholder privacy policy. You MUST replace this content with a professionally drafted policy that accurately reflects your data collection, use, and sharing practices, and complies with all applicable laws and regulations before publishing your app. Consult with a legal professional.
                </p>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">1. Introduction</h2>
                  <p>
                    Welcome to LocalPulse (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). LocalPulse is designed to help you share and discover what&apos;s happening around you. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services (collectively, the &quot;Service&quot;).
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">2. Information We Collect</h2>
                  <p>We may collect information about you in a variety of ways. The information we may collect via the Service includes:</p>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>
                      <strong>Location Data:</strong> To provide our core service of showing nearby posts, we collect your precise geolocation data when you use the app and have granted location permissions. This data may be used to determine your city for posts and for filtering content.
                    </li>
                    <li>
                      <strong>User-Generated Content:</strong> We collect the content you create and share on LocalPulse, including text, images, videos, and hashtags (&quot;Posts&quot;), as well as any comments you make. This content is public by nature once posted.
                    </li>
                    <li>
                      <strong>Device Information for Notifications:</strong> If you enable push notifications, we may collect your Firebase Cloud Messaging (FCM) token to send you notifications about nearby posts. This token is associated with your device. We may also store your device's last known general location (latitude/longitude if provided during token registration) to help target these notifications.
                    </li>
                    <li>
                      <strong>Usage Data (Placeholder):</strong> We may collect information about how you use the Service, such as the features you use, the actions you take, and the time, frequency, and duration of your activities. (Example: This could be through analytics tools - specify if used).
                    </li>
                    <li>
                      <strong>Admin Credentials:</strong> For administrative access, we store a username and password as configured in the environment variables. This is not for general user accounts.
                    </li>
                  </ul>
                   <p className="italic text-muted-foreground text-sm">
                    Note: Currently, LocalPulse does not require user accounts for posting or viewing content. Posts are made anonymously or with a generic identifier.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">3. How We Use Your Information</h2>
                  <p>Having accurate information permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Service to:</p>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>Provide, operate, and maintain our Service.</li>
                    <li>Display posts based on your current location or the location of other users.</li>
                    <li>Facilitate the creation and sharing of posts and comments.</li>
                    <li>Send you push notifications about new posts nearby, if you have opted-in.</li>
                    <li>Monitor and analyze usage and trends to improve your experience with the Service.</li>
                    <li>Respond to your comments and questions and provide customer support (if applicable).</li>
                    <li>Enforce our terms, conditions, and policies.</li>
                    <li>Comply with legal obligations.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">4. Disclosure of Your Information</h2>
                  <p>We may share information we have collected about you in certain situations. Your information may be disclosed as follows:</p>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>
                      <strong>Public Posts and Comments:</strong> Any information you post (text, media, hashtags, city) or comment you make will be publicly visible to other users of the Service.
                    </li>
                    <li>
                      <strong>Third-Party Service Providers (Placeholder):</strong> We may share your information with third-party vendors, service providers, contractors, or agents who perform services for us or on our behalf and require access to such information to do that work (e.g., cloud hosting, data analytics, push notification delivery). We will take steps to ensure these providers protect your information. (Specify any actual third-party services used, e.g., Google for GenAI, geocoding services if any beyond the placeholder).
                    </li>
                    <li>
                      <strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.
                    </li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">5. Data Security</h2>
                  <p>
                    We use administrative, technical, and physical security measures to help protect your information. While we have taken reasonable steps to secure the information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">6. Data Retention</h2>
                  <p>
                    We will retain your information for as long as necessary to fulfill the purposes outlined in this Privacy Policy unless a longer retention period is required or permitted by law. (Specify your actual data retention periods for posts, comments, device tokens etc.).
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">7. Your Choices and Rights</h2>
                  <p>You have certain choices and rights regarding the information we collect:</p>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>
                      <strong>Location Information:</strong> You can control access to your device’s location information through your device’s settings. If you disable location services, certain features of the Service may not function properly.
                    </li>
                    <li>
                      <strong>Push Notifications:</strong> You can opt-out of receiving push notifications by changing the settings on your device or, if applicable, within the app (functionality not yet implemented).
                    </li>
                    <li>
                      <strong>Access, Correction, Deletion (Placeholder):</strong> Depending on your jurisdiction, you may have rights to access, correct, or delete your personal information. (Detail how users can exercise these rights if applicable, especially since content is largely public and anonymous).
                    </li>
                  </ul>
                </section>

                 <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">8. Children&apos;s Privacy</h2>
                  <p>
                    Our Service is not intended for use by children under the age of 13 (or a higher age threshold as applicable in your jurisdiction). We do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will take steps to delete such information as soon as possible.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">9. Changes to This Privacy Policy</h2>
                  <p>
                    We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot; date. You are advised to review this Privacy Policy periodically for any changes.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-xl font-semibold text-primary">10. Contact Us</h2>
                  <p>
                    If you have any questions or concerns about this Privacy Policy, please contact us at:
                    <br />
                    [Your Email Address or Contact Method Here]
                  </p>
                </section>

                <p className="font-bold text-lg text-destructive pt-4 border-t mt-6">
                  Reminder: This is placeholder text. Replace it with your actual, legally compliant Privacy Policy.
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
