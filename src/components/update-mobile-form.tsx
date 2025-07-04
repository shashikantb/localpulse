
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { updateUserMobile } from '@/app/users/[userId]/actions';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Phone, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const formSchema = z.object({
  mobilenumber: z.string().regex(/^\d{10}$/, {
    message: 'Please enter a valid 10-digit mobile number.',
  }),
});

type FormData = z.infer<typeof formSchema>;

export default function UpdateMobileForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mobilenumber: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setServerError(null);

    const formData = new FormData();
    formData.append('mobilenumber', data.mobilenumber);
    
    const result = await updateUserMobile(formData);

    if (result.success) {
      toast({
        title: 'Mobile Number Updated!',
        description: 'Your ID card is now available.',
      });
      // The page will be revalidated by the server action.
    } else {
      setServerError(result.error || 'An unexpected error occurred.');
    }
    setIsSubmitting(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
            <Alert variant="destructive">
                <AlertTitle>Update Failed</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
            </Alert>
        )}
        <FormField
          control={form.control}
          name="mobilenumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="mobilenumber">Your 10-Digit Mobile Number</FormLabel>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <FormControl>
                  <Input id="mobilenumber" type="tel" placeholder="e.g., 9876543210" className="pl-10" {...field} disabled={isSubmitting} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save & Generate ID Card</>
          )}
        </Button>
      </form>
    </Form>
  );
}
