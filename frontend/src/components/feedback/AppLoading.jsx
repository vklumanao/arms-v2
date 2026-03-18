export default function AppLoading({ label = "Loading..." }) {
  return (
    <div className="rounded border bg-white p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-48 rounded bg-gray-200" />
        <div className="h-4 w-72 rounded bg-gray-100" />
        <div className="h-4 w-64 rounded bg-gray-100" />
      </div>
      <p className="mt-4 text-sm text-gray-600">{label}</p>
    </div>
  );
}

