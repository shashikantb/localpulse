
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
import { Loader2, XCircle, UploadCloud, Film, Image as ImageIcon, Tag, ChevronDown, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_IMAGE_SIZE_BEFORE_COMPRESSION = 15 * 1024 * 1024; // 15MB


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
  const [fileError, setFileError] = useState<string | null>(null);
  const [showCameraOptions, setShowCameraOptions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageCaptureInputRef = useRef<HTMLInputElement>(null);
  const videoCaptureInputRef = useRef<HTMLInputElement>(null);

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
      setShowCameraOptions(false);

      if (!file) return;

      const currentFileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;

      if (!currentFileType) {
          setFileError('Invalid file type. Please select an image or video.');
          if (event.target) event.target.value = '';
          return;
      }
      
      if (currentFileType === 'video' && file.size > MAX_VIDEO_SIZE) {
        setFileError(`Video file is too large. Max size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB.`);
        if (event.target) event.target.value = '';
        return;
      }
      
      if (currentFileType === 'image' && file.size > MAX_IMAGE_SIZE_BEFORE_COMPRESSION) {
          setFileError(`Image file is too large. Max size: ${MAX_IMAGE_SIZE_BEFORE_COMPRESSION / 1024 / 1024}MB.`);
          if (event.target) event.target.value = '';
          return;
      }


      setIsReadingFile(true);
      setSelectedFile(file);
      setMediaType(currentFileType);

      const reader = new FileReader();
      reader.onerror = () => {
          setFileError('Error reading file.');
          setIsReadingFile(false);
          if (event.target) event.target.value = '';
      };
      
      if (currentFileType === 'image') {
        reader.onload = (loadEvent) => {
            const img = document.createElement('img');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1920;
                const MAX_HEIGHT = 1080;
                let { width, height } = img;

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
                    setFileError('Could not process image.');
                    setIsReadingFile(false);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // Compress to JPEG
                setPreviewUrl(dataUrl);
                setIsReadingFile(false);
            };
            img.onerror = () => {
                setFileError('Could not load image to process.');
                setIsReadingFile(false);
            };
            img.src = loadEvent.target?.result as string;
        };
      } else { // It's a video
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
            setIsReadingFile(false);
        };
      }
      reader.readAsDataURL(file);
   }, [toast]);

  const removeMedia = () => {
      setSelectedFile(null);
      setPreviewUrl(null);
      setMediaType(null);
      setFileError(null);
      setIsReadingFile(false);
      // Reset all file inputs
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageCaptureInputRef.current) imageCaptureInputRef.current.value = '';
      if (videoCaptureInputRef.current) videoCaptureInputRef.current.value = '';
  };

  const handleSubmitForm: SubmitHandler<FormData> = async (data) => {
      if (submitting || isReadingFile) return;

      if (fileError) {
        toast({
          variant: 'destructive',
          title: 'File Error',
          description: fileError,
        });
        return;
      }
      const hashtagsToSubmit = data.hashtags || [];
      await onSubmit(data.content, hashtagsToSubmit, previewUrl ?? undefined, mediaType ?? undefined);

      form.reset();
      removeMedia();
  };

  const isButtonDisabled = submitting || isReadingFile;

  let buttonText = 'Share Your Pulse';
  if (isReadingFile) {
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
          
            <>
              <Input id="file-upload" type="file" accept="image/*,video/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isButtonDisabled} />
              <Input id="image-capture" type="file" accept="image/*" capture="environment" ref={imageCaptureInputRef} onChange={handleFileChange} className="hidden" disabled={isButtonDisabled} />
              <Input id="video-capture" type="file" accept="video/*" capture="environment" ref={videoCaptureInputRef} onChange={handleFileChange} className="hidden" disabled={isButtonDisabled} />
            </>
          
          {previewUrl && selectedFile ? (
            <div className="w-full text-center p-4 border-2 border-dashed rounded-lg border-primary/50">
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
          ) : (
            <div className="p-4 border-2 border-dashed rounded-lg">
              <div className={cn("grid gap-2", showCameraOptions ? "grid-cols-1" : "grid-cols-2")}>
                {!showCameraOptions && (
                  <>
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isButtonDisabled}>
                      <UploadCloud className="mr-2 h-4 w-4" /> Upload File
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowCameraOptions(true)} disabled={isButtonDisabled}>
                      <Camera className="mr-2 h-4 w-4" /> Use Camera
                    </Button>
                  </>
                )}
                {showCameraOptions && (
                  <div className="space-y-2 text-center">
                    <p className="text-sm text-muted-foreground">Choose a capture option:</p>
                    <div className="grid grid-cols-2 gap-2">
                       <Button type="button" variant="secondary" onClick={() => imageCaptureInputRef.current?.click()} disabled={isButtonDisabled}>
                          <ImageIcon className="mr-2 h-4 w-4" /> Take Photo
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => videoCaptureInputRef.current?.click()} disabled={isButtonDisabled}>
                          <Film className="mr-2 h-4 w-4" /> Record Video
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowCameraOptions(false)} disabled={isButtonDisabled}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              {isReadingFile && (
                <div className="flex flex-col items-center text-muted-foreground py-4">
                  <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
                  <p className="text-sm">Processing file...</p>
                </div>
              )}
            </div>
          )}
          {fileError && (
            <Alert variant="destructive" className="mt-2 p-2 text-sm">
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}
        </FormItem>


        <Button type="submit" disabled={isButtonDisabled || !form.formState.isValid} className="w-full text-base py-3 shadow-md hover:shadow-lg transition-shadow bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg">
          {isButtonDisabled && !(submitting && !isReadingFile) ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : null}
          {buttonText}
        </Button>
      </form>
    </Form>
  );
};
