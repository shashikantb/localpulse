
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { updateUserBusinessCategory } from '@/app/users/[userId]/actions';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_CATEGORIES } from '@/lib/db-types';
import { ScrollArea } from './ui/scroll-area';

const formSchema = z.object({
  business_category: z.string().min(1, 'Please select a business category.'),
  business_other_category: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.business_category === 'Any Other' && (!data.business_other_category || data.business_other_category.trim().length < 2)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please specify your business type.',
            path: ['business_other_category'],
        });
    }
});

type FormData = z.infer<typeof formSchema>;

export default function UpdateBusinessCategoryForm({ onUpdate }: { onUpdate: () => void }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      business_category: '',
      business_other_category: '',
    },
  });

  const selectedCategory = form.watch('business_category');

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setServerError(null);
    
    const result = await updateUserBusinessCategory(data);

    if (result.success) {
      toast({
        title: 'Business Category Updated!',
        description: 'Your profile has been updated.',
      });
      onUpdate();
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
            name="business_category"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Business Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select your business category" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <ScrollArea className="h-72">
                        {Object.entries(BUSINESS_CATEGORIES).map(([group, categories]) => (
                            <React.Fragment key={group}>
                            <FormLabel className="px-2 py-1.5 text-sm font-semibold">{group}</FormLabel>
                            {categories.map(category => (
                                <SelectItem key={category} value={category}>{category}</SelectItem>
                            ))}
                            </React.Fragment>
                        ))}
                        </ScrollArea>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            {selectedCategory === 'Any Other' && (
                <FormField
                    control={form.control}
                    name="business_other_category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Please Specify Your Business</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="e.g., Book Binding Service" disabled={isSubmitting} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save Category</>
          )}
        </Button>
      </form>
    </Form>
  );
}
