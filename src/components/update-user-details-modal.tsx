
'use client';

import React, { useState, useEffect } from 'react';
import type { User } from '@/lib/db-types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

  const needsMobile = !user.mobilenumber;
  const needsCategory = user.role === 'Business' && !user.business_category;

  useEffect(() => {
    // This effect now correctly sets the dialog to open or closed
    // based on the user prop it receives from the server.
    setIsOpen(needsMobile || needsCategory);
  }, [user, needsMobile, needsCategory]);

  const handleUpdate = () => {
    // After an update, the server action revalidates the path.
    // The parent page will re-render, passing new props to this component.
    // The useEffect above will then run again with the new props and close the dialog
    // automatically if the update conditions (needsMobile, needsCategory) are now false.
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen}>
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
                <UpdateMobileForm onUpdate={handleUpdate} />
            </div>
          )}
          {needsCategory && !needsMobile && ( // Show category form only if mobile is already filled
            <div className='space-y-3'>
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Business Category Required</AlertTitle>
                    <AlertDescription>
                        Please select a category for your business.
                    </AlertDescription>
                </Alert>
                <UpdateBusinessCategoryForm onUpdate={handleUpdate} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateUserDetailsModal;
