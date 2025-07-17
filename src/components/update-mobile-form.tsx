
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
import type { UserRole } from '@/lib/db-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { COUNTRIES } from '@/lib/countries';
import { ScrollArea } from './ui/scroll-area';

const formSchema = z.object({
  countryCode: z.string().min(1, 'Country code is required.'),
  mobilenumber: z.string().regex(/^\d{10}$/, {
    message: 'Please enter a valid 10-digit mobile number.',
  }),
});

type FormData = z.infer<typeof formSchema>;

interface UpdateMobileFormProps {
    onUpdate?: () => void;
    userRole: UserRole;
}

export default function UpdateMobileForm({ onUpdate, userRole }: UpdateMobileFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      countryCode: '+91',
      mobilenumber: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setServerError(null);

    const result = await updateUserMobile(data);

    if (result.success) {
      toast({
        title: 'Mobile Number Updated!',
        description: userRole === 'Gorakshak' ? 'Your ID card is now available.' : 'Your profile has been updated.',
      });
      if (onUpdate) onUpdate();
    } else {
      setServerError(result.error || 'An unexpected error occurred.');
    }
    setIsSubmitting(false);
  };

  const buttonText = userRole === 'Gorakshak' ? 'Save & Generate ID Card' : 'Save Number';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
            <Alert variant="destructive">
                <AlertTitle>Update Failed</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
            </Alert>
        )}
        <FormItem>
            <FormLabel>Your Mobile Number</FormLabel>
            <div className="flex gap-2">
                <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                        <FormItem className="w-1/3">
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                                <FormControl>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <ScrollArea className="h-72">
                                    {COUNTRIES.map(country => (
                                      <SelectItem key={country.name} value={`+${country.code}`}>
                                        {country.name} (+{country.code})
                                      </SelectItem>
                                    ))}
                                  </ScrollArea>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="mobilenumber"
                    render={({ field }) => (
                        <FormItem className="flex-1">
                            <FormControl>
                                <Input id="mobilenumber" type="tel" placeholder="10-digit number" {...field} disabled={isSubmitting} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </FormItem>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> {buttonText}</>
          )}
        </Button>
      </form>
    </Form>
  );
}
