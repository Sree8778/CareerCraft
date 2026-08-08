export default function Loading() {
  return (
    <div className="min-h-[70vh] px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto w-full max-w-6xl animate-pulse space-y-5">
        <div className="h-8 w-48 rounded-xl" style={{ background: 'var(--cc-border)' }} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl" style={{ background: 'var(--cc-border)' }} />
          ))}
        </div>
        <div className="h-72 rounded-2xl" style={{ background: 'var(--cc-border)' }} />
      </div>
    </div>
  );
}
