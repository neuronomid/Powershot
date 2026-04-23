"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FlaskConical, ImageIcon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { sampleAssets } from "@/lib/sample/library";

export function SampleNoteCard() {
  return (
    <Card className="relative overflow-hidden border border-border/60 bg-card/80 shadow-xl shadow-primary/5 backdrop-blur-sm">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,rgba(177,89,46,0.16),transparent_55%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_45%)]"
      />
      <CardContent className="relative grid gap-8 p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <FlaskConical className="size-3.5" />
            Sample Note
          </div>
          <div className="space-y-3">
            <h3 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Try Powershot without bringing your own screenshots
            </h3>
            <p className="max-w-xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
              Load a lecture slide, docs page, Slack thread, and article into
              the pipeline instantly. It uses the same intake path as the
              Chrome extension, then auto-runs the note generation flow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="glossy" size="lg" className="rounded-full px-6">
              <Link href="/new?sample=true">
                <Sparkles className="mr-2 size-4" />
                Try it with a sample
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-6">
              <Link href="/new">
                Start from scratch
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {sampleAssets.map((asset) => (
            <div
              key={asset.id}
              className="overflow-hidden rounded-2xl border border-border/60 bg-background/80 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>{asset.label}</span>
                <ImageIcon className="size-3.5" />
              </div>
              <Image
                src={`/samples/${asset.fileName}`}
                alt={asset.label}
                width={800}
                height={600}
                className="aspect-[4/3] h-auto w-full object-cover"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
