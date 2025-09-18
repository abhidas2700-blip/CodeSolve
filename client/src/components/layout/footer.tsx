import React from 'react';
import { Link } from 'wouter';

export function Footer() {
  return (
    <footer className="py-6 border-t mt-auto">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          © {new Date().getFullYear()} SolveXtra by Qualithor. All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/help">
            <span className="underline underline-offset-4 hover:text-foreground cursor-pointer">Help</span>
          </Link>
          <Link href="/documentation">
            <span className="underline underline-offset-4 hover:text-foreground cursor-pointer">Documentation</span>
          </Link>
          <Link href="/contact">
            <span className="underline underline-offset-4 hover:text-foreground cursor-pointer">Contact</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
