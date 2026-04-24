"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DonateBox } from "@/components/donate/donate-box";

export default function DonatePage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:px-8 lg:pt-24">
        <Button
          asChild
          variant="ghost"
          className="mb-8 -ml-4 text-muted-foreground hover:text-foreground"
        >
          <Link href="/">
            <ArrowLeft className="size-4" />
            Home
          </Link>
        </Button>

        <div className="mx-auto max-w-xl text-center mb-10">
          <h1 className="font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl animate-in slide-in-from-bottom-4 duration-700 fill-mode-both">
            Support Powershot
          </h1>
          <p className="mt-6 text-lg text-muted-foreground font-medium animate-in slide-in-from-bottom-8 duration-700 fill-mode-both delay-150">
            Powershot is free and open source. If you find it useful, consider
            making a donation to help cover server costs and ongoing development.
            Every contribution helps.
          </p>
        </div>

        <div className="mx-auto max-w-md animate-in slide-in-from-bottom-12 duration-700 fill-mode-both delay-300">
          <DonateBox />
        </div>

        <div className="mx-auto max-w-md mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Crypto payments are processed via{" "}
            <a
              href="https://nowpayments.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              NOWPayments
            </a>
            . Your donation goes directly to our wallet. No personal data is
            collected or stored.
          </p>
        </div>
      </div>
    </div>
  );
}