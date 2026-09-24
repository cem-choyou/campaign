import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFoundCopy } from "@/lib/copy/common";

// Inside the brand layout: the sidebar stays available to get back on track.
export default function BrandNotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
        <SearchX className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">{notFoundCopy.title}</h1>
      <p className="text-muted-foreground mt-2 max-w-sm">{notFoundCopy.body}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">{notFoundCopy.back}</Link>
      </Button>
    </div>
  );
}
