
'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { searchUsers } from '@/app/actions';
import type { User } from '@/lib/db-types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import FamilyActionButton from './family-action-button';

interface AddFamilyMemberSearchProps {
  sessionUser: User;
}

const AddFamilyMemberSearch: React.FC<AddFamilyMemberSearchProps> = ({ sessionUser }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearching(true);
      try {
        const users = await searchUsers(query, sessionUser.id);
        setResults(users);
      } catch (error) {
        console.error('Failed to search for users:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, sessionUser.id]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Add New Family Member</h3>
        <p className="text-sm text-muted-foreground">Search for users by name to send a family request.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
        {isSearching && (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Searching...
          </div>
        )}
        {!isSearching && results.map((user) => (
          <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm">{user.name}</span>
            </div>
            <FamilyActionButton
              initialStatus="none"
              targetUserId={user.id}
            />
          </div>
        ))}
        {!isSearching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-center text-sm text-muted-foreground p-4">No users found matching your search.</p>
        )}
      </div>
    </div>
  );
};

export default AddFamilyMemberSearch;
