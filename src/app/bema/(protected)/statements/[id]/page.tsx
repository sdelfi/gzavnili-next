import { Alert } from '@/components/ui/Alert';

// Stub for the legacy "View Statement" icon-link
// (`http/bema/statements/statement.cfm?userid=...`) — the statements module itself isn't
// built yet (see PROGRESS.md's rollout plan). This exists so the Customers list's action
// icon has somewhere real to link rather than a fake/dead URL.
export default async function UserStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1>Statement</h1>
      <Alert variant="error">Not implemented yet (customer id: {id}).</Alert>
    </div>
  );
}
