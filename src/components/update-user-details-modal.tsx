
'use client';

import React, { useState, useEffect } from 'react';
import type { User } from '@/lib/db-types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from '@/components/ui/dialog';
import UpdateMobileForm from './update-mobile-form';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { Info } from 'lucide-react';
import UpdateBusinessCategoryForm from './update-business-category-form';

interface UpdateUserDetailsModalProps {
  user: User;
}

const UpdateUserDetailsModal: React.FC<UpdateUserDetailsModalProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Determine if the modal should be shown
    const needsMobile = !user.mobilenumber;
    const needsCategory = user.role === 'Business' && !user.business_category;
    if (needsMobile || needsCategory) {
      setIsOpen(true);
    }
  }, [user]);

  const needsMobile = !user.mobilenumber;
  const needsCategory = user.role === 'Business' && !user.business_category;
  
  // Don't render anything if the modal is not open
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Please provide some additional information to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          {needsMobile && (
            <div className='space-y-3'>
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Mobile Number Required</AlertTitle>
                    <AlertDescription>
                        Please enter your 10-digit mobile number.
                    </AlertDescription>
                </Alert>
                <UpdateMobileForm onUpdate={() => {
                  // If only mobile was needed, close modal. Otherwise, wait for category.
                  if (!needsCategory) setIsOpen(false);
                  // Refreshing the page is handled by the form's server action
                }}/>
            </div>
          )}
          {needsCategory && (
            <div className='space-y-3'>
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Business Category Required</AlertTitle>
                    <AlertDescription>
                        Please select a category for your business.
                    </AlertDescription>
                </Alert>
                <UpdateBusinessCategoryForm onUpdate={() => setIsOpen(false)}/>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateUserDetailsModal;
