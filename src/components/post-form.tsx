
'use client';

import type { FC } from 'react';
import React from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2, X, UploadCloud, Film, Image as ImageIcon, Tag, ChevronDown, Camera, User, Search, UserPlus, Video, XCircle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { searchUsers, getSignedUploadUrl } from '@/app/actions';
import type { User as UserType } from '@/lib/db-types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Checkbox } from './ui/checkbox';

const MAX_IMAGE_COUNT = 5;
const MAX_VIDEO_UPLOAD_LIMIT = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_UPLOAD_LIMIT = 10 * 1024 * 1024; // 10MB


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
  content: z.string().min(1, "Post cannot be empty").max(1000, "Post cannot exceed 1000 characters"),
  hashtags: z.array(z.string()),
  isFamilyPost: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

interface PostFormProps {
  onSubmit: (content: string, hashtags: string[], isFamilyPost: boolean, mediaUrls?: string[], mediaType?: 'image' | 'video' | 'gallery', mentionedUserIds?: number[]) => Promise<void>;
  submitting: boolean;
  sessionUser: UserType | null;
}

interface FilePreview {
    file: File;
    url: string;
}

export const PostForm: FC<PostFormProps> = ({ onSubmit, submitting, sessionUser }) => {
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = React.useState<FilePreview[]>([]);
  const [mediaType, setMediaType] = React.useState<'image' | 'video' | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [showCameraOptions, setShowCameraOptions] = React.useState(false);
  
  const [isTaggingDialogOpen, setIsTaggingDialogOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [mentionResults, setMentionResults] = React.useState<UserType[]>([]);
  const [taggedUsers, setTaggedUsers] = React.useState<UserType[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const [hasDetectedUrl, setHasDetectedUrl] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageCaptureInputRef = React.useRef<HTMLInputElement>(null);
  const videoCaptureInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
      hashtags: [],
      isFamilyPost: false,
    },
  });

  const contentValue = form.watch('content');
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/;

  React.useEffect(() => {
    setHasDetectedUrl(youtubeRegex.test(contentValue));
  }, [contentValue, youtubeRegex]);

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles(currentFiles => {
      const fileToRemove = currentFiles[indexToRemove];
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      const newFiles = currentFiles.filter((_, i) => i !== indexToRemove);
      if (newFiles.length === 0) {
        setMediaType(null);
      }
      return newFiles;
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);

    const files = event.target.files;
    if (!files || files.length === 0) {
        setSelectedFiles(prev => {
            prev.forEach(f => URL.revokeObjectURL(f.url));
            return [];
        });
        setMediaType(null);
        return;
    }
    
    const firstFile = files[0];
    const currentFileType = firstFile.type.startsWith('image/') ? 'image' : firstFile.type.startsWith('video/') ? 'video' : null;

    if (!currentFileType) {
        setFileError('Invalid file type. Please select an image or video.');
        event.target.value = '';
        return;
    }

    if (currentFileType === 'video' && files.length > 1) {
        setFileError('You can only upload one video at a time.');
        event.target.value = '';
        return;
    }
    
    if (currentFileType === 'image' && files.length > MAX_IMAGE_COUNT) {
        setFileError(`You can select a maximum of ${MAX_IMAGE_COUNT} images.`);
        event.target.value = '';
        return;
    }

    const newPreviews: FilePreview[] = [];
    for (const file of Array.from(files)) {
        if (currentFileType === 'image' && file.size > MAX_IMAGE_UPLOAD_LIMIT) {
            setFileError(`Image "${file.name}" is too large. Max size: ${Math.round(MAX_IMAGE_UPLOAD_LIMIT / 1024 / 1024)}MB.`);
            event.target.value = '';
            newPreviews.forEach(p => URL.revokeObjectURL(p.url));
            return;
        }
        if (currentFileType === 'video' && file.size > MAX_VIDEO_UPLOAD_LIMIT) {
            setFileError(`Video is too large. Max size: ${Math.round(MAX_VIDEO_UPLOAD_LIMIT / 1024 / 1024)}MB.`);
            event.target.value = '';
            newPreviews.forEach(p => URL.revokeObjectURL(p.url));
            return;
        }
        newPreviews.push({ file: file, url: URL.createObjectURL(file) });
    }

    setSelectedFiles(prevFiles => {
      prevFiles.forEach(f => URL.revokeObjectURL(f.url));
      return newPreviews;
    });
    setMediaType(currentFileType);
  };
  
  React.useEffect(() => {
    if (!mentionQuery) {
        setMentionResults([]);
        return;
    }

    const handler = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchUsers(mentionQuery);
      const existingIds = new Set(taggedUsers.map(u => u.id));
      setMentionResults(results.filter(r => !existingIds.has(r.id)));
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [mentionQuery, taggedUsers]);

  const addTaggedUser = (user: UserType) => {
    setTaggedUsers(prev => [...prev, user]);
  };

  const removeTaggedUser = (userId: number) => {
    setTaggedUsers(prev => prev.filter(u => u.id !== userId));
  };
  
  const handleSubmitForm: SubmitHandler<FormData> = async (data) => {
      if (submitting || isUploading) return;

      if (hasDetectedUrl && selectedFiles.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Media Conflict',
          description: "A YouTube link was detected. You can't upload a separate file at the same time.",
        });
        return;
      }
      
      if (fileError) {
        toast({ variant: 'destructive', title: 'File Error', description: fileError });
        return;
      }
      
      const mentionedUserIds = taggedUsers.map(user => user.id);
      const hashtagsToSubmit = data.hashtags || [];

      if (selectedFiles.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);

        try {
          const uploadPromises = selectedFiles.map(async (filePreview) => {
            const signedUrlResult = await getSignedUploadUrl(filePreview.file.name, filePreview.file.type);
            if (!signedUrlResult.success || !signedUrlResult.uploadUrl || !signedUrlResult.publicUrl) {
                throw new Error(signedUrlResult.error || `Could not prepare ${filePreview.file.name} for upload.`);
            }
            const uploadResult = await fetch(signedUrlResult.uploadUrl, {
                method: 'PUT',
                body: filePreview.file,
                headers: { 'Content-Type': filePreview.file.type },
            });
            if (!uploadResult.ok) {
                throw new Error(`Upload failed for ${filePreview.file.name}.`);
            }
            setUploadProgress(p => p + 1);
            return signedUrlResult.publicUrl;
          });

          const uploadedUrls = await Promise.all(uploadPromises);
          
          let finalMediaType: 'image' | 'video' | 'gallery' | undefined = undefined;
          if (uploadedUrls.length > 0) {
              if (mediaType === 'video') finalMediaType = 'video';
              else if (mediaType === 'image' && uploadedUrls.length > 1) finalMediaType = 'gallery';
              else if (mediaType === 'image') finalMediaType = 'image';
          }

          await onSubmit(data.content, hashtagsToSubmit, data.isFamilyPost, uploadedUrls, finalMediaType, mentionedUserIds);

        } catch (error: any) {
          console.error("A critical error occurred during the upload process:", error);
          toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
          return;
        } finally {
          setIsUploading(false);
        }
      } else {
        await onSubmit(data.content, hashtagsToSubmit, data.isFamilyPost, undefined, undefined, mentionedUserIds);
      }
      
      form.reset();
      setSelectedFiles(prev => {
        prev.forEach(f => URL.revokeObjectURL(f.url));
        return [];
      });
      setMediaType(null);
      setTaggedUsers([]);
  };

  const isButtonDisabled = submitting || isUploading;
  let buttonText = 'Share Your Pulse';
  if (isUploading) buttonText = `Uploading ${uploadProgress} / ${selectedFiles.length}...`;
  else if (submitting) buttonText = 'Pulsing...';

  const isMediaUploadDisabled = submitting || isUploading || hasDetectedUrl;


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
                  placeholder="Share your local pulse, or paste a YouTube link..."
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
        
        {hasDetectedUrl && (
          <Alert variant="default" className="p-2 border-primary/30 bg-primary/5 text-primary">
            <Video className="h-4 w-4" />
            <AlertDescription className="text-xs font-semibold">
              YouTube link detected! This will be attached as video media. File uploads are disabled.
            </AlertDescription>
          </Alert>
        )}

        {taggedUsers.length > 0 && (
          <div className="space-y-2">
            <FormLabel className="text-xs text-muted-foreground">Tagged Users:</FormLabel>
            <div className="flex flex-wrap gap-2">
              {taggedUsers.map(user => (
                <Badge key={user.id} variant="secondary" className="pl-1 pr-2 py-1">
                  <Avatar className="h-5 w-5 mr-2">
                    <AvatarImage src={user.profilepictureurl || undefined} />
                    <AvatarFallback className="text-[10px]">{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {user.name}
                  <button type="button" onClick={() => removeTaggedUser(user.id)} className="ml-1.5 rounded-full hover:bg-background/70">
                    <XCircle className="h-3 w-3"/>
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="hashtags"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between" disabled={isButtonDisabled}>
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-primary" />
                            <span>Hashtags ({field.value?.length || 0})</span>
                          </div>
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[calc(var(--radix-dropdown-menu-trigger-width))] max-h-80 overflow-y-auto">
                        {HASHTAG_CATEGORIES.map((category, catIndex) => (
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
                            {catIndex < HASHTAG_CATEGORIES.length - 1 && <DropdownMenuSeparator />}
                          </DropdownMenuGroup>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Dialog open={isTaggingDialogOpen} onOpenChange={setIsTaggingDialogOpen}>
                <DialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={isButtonDisabled}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Tag People ({taggedUsers.length})
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Tag People</DialogTitle>
                        <DialogDescription>
                            Search for people to mention in your pulse. They will be notified.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input 
                                placeholder="Search for users..." 
                                className="pl-10"
                                value={mentionQuery}
                                onChange={(e) => setMentionQuery(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="h-48 border rounded-md">
                            {isSearching ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
                            ) : mentionResults.length > 0 ? (
                                <div className="p-1">
                                    {mentionResults.map(user => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => addTaggedUser(user)}
                                            className="w-full flex items-center gap-2 p-2 rounded-md text-left hover:bg-muted"
                                        >
                                            <Avatar className="h-8 w-8"><AvatarImage src={user.profilepictureurl || undefined} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                            <span className="text-sm font-medium">{user.name}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    {mentionQuery ? "No users found." : "Type to search."}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button">Done</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>

        <FormItem>
          <FormLabel htmlFor="media-upload" className="text-sm font-medium text-muted-foreground mb-1 block">
            Attach Media (Optional)
          </FormLabel>
            <>
              <Input id="file-upload" type="file" accept="image/*,video/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isMediaUploadDisabled} multiple />
              <Input id="image-capture" type="file" accept="image/*" capture="environment" ref={imageCaptureInputRef} onChange={handleFileChange} className="hidden" disabled={isMediaUploadDisabled} />
              <Input id="video-capture" type="file" accept="video/*" capture="environment" ref={videoCaptureInputRef} onChange={handleFileChange} className="hidden" disabled={isMediaUploadDisabled} />
            </>
          
          {selectedFiles.length > 0 ? (
            <div className="w-full p-2 border-2 border-dashed rounded-lg border-primary/50 space-y-2">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {selectedFiles.map((f, i) => (
                        <div key={f.url} className="relative aspect-square group">
                            {mediaType === 'image' && <Image src={f.url} alt={`Preview ${i+1}`} fill sizes="10vw" className="object-cover rounded-md" data-ai-hint="user uploaded image"/>}
                            {mediaType === 'video' && <video src={f.url} className="w-full h-full object-cover rounded-md bg-black" />}
                            <Button type="button" variant="destructive" size="icon" onClick={() => removeSelectedFile(i)} className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
                 <Button type="button" variant="ghost" size="sm" onClick={(e) => {
                     e.preventDefault();
                     setSelectedFiles(prev => {
                       prev.forEach(f => URL.revokeObjectURL(f.url));
                       return [];
                     });
                     setMediaType(null);
                     if (fileInputRef.current) fileInputRef.current.value = "";
                 }} className="w-full text-destructive">
                    <XCircle className="mr-2 h-4 w-4" /> Clear All
                </Button>
            </div>
          ) : (
            <div className="p-4 border-2 border-dashed rounded-lg">
              <div className={cn("grid gap-2", showCameraOptions ? "grid-cols-1" : "grid-cols-2")}>
                {!showCameraOptions && (
                  <>
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isMediaUploadDisabled}>
                      <UploadCloud className="mr-2 h-4 w-4" /> Upload File(s)
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowCameraOptions(true)} disabled={isMediaUploadDisabled}>
                      <Camera className="mr-2 h-4 w-4" /> Use Camera
                    </Button>
                  </>
                )}
                {showCameraOptions && (
                  <div className="space-y-2 text-center">
                    <p className="text-sm text-muted-foreground">Choose a capture option:</p>
                    <div className="grid grid-cols-2 gap-2">
                       <Button type="button" variant="secondary" onClick={() => imageCaptureInputRef.current?.click()} disabled={isMediaUploadDisabled}>
                          <ImageIcon className="mr-2 h-4 w-4" /> Take Photo
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => videoCaptureInputRef.current?.click()} disabled={isMediaUploadDisabled}>
                          <Film className="mr-2 h-4 w-4" /> Record Video
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowCameraOptions(false)} disabled={isMediaUploadDisabled}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {fileError && (
            <Alert variant="destructive" className="mt-2 p-2 text-sm">
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}
        </FormItem>
        
        {sessionUser && (
            <FormField
              control={form.control}
              name="isFamilyPost"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-muted/50">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isButtonDisabled}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="flex items-center">
                        <Users className="mr-2 h-4 w-4 text-primary" />
                        Family Post
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Only approved family members will see this post.
                    </p>
                  </div>
                </FormItem>
              )}
            />
        )}

        {isUploading && <Progress value={(uploadProgress / selectedFiles.length) * 100} className="w-full h-2" />}

        <Button type="submit" disabled={isButtonDisabled || !form.formState.isValid} className="w-full text-base py-3 shadow-md hover:shadow-lg transition-shadow bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg">
          {(isUploading || submitting) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {buttonText}
        </Button>
      </form>
    </Form>
  );
};
