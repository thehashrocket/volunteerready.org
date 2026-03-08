# Next.js App Router — Frontend Consistency Patterns

## Layout Consistency
- [ ] Root layout sets metadata, fonts, and global providers
- [ ] Route group layouts share consistent chrome (nav, sidebar, footer)
- [ ] Nested layouts don't unnecessarily duplicate structure
- [ ] Loading.tsx files exist for routes with async data
- [ ] Error.tsx boundaries provide consistent error UI
- [ ] Not-found.tsx gives uniform 404 experience

## Server vs Client Components
- [ ] "use client" is only on components that need browser APIs or React state
- [ ] Data fetching happens in Server Components where possible
- [ ] Client components are as small/leaf-level as possible
- [ ] No unnecessary "use client" at page level when only a child needs it

## Page Structure Patterns
Every authenticated page should consistently include:
- [ ] PageHeader component with title (and optional description/actions)
- [ ] Consistent content container width and padding
- [ ] Loading skeleton that matches the final layout shape
- [ ] Empty state for zero-data scenarios
- [ ] Error boundary or error handling

## Route Organization
- [ ] Route groups `(group)` separate concerns (auth vs public)
- [ ] Dynamic routes `[param]` have proper validation
- [ ] Parallel routes or intercepting routes used consistently if at all
- [ ] API routes organized under a single `api/` directory

## Data Fetching Patterns
- [ ] tRPC/React Query usage is consistent across pages
- [ ] Loading states show skeletons (not spinners, unless the app uses spinners everywhere)
- [ ] Error states are handled uniformly
- [ ] Optimistic updates follow the same pattern when used

## Metadata
- [ ] Each page exports metadata or uses generateMetadata
- [ ] Title template is consistent ("Page | App Name")
- [ ] Descriptions are provided for public-facing pages

## Forms
- [ ] Form library (react-hook-form) is used consistently
- [ ] Validation (zod) schemas follow naming conventions
- [ ] Submit buttons show loading state during submission
- [ ] Success/error feedback uses the same toast/notification pattern
