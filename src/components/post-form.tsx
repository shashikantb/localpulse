import type { FC } from 'react';
import { useState, useRef, useCallback } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image'; // Import next/image
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input'; // Import Input
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Paperclip, XCircle } from 'lucide-react'; // Use Loader2 for loading state, Paperclip for attach
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';


const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const formSchema = z.object({
  content: z.string().min(1, "Post cannot be empty").max(280, "Post cannot exceed 280 characters"),
  // File input is handled separately
});

type FormData = z.infer<typeof formSchema>;

interface PostFormProps {
  onSubmit: (content: string, mediaUrl?: string, mediaType?: 'image' | 'video') => Promise<void>;
  submitting: boolean;
}

export const PostForm: FC<PostFormProps> = ({ onSubmit, submitting }) => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
    },
  });

   const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setPreviewUrl(null); // Clear previous preview
      setSelectedFile(null);
      setMediaType(null);
      setFileError(null);


      if (file) {
          if (file.size > MAX_FILE_SIZE) {
              setFileError(`File size exceeds the limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input visually
              return;
          }

          const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;

          if (!type) {
              setFileError('Invalid file type. Please select an image or video.');
              setSelectedFile(null);
               if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input visually
              return;
          }


          setIsProcessingFile(true);
          const reader = new FileReader();
          reader.onloadend = () => {
              setPreviewUrl(reader.result as string);
              setSelectedFile(file);
              setMediaType(type);
              setIsProcessingFile(false);
          };
          reader.onerror = () => {
              setFileError('Error reading file.');
              setSelectedFile(null);
              setPreviewUrl(null);
              setMediaType(null);
              setIsProcessingFile(false);
               if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input visually
          };
          reader.readAsDataURL(file);
      }
   }, []);

  const removeMedia = () => {
      setSelectedFile(null);
      setPreviewUrl(null);
      setMediaType(null);
      setFileError(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Clear the actual file input
      }
  };

  const handleSubmit: SubmitHandler<FormData> = async (data) => {
      if (submitting || isProcessingFile) return; // Prevent double submission

      if (fileError) {
        toast({
          variant: 'destructive',
          title: 'File Error',
          description: fileError,
        });
        return;
      }

      // Pass previewUrl (Data URL) and mediaType if a file was processed
      await onSubmit(data.content, previewUrl ?? undefined, mediaType ?? undefined);

      // Reset form and file state after successful submission
      form.reset();
      removeMedia();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="post-content" className="sr-only">What's happening?</FormLabel>
              <FormControl>
                <Textarea
                  id="post-content"
                  placeholder="What's happening around you?"
                  className="resize-none"
                  rows={3}
                  {...field}
                  disabled={submitting || isProcessingFile}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* File Input and Preview Area */}
        <FormItem>
          <FormLabel htmlFor="media-upload" className="sr-only">Attach Image/Video</FormLabel>
          <div className="flex items-center space-x-2">
             <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting || isProcessingFile || !!selectedFile}
                aria-label="Attach media"
             >
                 <Paperclip className="h-4 w-4" />
             </Button>
             <FormControl>
                 <Input
                    id="media-upload"
                    type="file"
                    accept="image/*,video/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden" // Hide the default input, trigger with button
                    disabled={submitting || isProcessingFile}
                 />
             </FormControl>
             <span className="text-sm text-muted-foreground flex-1 truncate">
                {selectedFile ? selectedFile.name : 'Attach image or video (Max 5MB)'}
             </span>
              {isProcessingFile && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
               {selectedFile && !isProcessingFile && (
                 <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeMedia}
                    disabled={submitting}
                    className="text-destructive hover:text-destructive/80"
                    aria-label="Remove media"
                 >
                    <XCircle className="h-4 w-4" />
                 </Button>
               )}
          </div>
           {fileError && (
             <Alert variant="destructive" className="mt-2 p-2 text-sm">
                 <AlertDescription>{fileError}</AlertDescription>
             </Alert>
           )}
           {previewUrl && mediaType === 'image' && (
             <div className="mt-2 relative w-full h-48 overflow-hidden rounded-md border">
                 <Image src={previewUrl} alt="Preview" layout="fill" objectFit="cover" />
             </div>
            )}
            {previewUrl && mediaType === 'video' && (
                <div className="mt-2">
                    <video controls src={previewUrl} className="w-full max-h-48 rounded-md border" />
                </div>
            )}
        </FormItem>


        <Button type="submit" disabled={submitting || isProcessingFile} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Posting...
            </>
          ) : isProcessingFile ? (
            <>
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Media...
            </>
          ) : (

            'Post Nearby'
          )}
        </Button>
      </form>
    </Form>
  );
};
