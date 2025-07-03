'use client';

import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const themes = [
    { name: 'light', label: 'Light', icon: Sun },
    { name: 'dark', label: 'Dark', icon: Moon },
    { name: 'colorful', label: 'Colorful', icon: Palette },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2">
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
  );
}
