// test/unit/fixtures/home-hero-today.ts
//
// Today's homepage hero (WS01 step 29), as HomePage.tsx drew it at c534742,
// before the step, with newLook off: the slideshow on its first slide, as a
// visitor gets it when the page opens, and the same hero 5 seconds later,
// moved on to the second slide. Both were rendered from the file before it
// changed, in the test environment (jsdom, with fake timers), and copied
// here as they came out. test/unit/hero-no-autoplay.test.tsx holds the hero
// drawn with newLook off to this markup to the attribute, at the start, after
// 5 seconds and after 25, when the fifth slide has moved on to the first
// again. The photos' addresses are the ones the test environment gives the
// imported files. Written one tag a line for reading; markup() joins the
// lines back into the exact markup.

/** Today's markup, one tag a line, joined back into one string. */
export const markup = (literal: string) => literal.replace(/\n\s*/g, '')

/** The hero as the page opens: the first of five slides on show, its dot the wide gold one. */
export const HERO_TODAY = `
<div class="relative overflow-hidden border-b border-border" style="height: 420px;" data-ground="dark">
  <div class="flex h-full transition-transform duration-500 ease-in-out" style="transform: translateX(-0%);">
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_1.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Louisiana Chess Community</div>
    </div>
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_2.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Club tournaments across the state</div>
    </div>
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_3.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Scholastic chess in Louisiana</div>
    </div>
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_4.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Players across the Pelican State</div>
    </div>
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_5.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Chess for every generation</div>
    </div>
  </div>
  <div class="absolute inset-0 flex flex-col items-center justify-end pb-14 px-6 text-center text-white">
    <div class="mb-2 inline-block rounded-full border border-lca-gold/50 bg-lca-gold/20 px-3 py-1 text-xs text-gold-on-dark-badge backdrop-blur-sm">Louisiana's chess community since 1915</div>
    <h1 class="mt-2 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Play. Compete. Connect.</h1>
    <p class="mt-3 max-w-md text-sm leading-relaxed text-white/80">Tournaments, scholastic programs, and clubs across the Pelican State.</p>
    <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
      <a data-slot="button" data-variant="default" data-size="lg" class="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 [&amp;_svg:not([class*='size-'])]:size-4 h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90" href="/tournaments" data-discover="true">Find a tournament</a>
      <a data-slot="button" data-variant="outline" data-size="lg" class="group/button inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 [&amp;_svg:not([class*='size-'])]:size-4 aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white" href="/membership" data-discover="true">Join LCA</a>
    </div>
    <div class="mt-5 flex gap-6">
      <div class="text-center">
        <div class="text-lg font-bold text-white">300+</div>
        <div class="text-xs text-white/60">members</div>
      </div>
      <div class="text-center">
        <div class="text-lg font-bold text-white">25+</div>
        <div class="text-xs text-white/60">clubs</div>
      </div>
      <div class="text-center">
        <div class="text-lg font-bold text-white">110+</div>
        <div class="text-xs text-white/60">years of history</div>
      </div>
    </div>
  </div>
  <div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
    <button type="button" aria-label="Previous slide" class="flex h-6 w-6 items-center justify-center rounded bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left size-3.5 text-white" aria-hidden="true">
        <path d="m15 18-6-6 6-6"></path>
      </svg>
    </button>
    <button type="button" aria-label="Slide 1" class="h-1.5 rounded-full transition-all duration-300 w-5 bg-lca-gold"></button>
    <button type="button" aria-label="Slide 2" class="h-1.5 rounded-full transition-all duration-300 w-1.5 bg-white/40 hover:bg-white/60"></button>
    <button type="button" aria-label="Slide 3" class="h-1.5 rounded-full transition-all duration-300 w-1.5 bg-white/40 hover:bg-white/60"></button>
    <button type="button" aria-label="Slide 4" class="h-1.5 rounded-full transition-all duration-300 w-1.5 bg-white/40 hover:bg-white/60"></button>
    <button type="button" aria-label="Slide 5" class="h-1.5 rounded-full transition-all duration-300 w-1.5 bg-white/40 hover:bg-white/60"></button>
    <button type="button" aria-label="Next slide" class="flex h-6 w-6 items-center justify-center rounded bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right size-3.5 text-white" aria-hidden="true">
        <path d="m9 18 6-6-6-6"></path>
      </svg>
    </button>
  </div>
</div>
`

/** The same hero 5 seconds later: the track moved one slide along, the second dot now the wide gold one. */
export const HERO_TODAY_AFTER_5S = `
<div class="relative overflow-hidden border-b border-border" style="height: 420px;" data-ground="dark">
  <div class="flex h-full transition-transform duration-500 ease-in-out" style="transform: translateX(-100%);">
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_1.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Louisiana Chess Community</div>
    </div>
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_2.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Club tournaments across the state</div>
    </div>
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_3.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Scholastic chess in Louisiana</div>
    </div>
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_4.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Players across the Pelican State</div>
    </div>
    <div class="relative h-full min-w-full flex-shrink-0 overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url(&quot;/src/assets/LCA_Slide_5.jpg&quot;); filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);"></div>
      <div class="absolute inset-0 bg-brand-navy/55 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10"></div>
      <div class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">Chess for every generation</div>
    </div>
  </div>
  <div class="absolute inset-0 flex flex-col items-center justify-end pb-14 px-6 text-center text-white">
    <div class="mb-2 inline-block rounded-full border border-lca-gold/50 bg-lca-gold/20 px-3 py-1 text-xs text-gold-on-dark-badge backdrop-blur-sm">Louisiana's chess community since 1915</div>
    <h1 class="mt-2 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Play. Compete. Connect.</h1>
    <p class="mt-3 max-w-md text-sm leading-relaxed text-white/80">Tournaments, scholastic programs, and clubs across the Pelican State.</p>
    <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
      <a data-slot="button" data-variant="default" data-size="lg" class="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 [&amp;_svg:not([class*='size-'])]:size-4 h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90" href="/tournaments" data-discover="true">Find a tournament</a>
      <a data-slot="button" data-variant="outline" data-size="lg" class="group/button inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 [&amp;_svg:not([class*='size-'])]:size-4 aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white" href="/membership" data-discover="true">Join LCA</a>
    </div>
    <div class="mt-5 flex gap-6">
      <div class="text-center">
        <div class="text-lg font-bold text-white">300+</div>
        <div class="text-xs text-white/60">members</div>
      </div>
      <div class="text-center">
        <div class="text-lg font-bold text-white">25+</div>
        <div class="text-xs text-white/60">clubs</div>
      </div>
      <div class="text-center">
        <div class="text-lg font-bold text-white">110+</div>
        <div class="text-xs text-white/60">years of history</div>
      </div>
    </div>
  </div>
  <div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
    <button type="button" aria-label="Previous slide" class="flex h-6 w-6 items-center justify-center rounded bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left size-3.5 text-white" aria-hidden="true">
        <path d="m15 18-6-6 6-6"></path>
      </svg>
    </button>
    <button type="button" aria-label="Slide 1" class="h-1.5 rounded-full transition-all duration-300 w-1.5 bg-white/40 hover:bg-white/60"></button>
    <button type="button" aria-label="Slide 2" class="h-1.5 rounded-full transition-all duration-300 w-5 bg-lca-gold"></button>
    <button type="button" aria-label="Slide 3" class="h-1.5 rounded-full transition-all duration-300 w-1.5 bg-white/40 hover:bg-white/60"></button>
    <button type="button" aria-label="Slide 4" class="h-1.5 rounded-full transition-all duration-300 w-1.5 bg-white/40 hover:bg-white/60"></button>
    <button type="button" aria-label="Slide 5" class="h-1.5 rounded-full transition-all duration-300 w-1.5 bg-white/40 hover:bg-white/60"></button>
    <button type="button" aria-label="Next slide" class="flex h-6 w-6 items-center justify-center rounded bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right size-3.5 text-white" aria-hidden="true">
        <path d="m9 18 6-6-6-6"></path>
      </svg>
    </button>
  </div>
</div>
`
