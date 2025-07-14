
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface AdminTableControlsProps {
  searchPlaceholder?: string;
  createAction?: React.ReactNode;
  currentPage?: number;
  totalPages?: number;
  showSearch?: boolean;
}

export default function AdminTableControls({
  searchPlaceholder,
  currentPage,
  totalPages,
  showSearch = true,
}: AdminTableControlsProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (term) {
      params.set('query', term);
    } else {
      params.delete('query');
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);
  
  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  const isPaginationVisible = currentPage !== undefined && totalPages !== undefined && totalPages > 1;

  return (
    <div className="flex items-center justify-between gap-2">
      {showSearch && searchPlaceholder && (
        <div className="relative flex-1 md:grow-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
            onChange={(e) => handleSearch(e.target.value)}
            defaultValue={searchParams.get('query')?.toString()}
          />
        </div>
      )}

      {isPaginationVisible && (
        <div className="flex items-center gap-2 ml-auto">
            <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => replace(createPageURL(currentPage - 1))}
            >
                Previous
            </Button>
            <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
            </span>
            <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => replace(createPageURL(currentPage + 1))}
            >
                Next
            </Button>
        </div>
      )}
    </div>
  );
}
