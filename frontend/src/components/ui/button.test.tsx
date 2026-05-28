import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './button';

describe('Button component', () => {
    it('renders children text correctly', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('applies default variant classes', () => {
        render(<Button>Default</Button>);
        const btn = screen.getByRole('button', { name: /default/i });
        expect(btn).toHaveClass('bg-primary');
        expect(btn).toHaveClass('text-primary-foreground');
    });

    it('applies destructive variant classes', () => {
        render(<Button variant="destructive">Delete</Button>);
        const btn = screen.getByRole('button', { name: /delete/i });
        expect(btn).toHaveClass('bg-destructive');
        expect(btn).toHaveClass('text-destructive-foreground');
    });

    it('applies outline variant classes', () => {
        render(<Button variant="outline">Outline</Button>);
        const btn = screen.getByRole('button', { name: /outline/i });
        expect(btn).toHaveClass('border');
        expect(btn).toHaveClass('border-input');
    });

    it('applies size variants correctly', () => {
        render(<Button size="sm">Small</Button>);
        const btn = screen.getByRole('button', { name: /small/i });
        expect(btn).toHaveClass('h-9');
        expect(btn).toHaveClass('px-3');
    });

    it('applies icon size variant', () => {
        render(<Button size="icon" aria-label="icon-btn">★</Button>);
        const btn = screen.getByRole('button', { name: /icon-btn/i });
        expect(btn).toHaveClass('h-10');
        expect(btn).toHaveClass('w-10');
    });

    it('fires click handler on interaction', () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Press</Button>);
        fireEvent.click(screen.getByRole('button', { name: /press/i }));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not fire click when disabled', () => {
        const handleClick = vi.fn();
        render(<Button disabled onClick={handleClick}>Disabled</Button>);
        const btn = screen.getByRole('button', { name: /disabled/i });
        expect(btn).toBeDisabled();
        // disabled buttons with pointer-events-none will not fire events
        fireEvent.click(btn);
        expect(handleClick).not.toHaveBeenCalled();
    });

    it('applies disabled styling', () => {
        render(<Button disabled>Dim</Button>);
        const btn = screen.getByRole('button', { name: /dim/i });
        expect(btn).toHaveClass('disabled:opacity-50');
    });

    it('merges custom className', () => {
        render(<Button className="my-custom-class">Custom</Button>);
        const btn = screen.getByRole('button', { name: /custom/i });
        expect(btn).toHaveClass('my-custom-class');
    });

    it('renders as a button element by default', () => {
        render(<Button>Tag</Button>);
        const btn = screen.getByRole('button', { name: /tag/i });
        expect(btn.tagName).toBe('BUTTON');
    });
});
