
'use client';

import type { FC } from 'react';
import React, { useState, useCallback } from 'react';
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
import { Loader2, XCircle, UploadCloud, Film, Image as ImageIcon, Tag, ChevronDown, Camera, User, Search, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { searchUsers, getSignedUploadUrl } from '@/app/actions';
import type { User as UserType } from '@/lib/db-types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

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
  const [isUploading, setIsUploading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [showCameraOptions, setShowCameraOptions] = React.useState(false);
  
  const [isTaggingDialogOpen, setIsTaggingDialogOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [mentionResults, setMentionResults] = React.useState<UserType[]>([]);
  const [taggedUsers, setTaggedUsers] = React.useState<UserType[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

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

  const removeMedia = useCallback(() => {
      if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setMediaType(null);
      setFileError(null);
      setShowCameraOptions(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageCaptureInputRef.current) imageCaptureInputRef.current.value = '';
      if (videoCaptureInputRef.current) videoCaptureInputRef.current.value = '';
  }, [previewUrl]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      removeMedia();
      const file = event.target.files?.[0];
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
      
      setSelectedFile(file);
      setMediaType(currentFileType);
      setPreviewUrl(URL.createObjectURL(file));

   }, [removeMedia]);

  
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

      if (fileError) {
        toast({ variant: 'destructive', title: 'File Error', description: fileError });
        return;
      }
      
      const mentionedUserIds = taggedUsers.map(user => user.id);
      const hashtagsToSubmit = data.hashtags || [];

      if (selectedFile && mediaType) {
        setIsUploading(true);
        try {
          const signedUrlResult = await getSignedUploadUrl(selectedFile.name, selectedFile.type);

          if (!signedUrlResult.success || !signedUrlResult.uploadUrl || !signedUrlResult.publicUrl) {
            throw new Error(signedUrlResult.error || 'Could not prepare file for upload.');
          }

          const uploadResult = await fetch(signedUrlResult.uploadUrl, {
            method: 'PUT',
            body: selectedFile,
            headers: { 'Content-Type': selectedFile.type },
          });

          if (!uploadResult.ok) {
            const errorBody = await uploadResult.text();
            console.error("GCS Upload Error:", { 
              status: uploadResult.status,
              statusText: uploadResult.statusText,
              body: errorBody 
            });
            throw new Error(`Upload failed with status ${uploadResult.status}. Check the browser console for details.`);
          }

          await onSubmit(data.content, hashtagsToSubmit, signedUrlResult.publicUrl, mediaType, mentionedUserIds);

        } catch (error: any) {
          console.error("A critical error occurred during the upload process:", error);
          toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
          return; // Stop form submission on upload failure
        } finally {
          setIsUploading(false);
        }
      } else {
        await onSubmit(data.content, hashtagsToSubmit, undefined, undefined, mentionedUserIds);
      }
      
      form.reset();
      removeMedia();
      setTaggedUsers([]);
  };

  const isButtonDisabled = submitting || isUploading;

  let buttonText = 'Share Your Pulse';
  if (isUploading) buttonText = 'Uploading File...';
  else if (submitting) buttonText = 'Pulsing...';

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
            </div>
          )}
          {fileError && (
            <Alert variant="destructive" className="mt-2 p-2 text-sm">
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}
        </FormItem>
        
        {isUploading && <Progress value={100} className="w-full h-2 animate-pulse" />}

        <Button type="submit" disabled={isButtonDisabled || !form.formState.isValid} className="w-full text-base py-3 shadow-md hover:shadow-lg transition-shadow bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg">
          {(isUploading || submitting) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {buttonText}
        </Button>
      </form>
    </Form>
  );
};

    