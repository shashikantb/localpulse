
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Users, CalendarDays } from 'lucide-react';
import { recordVisitAndGetCounts, getCurrentVisitorCounts } from '@/app/actions';
import type { VisitorCounts } from '@/lib/db';

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
        // Set to null or default so UI doesn't break
        setVisitorCounts({ totalVisits: 0, dailyVisits: 0 }); 
      } finally {
        setIsLoadingCounts(false);
      }
    };

    fetchCounts();
  }, []);

  return (
    <footer className="py-6 text-center text-sm text-muted-foreground bg-background border-t border-border/70 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-6 mb-3">
          {isLoadingCounts ? (
            <>
              <span className="flex items-center"><Users className="w-4 h-4 mr-1.5 animate-pulse" /> Loading stats...</span>
            </>
          ) : visitorCounts ? (
            <>
              <span className="flex items-center" title="Total site visits">
                <Users className="w-4 h-4 mr-1.5 text-primary" />
                Total Visitors: {visitorCounts.totalVisits.toLocaleString()}
              </span>
              <span className="hidden sm:inline">|</span>
              <span className="flex items-center" title="Visits today">
                <CalendarDays className="w-4 h-4 mr-1.5 text-accent" />
                Today's Visitors: {visitorCounts.dailyVisits.toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-destructive">Could not load visitor stats.</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/80">Developed by S. P. Borgavakar</p>
      </div>
    </footer>
  );
};

export default Footer;
