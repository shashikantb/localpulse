

'use client';

import type { FC } from 'react';
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import type { User, UserRole, UserStatus } from '@/lib/db-types';
import { updateUser } from './actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

const userUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  role: z.enum(['Business', 'Gorakshak', 'Public(जनता)', 'Admin', 'Gorakshak Admin']),
  status: z.enum(['pending', 'approved', 'rejected', 'verified']),
});

type UserUpdateFormInputs = z.infer<typeof userUpdateSchema>;

interface UserEditFormProps {
  user: User;
}

const UserEditForm: FC<UserEditFormProps> = ({ user }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UserUpdateFormInputs>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  });

  const onSubmit: SubmitHandler<UserUpdateFormInputs> = async (data) => {
    setIsSubmitting(true);
    // The action will redirect on success, so we only need to handle the error case.
    const result = await updateUser(user.id, data);
    
    if (result?.error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: result.error,
      });
      setIsSubmitting(false);
    } else {
       toast({
        title: 'User Updated!',
        description: `Details for ${data.name} have been saved.`,
      });
    }
  };

  const isBusinessUser = user.role === 'Business';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <Label>Full Name</Label>
              <FormControl>
                <Input {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <Label>Email</Label>
              <FormControl>
                <Input type="email" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <Label>Role</Label>
              <Select onValueChange={field.onChange} defaultValue={field.value as UserRole} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Public(जनता)">Public(जनता)</SelectItem>
                  <SelectItem value="Gorakshak">Gorakshak</SelectItem>
                  <SelectItem value="Gorakshak Admin">Gorakshak Admin</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <Label>Status</Label>
              <Select onValueChange={field.onChange} defaultValue={field.value as UserStatus} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  {isBusinessUser && <SelectItem value="verified">Verified</SelectItem>}
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || !form.formState.isDirty}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </form>
    </Form>
  );
};

export default UserEditForm;
