
'use client';

import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Palette, Paintbrush } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ColorPicker } from './color-picker';
import { cn } from '@/lib/utils';

// Helper to check if a string is a valid hex color
const isHexColor = (hex: string) => /^#[0-9A-F]{6}$/i.test(hex);

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // State for user-selected colors
  const [primaryColor, setPrimaryColor] = useState('#8B5CF6'); // Default purple
  const [accentColor, setAccentColor] = useState('#EC4899'); // Default pink
  
  // Load saved colors from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedPrimary = localStorage.getItem('colorful-primary');
    const savedAccent = localStorage.getItem('colorful-accent');
    if (savedPrimary && isHexColor(savedPrimary)) {
      setPrimaryColor(savedPrimary);
    }
    if (savedAccent && isHexColor(savedAccent)) {
      setAccentColor(savedAccent);
    }
  }, []);

  // Apply colors and save to localStorage when they change
  useEffect(() => {
    if (mounted && isHexColor(primaryColor) && isHexColor(accentColor)) {
      document.documentElement.style.setProperty('--primary-colorful', primaryColor);
      document.documentElement.style.setProperty('--accent-colorful', accentColor);
      localStorage.setItem('colorful-primary', primaryColor);
      localStorage.setItem('colorful-accent', accentColor);
    }
  }, [primaryColor, accentColor, mounted]);


  if (!mounted) {
    return (
      <div className="flex h-10 items-center gap-2">
        <div className="h-full w-full animate-pulse rounded-md bg-muted" />
        <div className="h-full w-full animate-pulse rounded-md bg-muted" />
        <div className="h-full w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  const themes = [
    { name: 'light', label: 'Light', icon: Sun },
    { name: 'dark', label: 'Dark', icon: Moon },
    { name: 'colorful', label: 'Colorful', icon: Palette },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {themes.map((t) => (
          <Button
            key={t.name}
            variant={theme === t.name ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTheme(t.name)}
            className="w-full"
          >
            <t.icon className="mr-2 h-4 w-4" />
            {t.label}
          </Button>
        ))}
      </div>
      {theme === 'colorful' && (
        <div className="space-y-3 rounded-lg border bg-background/50 p-4 pt-3 transition-all animate-in fade-in-50">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center">
            <Paintbrush className="mr-2 h-4 w-4"/>
            Customize Colors
          </h4>
          <div className="grid grid-cols-2 gap-3">
             <ColorPicker color={primaryColor} setColor={setPrimaryColor}>
                Primary
             </ColorPicker>
             <ColorPicker color={accentColor} setColor={setAccentColor}>
                Accent
             </ColorPicker>
          </div>
        </div>
      )}
    </div>
  );
}
