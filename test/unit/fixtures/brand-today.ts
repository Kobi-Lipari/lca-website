// test/unit/fixtures/brand-today.ts
//
// Today's header, footer and About page (WS01 step 28), as Navbar.tsx,
// Footer.tsx and AboutPage.tsx drew them at df62ca3, before the step, with
// newLook off: the header signed out on /, the footer on / with the clock at
// Wed, Oct 21, 2026, and /about. They were rendered from the files before
// they were changed and copied here as they came out.
// test/unit/brand-placements.test.tsx holds the three, drawn with newLook
// off, to this markup to the attribute, and with newLook on to this markup
// once the logo or the mark the step draws is put back as it was. The logo's
// address is the one the test environment gives the imported file. Written
// one tag a line for reading; markup() joins the lines back into the exact
// markup. The copyright sign and the About page's dashes are written as
// escapes, so this file holds no dash character.

/** Today's markup, one tag a line, joined back into one string. */
export const markup = (literal: string) => literal.replace(/\n\s*/g, '')

/** The header, signed out, on /: the logo image and the name in the brand link. */
export const NAVBAR_TODAY = `
<header class="sticky top-0 z-50 border-b border-white/10 bg-brand-navy text-white shadow-md print:hidden">
  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <a class="flex items-center gap-3 transition-opacity hover:opacity-90" href="/" data-discover="true">
      <img alt="Louisiana Chess Association" class="h-11 w-11 rounded-lg object-contain" src="/src/assets/lca-logo.webp">
      <div>
        <div class="text-base font-bold leading-tight text-white">Louisiana Chess</div>
        <div class="text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-lca-gold/90">Association</div>
      </div>
    </a>
    <nav class="hidden items-center gap-5 md:flex">
      <a class="text-sm font-medium transition-colors text-white/90 hover:text-lca-gold" href="/tournaments" data-discover="true">Tournaments</a>
      <a class="text-sm font-medium transition-colors text-white/90 hover:text-lca-gold" href="/clubs" data-discover="true">Clubs</a>
      <div class="hidden items-center gap-5 lg:flex">
        <a class="text-sm font-medium transition-colors text-white/90 hover:text-lca-gold" href="/scholastic" data-discover="true">Scholastic</a>
        <a class="text-sm font-medium transition-colors text-white/90 hover:text-lca-gold" href="/news" data-discover="true">News</a>
        <a class="text-sm font-medium transition-colors text-white/90 hover:text-lca-gold" href="/scanner" data-discover="true">Scanner</a>
        <div class="relative">
          <button type="button" aria-haspopup="menu" aria-expanded="false" class="flex items-center gap-1 text-sm font-medium transition-colors text-white/90 hover:text-lca-gold">More<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down size-3 transition-transform" aria-hidden="true">
              <path d="m6 9 6 6 6-6">
              </path>
            </svg>
          </button>
        </div>
      </div>
    </nav>
    <div class="hidden items-center gap-2 md:flex">
      <a href="https://www.facebook.com/LouisianaChessAssociation" target="_blank" rel="noopener noreferrer" aria-label="Follow LCA on Facebook" class="hidden h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-[#1877F2] lg:flex">
        <svg viewBox="0 0 24 24" fill="currentColor" class="size-4" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z">
          </path>
        </svg>
      </a>
      <a data-slot="button" data-variant="outline" data-size="sm" class="group/button inline-flex shrink-0 items-center justify-center border bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&amp;_svg:not([class*='size-'])]:size-3.5 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" href="/login" data-discover="true">Log in</a>
      <a data-slot="button" data-variant="default" data-size="sm" class="group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&amp;_svg:not([class*='size-'])]:size-3.5 bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90" href="/membership" data-discover="true">Join LCA</a>
    </div>
    <button type="button" class="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 lg:hidden" aria-expanded="false" aria-label="Open menu">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu size-6" aria-hidden="true">
        <path d="M4 5h16">
        </path>
        <path d="M4 12h16">
        </path>
        <path d="M4 19h16">
        </path>
      </svg>
    </button>
  </div>
</header>
`

/** The footer on /, the year 2026: the logo image beside the name, on the navy. */
export const FOOTER_TODAY = `
<footer class="border-t-[3px] border-lca-gold bg-brand-navy text-white print:hidden">
  <div class="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
    <div class="grid gap-12 lg:grid-cols-[1.1fr_2fr] lg:gap-16">
      <div>
        <div class="flex items-center gap-3.5">
          <img alt="Louisiana Chess Association" class="h-14 w-14 rounded-xl object-contain" src="/src/assets/lca-logo.webp">
          <div>
            <div class="text-lg font-bold leading-tight text-white">Louisiana Chess Association</div>
            <div class="mt-0.5 text-sm text-white/60">Serving Louisiana players since 1915</div>
          </div>
        </div>
        <a href="https://www.facebook.com/LouisianaChessAssociation" target="_blank" rel="noopener noreferrer" class="mt-6 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 py-2 pl-3 pr-5 text-sm font-medium text-white/85 transition-colors hover:border-[#1877F2] hover:bg-[#1877F2] hover:text-white">
          <svg viewBox="0 0 24 24" fill="currentColor" class="size-6 shrink-0" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z">
            </path>
          </svg>Follow us on Facebook</a>
        <div class="mt-6 flex flex-wrap gap-3">
          <a class="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:border-lca-gold hover:text-lca-gold" href="/tournaments" data-discover="true">Find a tournament</a>
          <a class="rounded-lg bg-lca-gold px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-lca-gold/90" href="/membership" data-discover="true">Join LCA</a>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
        <div>
          <p class="text-sm font-bold uppercase tracking-widest text-lca-gold">Play</p>
          <ul class="mt-4 space-y-2.5">
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/tournaments" data-discover="true">Tournaments</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/clubs" data-discover="true">Chess clubs</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/scholastic" data-discover="true">Scholastic chess</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/champions" data-discover="true">State champions</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/scanner" data-discover="true">Scoresheet scanner</a>
            </li>
          </ul>
        </div>
        <div>
          <p class="text-sm font-bold uppercase tracking-widest text-lca-gold">Governance</p>
          <ul class="mt-4 space-y-2.5">
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/about" data-discover="true">About LCA</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/governance/board" data-discover="true">Board members</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/governance/bylaws" data-discover="true">Bylaws &amp; rules</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/governance/minutes" data-discover="true">Meeting minutes</a>
            </li>
          </ul>
        </div>
        <div>
          <p class="text-sm font-bold uppercase tracking-widest text-lca-gold">Membership</p>
          <ul class="mt-4 space-y-2.5">
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/membership" data-discover="true">Join or renew</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/login" data-discover="true">Log in</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/dashboard" data-discover="true">My profile</a>
            </li>
          </ul>
        </div>
        <div>
          <p class="text-sm font-bold uppercase tracking-widest text-lca-gold">Connect</p>
          <ul class="mt-4 space-y-2.5">
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/news" data-discover="true">News</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/contact" data-discover="true">Contact us</a>
            </li>
            <li>
              <a class="text-sm text-white/60 transition-colors hover:text-lca-gold" href="/support" data-discover="true">Support</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-white/50">\u00a9 2026 Louisiana Chess Association. All rights reserved.</p>
      <p class="text-sm text-white/40">
      </p>
    </div>
  </div>
</footer>
`

/** /about: the page's hero, the governance links and its words, with no logo. */
export const ABOUT_TODAY = `
<div>
  <section class="border-b-[3px] border-lca-gold bg-brand-navy text-white">
    <div class="mx-auto max-w-6xl px-6 pt-10 pb-10">
      <div class="">
        <div class="min-w-0">
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">About LCA</h1>
          <p class="mt-2 max-w-xl text-sm leading-relaxed text-white/60">The Louisiana Chess Association</p>
        </div>
      </div>
    </div>
  </section>
  <section class="mx-auto max-w-6xl px-6 py-10">
    <div class="flex gap-8">
      <aside class="hidden lg:block lg:w-52 lg:flex-shrink-0">
        <div class="sticky top-24 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div class="bg-brand-navy px-4 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-white/60">Governance</p>
          </div>
          <nav class="py-1">
            <a class="block border-l-2 px-4 py-2.5 text-sm transition-colors border-lca-gold bg-lca-gold/5 font-medium text-ink" href="/about" data-discover="true">About LCA</a>
            <a class="block border-l-2 px-4 py-2.5 text-sm transition-colors border-transparent text-muted-foreground hover:border-border hover:text-foreground" href="/governance/board" data-discover="true">Board members</a>
            <a class="block border-l-2 px-4 py-2.5 text-sm transition-colors border-transparent text-muted-foreground hover:border-border hover:text-foreground" href="/governance/bylaws" data-discover="true">Bylaws &amp; rules</a>
            <a class="block border-l-2 px-4 py-2.5 text-sm transition-colors border-transparent text-muted-foreground hover:border-border hover:text-foreground" href="/governance/minutes" data-discover="true">Meeting minutes</a>
          </nav>
        </div>
      </aside>
      <main class="min-w-0 flex-1">
        <nav aria-label="Governance" class="-mx-6 mb-6 overflow-x-auto px-6 lg:hidden">
          <div class="flex w-max gap-2">
            <a aria-current="page" class="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors border-brand-navy bg-brand-navy font-medium text-white" href="/about" data-discover="true">About LCA</a>
            <a class="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors border-border bg-card text-muted-foreground hover:border-ink/40 hover:text-foreground" href="/governance/board" data-discover="true">Board members</a>
            <a class="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors border-border bg-card text-muted-foreground hover:border-ink/40 hover:text-foreground" href="/governance/bylaws" data-discover="true">Bylaws &amp; rules</a>
            <a class="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors border-border bg-card text-muted-foreground hover:border-ink/40 hover:text-foreground" href="/governance/minutes" data-discover="true">Meeting minutes</a>
          </div>
        </nav>
        <div class="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 class="mb-3 text-xl font-bold text-ink">Who we are</h2>
            <p>The Louisiana Chess Association (LCA) is the official state chess organization for Louisiana, affiliated with the United States Chess Federation (USCF). We serve chess players of all ages and skill levels across the state.</p>
          </div>
          <div>
            <h2 class="mb-3 text-xl font-bold text-ink">Our mission</h2>
            <p>The LCA promotes and develops chess throughout Louisiana through sanctioned tournaments, club support, scholastic outreach, and community building. We believe chess is for everyone \u2014 beginners and grandmasters alike.</p>
          </div>
          <div>
            <h2 class="mb-3 text-xl font-bold text-ink">What we do</h2>
            <ul class="ml-4 list-disc space-y-2">
              <li>Sanction and organize USCF-rated chess tournaments across Louisiana</li>
              <li>Support affiliated chess clubs in 7 regions statewide</li>
              <li>Promote scholastic chess in K\u201312 schools</li>
              <li>Maintain official ratings and membership records</li>
              <li>Represent Louisiana in national USCF governance</li>
            </ul>
          </div>
          <div>
            <h2 class="mb-3 text-xl font-bold text-ink">USCF affiliation</h2>
            <p>The LCA is a USCF-affiliated state organization. All LCA-sanctioned tournaments count toward USCF national ratings. LCA members in good standing are eligible to participate in national USCF events.</p>
          </div>
          <div class="rounded-xl border-[3px] border-lca-gold bg-brand-navy p-6 text-white">
            <h3 class="mb-2 font-semibold">Get involved</h3>
            <p class="text-sm text-white/65">Whether you want to play in tournaments, join a club, or help grow chess in Louisiana \u2014 we'd love to have you.</p>
            <div class="mt-4 flex flex-wrap gap-3">
              <a class="rounded-md bg-lca-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-lca-gold/90" href="/membership" data-discover="true">Join LCA</a>
              <a class="rounded-md border border-white/25 px-4 py-2 text-sm text-white hover:bg-white/10" href="/contact" data-discover="true">Contact us</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  </section>
</div>
`
