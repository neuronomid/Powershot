"use client";

import { Shield, ScrollText } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const STORAGE_KEY = "powershot_terms_accepted";
const TERMS_VERSION = "2026-04-23";

function readStoredAcceptance(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === TERMS_VERSION;
  } catch {
    return false;
  }
}

export function useTermsAccepted(): {
  accepted: boolean;
  accept: () => void;
} {
  const [accepted, setAccepted] = useState(readStoredAcceptance);

  const accept = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, TERMS_VERSION);
    } catch {
      // localStorage unavailable
    }
    setAccepted(true);
  }, []);

  return { accepted, accept };
}

export function TermsAcceptance({
  onAccept,
}: {
  onAccept: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setScrolledToBottom(atBottom);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-lg animate-in fade-in duration-300">
      <div className="relative mx-4 w-full max-w-lg flex flex-col gap-0 rounded-2xl border border-border/60 bg-popover shadow-2xl ring-1 ring-foreground/5 animate-in zoom-in-95 slide-in-from-bottom-4 duration-400 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-border/40 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
                Terms &amp; Conditions
              </h2>
              <p className="text-xs font-medium text-muted-foreground">
                Please read carefully before proceeding
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[52vh] overflow-y-auto px-6 py-5 text-sm leading-relaxed text-muted-foreground space-y-4 scroll-smooth"
        >
          <p className="font-semibold text-foreground">
            Last updated: April 23, 2026
          </p>

          <p>
            By using Powershot (&ldquo;the Service&rdquo;), you agree to be bound by
            these Terms and Conditions. If you do not agree, you must not use
            the Service.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            1. Your Rights to Submitted Content
          </h3>
          <p>
            By using this application, you represent and warrant that you have
            all necessary rights, permissions, consents, or lawful authority to
            upload, submit, convert, process, store, share, export, or
            otherwise use any content you provide through the Service, including
            but not limited to screenshots, images, documents, text, PDFs, and
            other materials (&ldquo;User Content&rdquo;).
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            2. Prohibited Uses
          </h3>
          <p>
            You agree not to use the Service to upload, convert, reproduce,
            distribute, store, transmit, export, or create derivative works
            from any content that infringes or may infringe the intellectual
            property rights, copyright, trademark rights, privacy rights,
            publicity rights, or any other legal rights of any third party.
            This includes, without limitation, copyrighted books, articles,
            course materials, paid educational content, subscription-only
            materials, proprietary documents, software interfaces, protected
            media, or any other content for which you do not have lawful
            permission to use.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            3. Service as a Technical Tool
          </h3>
          <p>
            The Service is provided solely as a technical tool that processes
            content submitted by users at their own direction. The Company, its
            founders, owners, developers, employees, contractors, affiliates,
            and team members do not review all User Content and do not
            independently verify whether a user has the legal right to upload
            or convert any specific material. You acknowledge and agree that
            you, and not the Company, are solely responsible for the content
            you submit and for ensuring that your use of the Service complies
            with all applicable laws, regulations, contractual obligations, and
            intellectual property rights.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            4. No License Granted
          </h3>
          <p>
            The Company does not claim ownership of third-party content uploaded
            by users and does not grant users any license to use content
            belonging to third parties. The fact that the Service is technically
            capable of converting screenshots or other materials into another
            format, including PDF or document form, does not mean that such use
            is lawful or authorized. Users remain solely responsible for
            determining whether they have the necessary legal rights to use,
            reproduce, transform, or export the content they submit.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            5. Limitation of Liability
          </h3>
          <p>
            By using the Service, you agree that the Company shall not be
            liable for any unauthorized, unlawful, infringing, or improper use
            of the Service by any user. To the maximum extent permitted by
            applicable law, the Company disclaims all liability arising out of
            or related to User Content, including any claim that content
            uploaded, processed, converted, stored, or exported through the
            Service infringes the rights of any third party. Any legal
            responsibility arising from such content or its use shall rest
            exclusively with the user who submitted or used the content.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            6. Company&apos;s Enforcement Rights
          </h3>
          <p>
            The Company reserves the right, but not the obligation, to remove
            content, suspend access, terminate accounts, refuse service, or
            take any other action it deems appropriate where it reasonably
            believes that the Service is being used in violation of these
            Terms, applicable law, or the rights of any third party.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            7. Indemnification
          </h3>
          <p>
            You agree to indemnify, defend, and hold harmless the Company, its
            founders, owners, developers, employees, contractors, affiliates,
            licensors, successors, assigns, and team members from and against
            any and all claims, demands, actions, proceedings, liabilities,
            damages, judgments, losses, costs, penalties, fines, and expenses,
            including reasonable legal fees, arising out of or related to:
            (a) your User Content; (b) your use or misuse of the Service;
            (c) your violation of these Terms; or (d) your violation of any
            law or any third-party right, including intellectual property
            rights.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            8. Data Handling &amp; Privacy
          </h3>
          <p>
            Images you upload are processed in transit only and are not
            persistently stored on our servers. Extracted text and note data
            are stored locally in your browser. The Company does not have
            access to your local data. By using the Service, you consent to
            the temporary server-side processing of your images for the purpose
            of text extraction and note generation.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            9. No Warranty
          </h3>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
            warranties of any kind, whether express or implied, including but
            not limited to implied warranties of merchantability, fitness for a
            particular purpose, and non-infringement. The Company does not
            warrant that the Service will be uninterrupted, error-free, or free
            of harmful components.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            10. Modifications
          </h3>
          <p>
            The Company reserves the right to modify these Terms at any time.
            Continued use of the Service after changes constitutes acceptance
            of the revised Terms. It is your responsibility to review these
            Terms periodically.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            11. Governing Law
          </h3>
          <p>
            These Terms shall be governed by and construed in accordance with
            applicable law, without regard to conflict of law principles. Any
            disputes arising from these Terms or your use of the Service shall
            be resolved in the appropriate courts of competent jurisdiction.
          </p>

          <h3 className="font-heading text-sm font-bold text-foreground pt-2">
            12. Do Not Use If You Lack Rights
          </h3>
          <p className="font-semibold text-foreground">
            If you do not have the legal right to use, upload, process, convert,
            reproduce, or export certain content, you must not use the Service
            for that content.
          </p>
        </div>

        {/* Scroll indicator */}
        {!scrolledToBottom && (
          <div className="pointer-events-none absolute left-0 right-0 bottom-[7.5rem] h-8 bg-gradient-to-t from-popover to-transparent" />
        )}

        {/* Footer */}
        <div className="flex flex-col gap-4 border-t border-border/40 px-6 py-5">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5 size-[18px]"
            />
            <span className="text-sm font-medium text-foreground leading-snug">
              I have read and agree to the Terms &amp; Conditions
            </span>
          </label>
          <Button
            type="button"
            variant="glossy"
            disabled={!checked}
            onClick={onAccept}
            className="h-11 w-full rounded-full text-base font-bold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            <ScrollText className="mr-2 size-5" />
            Accept &amp; Proceed
          </Button>
        </div>
      </div>
    </div>
  );
}
