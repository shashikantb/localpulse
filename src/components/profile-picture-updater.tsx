
'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, XCircle } from 'lucide-react';
import { updateUserProfilePicture } from '@/app/auth/actions';

export default function ProfilePictureUpdater() {
  const router = useRouter();
  const { toast } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setPreview(null);
    setFile(null);
    setIsResizing(false);

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, etc.).');
      return;
    }

    setIsResizing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 512;
        const MAX_HEIGHT = 512;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Could not process image.');
          setIsResizing(false);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // Use JPEG with 85% quality
        setPreview(dataUrl);
        setFile(selectedFile);
        setIsResizing(false);
      };
      img.onerror = () => {
        setError('Could not load the selected image file.');
        setIsResizing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setError('Failed to read the selected file.');
      setIsResizing(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleRemoveImage = () => {
    setPreview(null);
    setFile(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || !preview) {
      setError('Please select an image to upload.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('profilePicture', preview);

      const result = await updateUserProfilePicture(formData);

      if (result.success) {
        toast({
          title: 'Success!',
          description: 'Your profile picture has been updated.',
        });
        router.refresh();
      } else {
        setError(result.error || 'An unexpected error occurred.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected server error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isProcessing = isResizing || isSubmitting;
  let buttonText = 'Save Changes';
  if (isSubmitting) buttonText = 'Saving...';
  if (isResizing) buttonText = 'Processing...';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Upload Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <label
          htmlFor="profile-picture-input"
          className="block w-full cursor-pointer p-6 border-2 border-dashed rounded-lg text-center hover:border-primary hover:bg-muted"
        >
          {preview ? (
            <div className="relative group w-32 h-32 mx-auto">
              <Image
                src={preview}
                alt="Profile preview"
                className="rounded-full object-cover"
                fill
                sizes="128px"
              />
              <div
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(ev) => { ev.preventDefault(); handleRemoveImage(); }}
              >
                <XCircle className="h-8 w-8 text-white" />
              </div>
            </div>
          ) : isResizing ? (
            <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin" />
                <span>Resizing Image...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2 text-muted-foreground">
              <UploadCloud className="h-10 w-10" />
              <span>Click to upload or drag & drop</span>
              <span className="text-xs">PNG, JPG, GIF will be resized</span>
            </div>
          )}
        </label>
        <Input
          id="profile-picture-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
      </div>

      <Button type="submit" disabled={!file || isProcessing} className="w-full">
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {buttonText}
      </Button>
    </form>
  );
}
