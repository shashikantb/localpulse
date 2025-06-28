
'use client';

import type { FC } from 'react';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Loader2, XCircle, UploadCloud, Film, Image as ImageIcon, Tag, ChevronDown, Camera, UserPlus, Search, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { searchUsers } from '@/app/actions';
import type { User } from '@/lib/db-types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';


const MAX_VIDEO_UPLOAD_LIMIT = 50 * 1024 * 1024; // 50MB
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
  onSubmit: (content: string, hashtags: string[], mediaUrl?: string, mediaType?: 'image' | 'video', mentionedUserIds?: number[]) => Promise<void>;
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

  // State for mentions/tagging
  const [isMentionDialogOpen, setIsMentionDialogOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
      removeMedia();

      if (!file) return;

      const currentFileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;

      if (!currentFileType) {
          setFileError('Invalid file type. Please select an image or video.');
          return;
      }

      if (currentFileType === 'image' && file.size > MAX_IMAGE_UPLOAD_LIMIT) {
        setFileError(`Image is too large. Max size: ${Math.round(MAX_IMAGE_UPLOAD_LIMIT / 1024 / 1024)}MB.`);
        return;
      }
      if (currentFileType === 'video' && file.size > MAX_VIDEO_UPLOAD_LIMIT) {
        setFileError(`Video is too large. Max size: ${Math.round(MAX_VIDEO_UPLOAD_LIMIT / 1024 / 1024)}MB.`);
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
   }, []);

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
      const mentionedUserIds = taggedUsers.map(u => u.id);
      
      await onSubmit(data.content, hashtagsToSubmit, previewUrl ?? undefined, mediaType ?? undefined, mentionedUserIds);

      form.reset();
      removeMedia();
      setTaggedUsers([]);
  };

  // Debounced search for user mentions
  useEffect(() => {
    if (mentionSearch.length < 2) {
      setMentionResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchUsers(mentionSearch);
      const existingIds = new Set(taggedUsers.map(u => u.id));
      setMentionResults(results.filter(r => !existingIds.has(r.id)));
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [mentionSearch, taggedUsers]);

  const addTaggedUser = (user: User) => {
    setTaggedUsers(prev => [...prev, user]);
    setMentionSearch('');
    setMentionResults([]);
  };

  const removeTaggedUser = (userId: number) => {
    setTaggedUsers(prev => prev.filter(u => u.id !== userId));
  };


  const isButtonDisabled = submitting || isReadingFile;

  let buttonText = 'Share Your Pulse';
  if (isReadingFile) buttonText = 'Processing File...';
  else if (submitting) buttonText = 'Pulsing...';

  return (
    <>
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
                  placeholder="Share your local pulse... Mention others using @"
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

            <Dialog open={isMentionDialogOpen} onOpenChange={setIsMentionDialogOpen}>
              <DialogTrigger asChild>
                 <Button variant="outline" className="w-full justify-between" disabled={isButtonDisabled}>
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-primary" />
                    <span>Tag People ({taggedUsers.length})</span>
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                      <DialogTitle>Tag People</DialogTitle>
                      <DialogDescription>Search for users and tag them in your post. They will be notified.</DialogDescription>
                  </DialogHeader>
                  <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                          placeholder="Search for a user..."
                          className="pl-8"
                          value={mentionSearch}
                          onChange={(e) => setMentionSearch(e.target.value)}
                      />
                  </div>
                  
                  <ScrollArea className="h-64 border rounded-md">
                      <div className="p-2">
                          {isSearching && <p className="text-sm text-center text-muted-foreground p-4">Searching...</p>}
                          {!isSearching && mentionResults.length === 0 && mentionSearch.length > 1 && <p className="text-sm text-center text-muted-foreground p-4">No users found.</p>}
                          
                          {taggedUsers.length > 0 && (
                            <>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-1">Tagged</h4>
                                {taggedUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8"><AvatarImage src={user.profilepictureurl || undefined} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                        <span className="text-sm font-medium">{user.name}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeTaggedUser(user.id)}><XCircle className="w-4 h-4" /></Button>
                                </div>
                                ))}
                                <hr className="my-2" />
                            </>
                          )}

                          {mentionResults.length > 0 && <h4 className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-1">Search Results</h4>}
                          {mentionResults.map(user => (
                              <div key={user.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                                  <div className="flex items-center gap-2">
                                      <Avatar className="h-8 w-8"><AvatarImage src={user.profilepictureurl || undefined} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                      <span className="text-sm font-medium">{user.name}</span>
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => addTaggedUser(user)}>Tag</Button>
                              </div>
                          ))}
                      </div>
                  </ScrollArea>

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
    </>
  );
};
