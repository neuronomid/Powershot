export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground">
          Last updated: April 2026
        </p>
      </header>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Zero server-side persistence
          </h2>
          <p>
            Powershot is designed so your images and notes never touch our disks.
            Screenshots live in memory and in transit only, long enough for the
            extraction pipeline to run. We do not store image bytes, extracted
            text, or note content on our servers.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Local storage only
          </h2>
          <p>
            Your finished notes are stored entirely on your device using
            IndexedDB (for note content) and localStorage (for preferences).
            This data never leaves your browser. If you clear your browser
            storage or use a different device or browser, your notes will not be
            available.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            AI processing
          </h2>
          <p>
            When you generate a note, your screenshots are sent to OpenRouter
            for processing by Google Gemini or Anthropic Claude vision models.
            This transmission is encrypted in transit. OpenRouter&rsquo;s privacy
            practices govern this step; we do not retain copies of the images or
            the model outputs.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Logging
          </h2>
          <p>
            Our server logs record only error categories and HTTP status codes
            for debugging purposes. No image bytes, extracted text, or note
            content appears in logs.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Cookies and analytics
          </h2>
          <p>
            Powershot does not use tracking cookies or third-party analytics.
            The only client-side storage we use is IndexedDB and localStorage,
            both under your control and deletable at any time through your
            browser settings.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Contact
          </h2>
          <p>
            If you have questions about this policy, please reach out through
            the project repository.
          </p>
        </section>
      </div>
    </div>
  );
}
