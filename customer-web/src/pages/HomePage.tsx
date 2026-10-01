export function HomePage() {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold">QR table ordering</h1>
      <p className="mt-3 text-stone-400">
        Scan the QR code on your table to open the menu. This app does not work from the home page
        alone — you need the link from your table&apos;s QR code.
      </p>
    </div>
  );
}
