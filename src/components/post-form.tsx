
'use client';

import type { FC } from 'react';
import React, from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Loader2, XCircle, UploadCloud, Film, Image as ImageIcon, Tag, ChevronDown, Camera, User, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { searchUsers } from '@/app/actions';
import type { User as UserType } from '@/lib/db-types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';
import NextScript from "next/script";


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
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [mediaType, setMediaType] = React.useState<'image' | 'video' | null>(null);
  const [isReadingFile, setIsReadingFile] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [showCameraOptions, setShowCameraOptions] = React.useState(false);

  // --- Start: State for inline mentions ---
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [isMentionPopoverOpen, setIsMentionPopoverOpen] = React.useState(false);
  const [mentionResults, setMentionResults] = React.useState<UserType[]>([]);
  const [taggedUsers, setTaggedUsers] = React.useState<UserType[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  // --- End: State for inline mentions ---

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageCaptureInputRef = React.useRef<HTMLInputElement>(null);
  const videoCaptureInputRef = React.useRef<HTMLInputElement>(null);


  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
      hashtags: [],
    },
  });

   const handleFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      removeMedia();

      if (!file) return;

      const currentFileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
      setFileError(null);

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

  // --- Start: Inline Mention Logic ---

  // Debounced search for user mentions
  React.useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }
    // Don't search for short queries
    if(mentionQuery.length < 1) {
        setMentionResults([]);
        setIsMentionPopoverOpen(true); // Keep open to show "keep typing"
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
  
  const handleMentionSelect = (user: UserType) => {
      const currentContent = form.getValues('content');
      const cursorPosition = textareaRef.current?.selectionStart || currentContent.length;
      
      const textBeforeCursor = currentContent.substring(0, cursorPosition);
      const textAfterCursor = currentContent.substring(cursorPosition);

      // Replace the partial mention (e.g., @joh) with the full username
      const newTextBefore = textBeforeCursor.replace(/@(\S+)$/, `@${user.name} `);

      form.setValue('content', newTextBefore + textAfterCursor, { shouldDirty: true });
      addTaggedUser(user);
      setIsMentionPopoverOpen(false);
      setMentionQuery(null);
      
      // Use timeout to focus and set cursor position after the DOM has updated
      setTimeout(() => {
          textareaRef.current?.focus();
          const newCursorPosition = newTextBefore.length;
          textareaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>, fieldOnChange: (...event: any[]) => void) => {
      const text = e.target.value;
      const cursorPosition = e.target.selectionStart;

      const textBeforeCursor = text.substring(0, cursorPosition);
      const mentionMatch = textBeforeCursor.match(/(?:^|\s)@(\S*)$/);

      if (mentionMatch) {
          const query = mentionMatch[1];
          setMentionQuery(query);
          setIsMentionPopoverOpen(true);
      } else {
          setIsMentionPopoverOpen(false);
          setMentionQuery(null);
      }
      
      fieldOnChange(text);
  };
  // --- End: Inline Mention Logic ---


  const isButtonDisabled = submitting || isReadingFile;

  let buttonText = 'Share Your Pulse';
  if (isReadingFile) buttonText = 'Processing File...';
  else if (submitting) buttonText = 'Pulsing...';

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-6">
        
        <Popover open={isMentionPopoverOpen} onOpenChange={setIsMentionPopoverOpen}>
          <PopoverAnchor asChild>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="post-content" className="sr-only">What's happening?</FormLabel>
                  <FormControl>
                    <Textarea
                      id="post-content"
                      ref={textareaRef}
                      placeholder="Share your local pulse... Mention others using @"
                      className="resize-none min-h-[100px] text-base shadow-sm focus:ring-2 focus:ring-primary/50 rounded-lg"
                      rows={4}
                      {...field}
                      onChange={(e) => handleContentChange(e, field.onChange)}
                      disabled={isButtonDisabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </PopoverAnchor>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
              <ScrollArea className="h-auto max-h-64">
                {isSearching && <div className="p-2 text-sm text-center text-muted-foreground">Searching...</div>}
                {!isSearching && mentionQuery && mentionResults.length === 0 && <div className="p-2 text-sm text-center text-muted-foreground">No users found.</div>}
                {!isSearching && mentionQuery === '' && <div className="p-2 text-sm text-center text-muted-foreground">Keep typing to search for users...</div>}
                {!isSearching && mentionResults.map(user => (
                   <button
                        key={user.id}
                        type="button"
                        onClick={() => handleMentionSelect(user)}
                        className="w-full flex items-center gap-2 p-2 rounded-md text-left hover:bg-muted"
                    >
                      <Avatar className="h-8 w-8"><AvatarImage src={user.profilepictureurl || undefined} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                      <span className="text-sm font-medium">{user.name}</span>
                   </button>
                ))}
              </ScrollArea>
          </PopoverContent>
        </Popover>

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
            {/* The second button placeholder */}
             <div />
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
