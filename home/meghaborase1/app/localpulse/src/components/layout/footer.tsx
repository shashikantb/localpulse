
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { Code, Shield } from 'lucide-react';

const Footer: FC = () => {
  return (
    <footer className="py-6 text-center text-sm text-muted-foreground bg-gradient-to-t from-background to-muted/20 border-t border-border/70 shadow-inner mt-auto hidden sm:block"> {/* Hide footer on small screens */}
      <div className="container mx-auto px-4">
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
