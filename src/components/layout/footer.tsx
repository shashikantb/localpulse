
'use client';

import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Users, CalendarDays, Code, Shield } from 'lucide-react';
import { recordVisitAndGetCounts, getCurrentVisitorCounts } from '@/app/actions';
import type { VisitorCounts } from '@/lib/db-types';

const Footer: FC = () => {
  const [visitorCounts, setVisitorCounts] = useState<VisitorCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  // Use a ref to track session storage status to avoid stale closures in event handlers.
  const visitRecordedRef = useRef(typeof window !== 'undefined' && sessionStorage.getItem('sessionVisitRecorded_localpulse') === 'true');

  useEffect(() => {
    const fetchAndSetCounts = async () => {
      // Don't do anything if we are already loading or the tab is hidden
      if (isLoadingCounts || document.hidden) return;

      setIsLoadingCounts(true);
      try {
        let counts: VisitorCounts;
        // The logic to only record once per session
        if (!visitRecordedRef.current) {
          counts = await recordVisitAndGetCounts();
          sessionStorage.setItem('sessionVisitRecorded_localpulse', 'true');
          visitRecordedRef.current = true;
        } else {
          counts = await getCurrentVisitorCounts();
        }
        setVisitorCounts(counts);
      } catch (error) {
        console.error("Error fetching visitor counts:", error);
        setVisitorCounts({ totalVisits: 0, dailyVisits: 0 });
      } finally {
        setIsLoadingCounts(false);
      }
    };
    
    // This handler will run on initial load and when the tab becomes visible again
    const handleActivity = () => {
        if (!document.hidden) {
            fetchAndSetCounts();
        }
    };

    // We also listen to pageshow to handle bfcache restoration
    const handlePageShow = (event: PageTransitionEvent) => {
        if (event.persisted) {
            // Page was restored from bfcache, refetch counts to ensure they're up-to-date
            visitRecordedRef.current = sessionStorage.getItem('sessionVisitRecorded_localpulse') === 'true'; // re-sync ref
            handleActivity();
        }
    }

    handleActivity(); // Initial fetch

    window.addEventListener('visibilitychange', handleActivity);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('visibilitychange', handleActivity);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isLoadingCounts]);


  return (
    <footer className="py-6 text-center text-sm text-muted-foreground bg-gradient-to-t from-background to-muted/20 border-t border-border/70 shadow-inner mt-auto hidden sm:block"> {/* Hide footer on small screens */}
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-center items-center space-y-3 sm:space-y-0 sm:space-x-6 mb-4 text-base">
          {isLoadingCounts ? (
            <>
              <span className="flex items-center opacity-50"><Users className="w-5 h-5 mr-2 animate-pulse" /> Loading stats...</span>
            </>
          ) : visitorCounts ? (
            <>
              <span className="flex items-center" title="Total site visits">
                <Users className="w-5 h-5 mr-2 text-primary" />
                Total: {visitorCounts.totalVisits.toLocaleString()}
              </span>
              <span className="hidden sm:inline text-muted-foreground/50">|</span>
              <span className="flex items-center" title="Visits today">
                <CalendarDays className="w-5 h-5 mr-2 text-accent" />
                Today: {visitorCounts.dailyVisits.toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-destructive">Could not load visitor stats.</span>
          )}
        </div>
        <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground/80">
          <span className="flex items-center">
            <Code className="w-4 h-4 mr-1.5 text-primary/70" />
            Developed by S. P. Borgavakar
          </span>
          <span className="text-muted-foreground/50">|</span>
          <Link href="/privacy-policy" className="flex items-center hover:text-primary transition-colors">
            <Shield className="w-4 h-4 mr-1.5 text-primary/70" />
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
