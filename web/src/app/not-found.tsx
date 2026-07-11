import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <p className="text-7xl font-black cc-gradient-text mb-4">404</p>
      <h1 className="text-2xl font-bold mb-2">This page doesn&apos;t exist</h1>
      <p className="text-muted mb-8 max-w-md">
        The link may be outdated, or the page may have moved. Let&apos;s get you back on track.
      </p>
      <div className="flex gap-3">
        <Link href="/" className="cc-btn-primary">Go home</Link>
        <Link href="/candidate/jobs" className="cc-btn-ghost">Browse jobs</Link>
      </div>
    </div>
  );
}
