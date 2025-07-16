'use client';

import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  color: string;
  setColor: (color: string) => void;
  children: React.ReactNode;
}

export function ColorPicker({ color, setColor, children }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal h-10 w-full',
            !color && 'text-muted-foreground'
          )}
        >
          <div className="flex w-full items-center gap-2">
            {color ? (
              <div
                className="h-4 w-4 rounded !bg-center !bg-cover transition-all"
                style={{ background: color }}
              />
            ) : (
              children
            )}
            <div className="flex-1 truncate">{color ? color : 'Select a color'}</div>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-0">
        <HexColorPicker color={color} onChange={setColor} />
      </PopoverContent>
    </Popover>
  );
}
