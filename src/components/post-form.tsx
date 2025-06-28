'use client';

import type { FC } from 'react';
import { useState, useRef, useCallback } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import Script from 'next/script'; // Import Script component
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
import { Loader2, XCircle, UploadCloud, Film, Image as ImageIcon, Tag, ChevronDown, Camera, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


const MAX_VIDEO_UPLOAD_LIMIT = 50 * 1024 * 1024; // 50MB (Hard limit)
const MAX_VIDEO_FOR_TRIM = 25 * 1024 * 1024; // 25MB (Trigger for trimmer)
const MAX_IMAGE_UPLOAD_LIMIT = 15 * 1024 * 1024; // 15MB


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
  hashtags: z.array(z.string()),
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
  // State to manage FFmpeg script loading
  const [ffmpegScriptLoaded, setFfmpegScriptLoaded] = useState(false);
  const [ffmpegScriptError, setFfmpegScriptError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageCaptureInputRef = useRef<HTMLInputElement>(null);
  const videoCaptureInputRef = useRef<HTMLInputElement>(null);

  // State for video trimmer
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [videoToTrim, setVideoToTrim] = useState<{ file: File; url: string } | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [trimStartTime, setTrimStartTime] = useState(0);
  const [trimDuration, setTrimDuration] = useState(30);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimmerError, setTrimmerError] = useState<string | null>(null);
  const ffmpegRef = useRef<any>(null);


  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
      hashtags: [],
    },
  });

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) {
      return ffmpegRef.current;
    }
    // @ts-ignore
    if (typeof window === 'undefined' || !window.FFmpeg) {
      throw new Error('FFmpeg library is not available.');
    }
    
    // @ts-ignore
    const { createFFmpeg } = window.FFmpeg;
    const ffmpegInstance = createFFmpeg({
      corePath: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      log: true,
    });
    
    if (!ffmpegInstance.isLoaded()) {
      await ffmpegInstance.load();
    }
    ffmpegRef.current = ffmpegInstance;
    return ffmpegRef.current;
  }, []);

   const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      removeMedia();

      if (!file) return;

      const currentFileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;

      if (!currentFileType) {
          setFileError('Invalid file type. Please select an image or video.');
          return;
      }

      if (currentFileType === 'image' && file.size > MAX_IMAGE_UPLOAD_LIMIT) {
        setFileError(`Image is too large. Max size: ${MAX_IMAGE_UPLOAD_LIMIT / 1024 / 1024}MB.`);
        return;
      }
      if (currentFileType === 'video' && file.size > MAX_VIDEO_UPLOAD_LIMIT) {
        setFileError(`Video is too large. Max size: ${MAX_VIDEO_UPLOAD_LIMIT / 1024 / 1024}MB.`);
        return;
      }

      // Check if video is large enough to require trimming
      if (currentFileType === 'video' && file.size > MAX_VIDEO_FOR_TRIM) {
          if (ffmpegScriptError) {
              toast({
                  variant: 'destructive',
                  title: 'Trimmer Unavailable',
                  description: 'The video processing library failed to load. Please refresh the page or use a smaller video file.',
              });
              return;
          }
          const url = URL.createObjectURL(file);
          setVideoToTrim({ file, url });
          setShowTrimmer(true);
          setVideoDuration(0); // Reset duration for new video
          setTrimmerError(null); // Reset error
          return;
      }
      
      setIsReadingFile(true);
      setSelectedFile(file);
      setMediaType(currentFileType);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
        setIsReadingFile(false);
      };
      reader.onerror = () => {
          setFileError('Error reading file.');
          setIsReadingFile(false);
      };
      reader.readAsDataURL(file);
   }, [ffmpegScriptError, toast]);

  const removeMedia = () => {
      setSelectedFile(null);
      setPreviewUrl(null);
      setMediaType(null);
      setFileError(null);
      setIsReadingFile(false);
      setShowCameraOptions(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageCaptureInputRef.current) imageCaptureInputRef.current.value = '';
      if (videoCaptureInputRef.current) videoCaptureInputRef.current.value = '';
  };
  
  const handleSubmitForm: SubmitHandler<FormData> = async (data) => {
      if (submitting || isReadingFile) return;

      if (fileError) {
        toast({ variant: 'destructive', title: 'File Error', description: fileError });
        return;
      }
      const hashtagsToSubmit = data.hashtags || [];
      await onSubmit(data.content, hashtagsToSubmit, previewUrl ?? undefined, mediaType ?? undefined);

      form.reset();
      removeMedia();
  };

  const handleTrim = async () => {
    if (!videoToTrim || isTrimming) return;

    setIsTrimming(true);
    setTrimProgress(0);
    setTrimmerError(null);

    try {
        const ffmpeg = await loadFFmpeg();

        // Convert the file to a format FFmpeg can read
        const arrayBuffer = await videoToTrim.file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        ffmpeg.FS('writeFile', videoToTrim.file.name, uint8Array);

        // Listen for progress events
        ffmpeg.setProgress(({ ratio } : {ratio: number}) => {
            setTrimProgress(Math.min(100, Math.round(ratio * 100)));
        });

        // Run the FFmpeg command
        const outputFileName = `trimmed-${Date.now()}.mp4`;
        await ffmpeg.run(
            '-ss', trimStartTime.toString(),
            '-i', videoToTrim.file.name,
            '-t', trimDuration.toString(),
            // Using '-c copy' is faster as it avoids re-encoding
            '-c', 'copy',
            outputFileName
        );
        
        // Read the trimmed file from FFmpeg's virtual file system
        const data = ffmpeg.FS('readFile', outputFileName);
        const trimmedFile = new File([data.buffer], outputFileName, { type: 'video/mp4' });

        // Update the state with the new trimmed video
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
            setSelectedFile(trimmedFile);
            setMediaType('video');
            setShowTrimmer(false);
            setVideoToTrim(null);
            setIsTrimming(false);
        };
        reader.readAsDataURL(trimmedFile);

    } catch (error: any) {
        console.error("Error during video trimming:", error);
        setTrimmerError(error.message || 'An unknown error occurred during trimming. Please try a different browser or file.');
        setIsTrimming(false);
    }
  };

  const isButtonDisabled = submitting || isReadingFile;

  let buttonText = 'Share Your Pulse';
  if (isReadingFile) buttonText = 'Processing File...';
  else if (submitting) buttonText = 'Pulsing...';

  // Determine trim button text based on loading state
  let trimButtonText = 'Trim & Use Video';
  if (isTrimming) trimButtonText = 'Trimming...';
  else if (!ffmpegScriptLoaded) trimButtonText = 'Library Loading...';


  return (
    <>
    {/* Use Next.js Script component for safer, non-blocking loading */}
    <Script
        src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js"
        strategy="lazyOnload" // Load after other resources
        onLoad={() => {
            console.log("FFmpeg script loaded successfully.");
            setFfmpegScriptLoaded(true);
        }}
        onError={() => {
            console.error("Error: Failed to load the FFmpeg script.");
            setFfmpegScriptError(true);
        }}
    />
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
                  <Image src={previewUrl} alt="Preview" fill style={{objectFit: "cover"}} data-ai-hint="user uploaded image"/>
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
          {(isReadingFile || submitting) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {buttonText}
        </Button>
      </form>
    </Form>

    <Dialog open={showTrimmer} onOpenChange={(open) => { if (!open) { setShowTrimmer(false); setVideoToTrim(null); }}}>
        <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Trim Your Video</DialogTitle>
                <DialogDescription>
                    Your video is large. Please select a clip up to 60 seconds to upload.
                </DialogDescription>
            </DialogHeader>
            
            {trimmerError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Trimming Error</AlertTitle>
                <AlertDescription>{trimmerError}</AlertDescription>
              </Alert>
            )}

            {videoToTrim && (
                <div className="space-y-4">
                    <video ref={videoRef} src={videoToTrim.url} controls className="w-full rounded-md bg-black" onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)} />

                    {videoDuration > 0 && !trimmerError && (
                        <div className="space-y-4">
                            <div>
                                <Label>Start Time: {new Date(trimStartTime * 1000).toISOString().substring(14, 19)}</Label>
                                <Slider
                                    min={0}
                                    max={Math.max(0, videoDuration - trimDuration)}
                                    step={1}
                                    value={[trimStartTime]}
                                    onValueChange={(val) => {
                                      setTrimStartTime(val[0]);
                                      if(videoRef.current) videoRef.current.currentTime = val[0];
                                    }}
                                />
                            </div>
                            <div>
                                <Label>Clip Duration</Label>
                                <RadioGroup defaultValue="30" onValueChange={(val) => setTrimDuration(parseInt(val))} className="flex space-x-4 pt-2">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="30" id="r1" /><Label htmlFor="r1">30 seconds</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="60" id="r2" disabled={videoDuration < 60} /><Label htmlFor="r2">60 seconds</Label></div>
                                </RadioGroup>
                            </div>
                        </div>
                    )}
                    {isTrimming && (
                        <div className="space-y-2 pt-2">
                            <Label>Trimming Progress: {trimProgress}%</Label>
                            <Progress value={trimProgress} />
                            <p className="text-xs text-muted-foreground">This may take a moment. Please keep this tab open.</p>
                        </div>
                    )}
                </div>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => { setShowTrimmer(false); setVideoToTrim(null); }} disabled={isTrimming}>Cancel</Button>
                <Button onClick={handleTrim} disabled={isTrimming || videoDuration === 0 || !!trimmerError || !ffmpegScriptLoaded}>
                    {(isTrimming || !ffmpegScriptLoaded) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {trimButtonText}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
};
