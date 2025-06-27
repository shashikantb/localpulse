
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

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

export default function ProfilePictureUpdater() {
  const router = useRouter();
  const { toast } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(`File size cannot exceed ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        return;
      }
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }

      setError(null);
      setFile(selectedFile);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
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
                onClick={(e) => { e.preventDefault(); handleRemoveImage(); }}
              >
                <XCircle className="h-8 w-8 text-white" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2 text-muted-foreground">
              <UploadCloud className="h-10 w-10" />
              <span>Click to upload or drag & drop</span>
              <span className="text-xs">PNG, JPG, GIF up to 4MB</span>
            </div>
          )}
        </label>
        <Input
          id="profile-picture-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={!file || isSubmitting} className="w-full">
        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Save Changes'}
      </Button>
    </form>
  );
}
