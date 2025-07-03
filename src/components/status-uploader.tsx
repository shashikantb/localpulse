
'use client';

import { useState, type ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, XCircle } from 'lucide-react';
import { addStatus, getSignedUploadUrl } from '@/app/actions';
import { Progress } from './ui/progress';

export default function StatusUploader({ onUploadComplete }: { onUploadComplete: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setPreview(null);
    setFile(null);
    setMediaType(null);

    if (!selectedFile) return;

    const fileType = selectedFile.type.startsWith('image/') ? 'image' : selectedFile.type.startsWith('video/') ? 'video' : null;

    if (!fileType) {
      setError('Please select a valid image or video file.');
      return;
    }

    const maxSize = fileType === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for videos
    if (selectedFile.size > maxSize) {
      setError(`${fileType === 'image' ? 'Image' : 'Video'} is too large. Max size is ${maxSize / 1024 / 1024}MB.`);
      return;
    }

    setFile(selectedFile);
    setMediaType(fileType);
    setPreview(URL.createObjectURL(selectedFile));
  };
  
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  const handleRemoveMedia = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setMediaType(null);
    const input = document.getElementById('status-media-input') as HTMLInputElement;
    if (input) input.value = '';
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || !mediaType) {
      setError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const signedUrlResult = await getSignedUploadUrl(file.name, file.type);
      if (!signedUrlResult.success || !signedUrlResult.uploadUrl || !signedUrlResult.publicUrl) {
        throw new Error(signedUrlResult.error || 'Could not prepare file for upload.');
      }
      
      const uploadResult = await fetch(signedUrlResult.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadResult.ok) throw new Error('Upload to cloud storage failed.');

      const result = await addStatus(signedUrlResult.publicUrl, mediaType);

      if (result.success) {
        toast({ title: 'Success!', description: 'Your status has been posted.' });
        onUploadComplete();
        router.refresh(); // This ensures the status feed re-fetches data
      } else {
        throw new Error(result.error || 'An unexpected error occurred while saving the status.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert variant="destructive"><AlertTitle>Upload Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div>
        <label
          htmlFor="status-media-input"
          className="block w-full cursor-pointer p-6 border-2 border-dashed rounded-lg text-center hover:border-primary hover:bg-muted"
        >
          {preview ? (
            <div className="relative group w-48 h-80 mx-auto bg-black rounded-lg">
              {mediaType === 'image' && <Image src={preview} alt="Status preview" className="rounded-lg object-contain" fill sizes="320px" data-ai-hint="user status" />}
              {mediaType === 'video' && <video src={preview} className="w-full h-full object-contain rounded-lg" autoPlay muted loop />}
              <button
                type="button"
                className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full shadow-md z-10"
                onClick={(ev) => { ev.preventDefault(); handleRemoveMedia(); }}
                aria-label="Remove media"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2 text-muted-foreground">
              <UploadCloud className="h-10 w-10" />
              <span>Click to upload Status</span>
              <span className="text-xs">Image or Video (expires in 24h)</span>
            </div>
          )}
        </label>
        <Input id="status-media-input" type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
      </div>
      {isUploading && <Progress value={100} className="w-full h-2 animate-pulse" />}
      <Button type="submit" disabled={!file || isUploading} className="w-full">
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isUploading ? 'Uploading...' : 'Post Status'}
      </Button>
    </form>
  );
}
