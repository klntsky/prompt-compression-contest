export default function CasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="bg-gray-50">
      <div className="container mx-auto py-4">
        {children}
      </div>
    </main>
  );
} 