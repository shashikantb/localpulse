
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, CalendarDays, Code } from 'lucide-react'; // Removed Film icon
import { recordVisitAndGetCounts, getCurrentVisitorCounts } from '@/app/actions';
import type { VisitorCounts } from '@/lib/db-types';

const Footer: FC = () => {
  const [visitorCounts, setVisitorCounts] = useState<VisitorCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      setIsLoadingCounts(true);
      try {
        const sessionVisitRecorded = sessionStorage.getItem('sessionVisitRecorded_localpulse');
        let counts: VisitorCounts;
        if (!sessionVisitRecorded) {
          counts = await recordVisitAndGetCounts();
          sessionStorage.setItem('sessionVisitRecorded_localpulse', 'true');
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

    fetchCounts();
  }, []);

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
           {/* Removed Reels link from here */}
        </div>
        <p className="text-xs text-muted-foreground/80 flex items-center justify-center">
          <Code className="w-4 h-4 mr-1.5 text-primary/70" />
          Developed by S. P. Borgavakar
        </p>
      </div>
    </footer>
  );
};

export default Footer;
