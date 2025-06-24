
import type { FC } from 'react';
import { useState, useRef, useCallback } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Loader2, Paperclip, XCircle, UploadCloud, Film, Image as ImageIcon, Settings2, Tag, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB - Temporarily reduced to match server default until server config is fixed.
const VIDEO_OPTIMIZATION_THRESHOLD = 500 * 1024; // 0.5MB

export const HASHTAG_CATEGORIES = [
  {
    name: 'General Purpose',
    hashtags: ['#LocalPulse', '#CommunityBuzz', '#YourCityNow', '#LiveUpdates', '#StayInformed'],
  },
  {
    name: 'News & Alerts',
    hashtags: ['#BreakingNews', '#LocalNews', '#CityAlerts', '#NewsFlash', '#CommunityNews'],
  },
  {
    name: 'Events & Happenings',
    hashtags: ['#LocalEvents', '#WhatsHappening', '#CityVibes', '#WeekendPlans', '#LocalFestivals'],
  },
  {
    name: 'Information & Updates',
    hashtags: ['#PublicInfo', '#LocalUpdates', '#KnowYourCity', '#NeighborhoodWatch', '#InfoHub'],
  },
  {
    name: 'Community & Culture',
    hashtags: ['#PeopleOfOurCity', '#LocalVoices', '#SupportLocal', '#CityCulture', '#OurCommunity'],
  },
  {
    name: 'Local Business',
    hashtags: ['#ShopLocal', '#SupportSmallBiz', '#LocalMarket', '#CityDeals'],
  },
];

const formSchema = z.object({
  content: z.string().min(1, "Post cannot be empty").max(280, "Post cannot exceed 280 characters"),
  hashtags: z.array(z.string()), // Hashtags are now optional (empty array is valid)
});

type FormData = z.infer<typeof formSchema>;

interface PostFormProps {
  onSubmit: (content: string, hashtags: string[], mediaUrl?: string, mediaType?: 'image' | 'video') => Promise<void>;
  submitting: boolean;
}

export const PostForm: FC<PostFormProps> = ({ onSubmit, submitting }) => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isOptimizingVideo, setIsOptimizingVideo] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
      hashtags: [],
    },
  });

   const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setPreviewUrl(null);
      setSelectedFile(null);
      setMediaType(null);
      setFileError(null);
      setIsReadingFile(false);
      setIsOptimizingVideo(false);

      if (file) {
          if (file.size > MAX_FILE_SIZE) {
              setFileError(`File is too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              return;
          }

          const currentFileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;

          if (!currentFileType) {
              setFileError('Invalid file type. Please select an image or video.');
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              return;
          }

          setIsReadingFile(true);
          let  shouldOptimizeThisFile = false;

          if (currentFileType === 'video' && file.size > VIDEO_OPTIMIZATION_THRESHOLD) {
              shouldOptimizeThisFile = true;
              setIsOptimizingVideo(true);
              toast({
                  title: "Optimizing Video",
                  description: "Larger videos are being prepared. This might take a moment. Actual size reduction is a planned feature.",
                  duration: 4000,
              });
          }

          const reader = new FileReader();
          reader.onloadend = () => {
              setPreviewUrl(reader.result as string);
              setSelectedFile(file);
              setMediaType(currentFileType);
              setIsReadingFile(false);

              if (shouldOptimizeThisFile) {
                  setIsOptimizingVideo(false);
                  toast({
                      title: "Video Ready",
                      description: "Video is now ready to be included in your post.",
                      duration: 3000,
                  });
              }
          };
          reader.onerror = () => {
              setFileError('Error reading file.');
              setSelectedFile(null);
              setPreviewUrl(null);
              setMediaType(null);
              setIsReadingFile(false);
              setIsOptimizingVideo(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          };
          reader.readAsDataURL(file);
      }
   }, [toast]);

  const removeMedia = () => {
      setSelectedFile(null);
      setPreviewUrl(null);
      setMediaType(null);
      setFileError(null);
      setIsReadingFile(false);
      setIsOptimizingVideo(false);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  const handleSubmitForm: SubmitHandler<FormData> = async (data) => {
      if (submitting || isReadingFile || isOptimizingVideo) return;

      if (fileError) {
        toast({
          variant: 'destructive',
          title: 'File Error',
          description: fileError,
        });
        return;
      }
      // Ensure hashtags is an array, even if undefined from optional schema field
      const hashtagsToSubmit = data.hashtags || [];
      await onSubmit(data.content, hashtagsToSubmit, previewUrl ?? undefined, mediaType ?? undefined);

      form.reset();
      removeMedia();
  };

  const isButtonDisabled = submitting || isReadingFile || isOptimizingVideo;

  let buttonText = 'Share Your Pulse';
  if (isOptimizingVideo) {
    buttonText = 'Optimizing Video...';
  } else if (isReadingFile) {
    buttonText = 'Processing File...';
  } else if (submitting) {
    buttonText = 'Pulsing...';
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-6">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="post-content" className="sr-only">What's happening?</FormLabel>
              <FormControl>
                <Textarea
                  id="post-content"
                  placeholder="Share your local pulse..."
                  className="resize-none min-h-[100px] text-base shadow-sm focus:ring-2 focus:ring-primary/50 rounded-lg"
                  rows={4}
                  {...field}
                  disabled={isButtonDisabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="hashtags"
          render={({ field }) => (
            <FormItem>
              <div className="mb-2">
                <FormLabel className="text-base font-semibold text-foreground flex items-center">
                  <Tag className="w-5 h-5 mr-2 text-primary" />
                  Select Hashtags (Optional)
                </FormLabel>
                <p className="text-sm text-muted-foreground">Optionally, choose relevant tags for your pulse.</p>
              </div>
              <FormControl>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" disabled={isButtonDisabled}>
                      <span>Select Hashtags ({field.value?.length || 0} selected)</span>
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[calc(var(--radix-dropdown-menu-trigger-width))] max-h-80 overflow-y-auto">
                    {HASHTAG_CATEGORIES.map((category) => (
                      <DropdownMenuGroup key={category.name}>
                        <DropdownMenuLabel>{category.name}</DropdownMenuLabel>
                        {category.hashtags.map((tag) => (
                          <DropdownMenuCheckboxItem
                            key={tag}
                            checked={field.value?.includes(tag)}
                            onCheckedChange={(checked) => {
                              const currentTags = field.value || [];
                              const newTags = checked
                                ? [...currentTags, tag]
                                : currentTags.filter(
                                    (value) => value !== tag
                                  );
                              field.onChange(newTags);
                            }}
                            disabled={isButtonDisabled}
                          >
                            {tag}
                          </DropdownMenuCheckboxItem>
                        ))}
                        {HASHTAG_CATEGORIES.indexOf(category) < HASHTAG_CATEGORIES.length - 1 && <DropdownMenuSeparator />}
                      </DropdownMenuGroup>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        <FormItem>
          <FormLabel htmlFor="media-upload" className="text-sm font-medium text-muted-foreground mb-1 block">
            Attach Media (Optional)
          </FormLabel>
          <div className={cn(
            "relative flex flex-col items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/70 transition-colors",
            selectedFile ? "border-primary/50" : "border-border",
            isButtonDisabled ? "opacity-70 cursor-not-allowed" : ""
          )}
            onClick={() => !isButtonDisabled && fileInputRef.current?.click()}
          >
            <FormControl>
              <Input
                id="media-upload"
                type="file"
                accept="image/*,video/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                disabled={isButtonDisabled}
              />
            </FormControl>

            {!selectedFile && !isReadingFile && !isOptimizingVideo && (
              <div className="text-center">
                <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground/80">Image or Video (Max {MAX_FILE_SIZE / 1024 / 1024}MB)</p>
              </div>
            )}

            {(isReadingFile || isOptimizingVideo) && (
              <div className="flex flex-col items-center text-muted-foreground py-4">
                <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
                <p className="text-sm">{isOptimizingVideo ? 'Optimizing video...' : 'Reading file...'}</p>
              </div>
            )}

            {selectedFile && !isReadingFile && !isOptimizingVideo && previewUrl && (
              <div className="w-full text-center">
                {mediaType === 'image' && (
                  <div className="relative w-full max-w-xs mx-auto aspect-video overflow-hidden rounded-md border shadow-md mb-2 bg-muted">
                    <Image src={previewUrl} alt="Preview" fill objectFit="cover" data-ai-hint="user uploaded image"/>
                  </div>
                )}
                {mediaType === 'video' && (
                  <div className="relative w-full max-w-xs mx-auto aspect-video overflow-hidden rounded-md border shadow-md mb-2 bg-black">
                    <video controls src={previewUrl} className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="flex items-center justify-center space-x-2 text-sm text-foreground bg-background/70 p-1 rounded-md">
                  {mediaType === 'image' ? <ImageIcon className="h-4 w-4 text-primary" /> : <Film className="h-4 w-4 text-primary" />}
                  <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                   <span className="text-xs text-muted-foreground">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); removeMedia(); }}
                    disabled={submitting}
                    className="text-destructive hover:text-destructive/80 h-6 w-6 ml-auto"
                    aria-label="Remove media"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          {fileError && (
            <Alert variant="destructive" className="mt-2 p-2 text-sm">
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}
        </FormItem>

        <Button type="submit" disabled={isButtonDisabled || !form.formState.isValid} className="w-full text-base py-3 shadow-md hover:shadow-lg transition-shadow bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg">
          {isButtonDisabled && !(submitting && !isReadingFile && !isOptimizingVideo) ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : null}
          {buttonText}
        </Button>
      </form>
    </Form>
  );
};
