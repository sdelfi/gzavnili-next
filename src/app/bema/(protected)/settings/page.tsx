import { PageHeading } from '@/components/ui/admin/PageHeading';
import { SiteSettingsForm } from '@/components/admin/SiteSettingsForm';

export default function BemaSettingsPage() {
  return (
    <div>
      <PageHeading>Site Settings</PageHeading>
      <SiteSettingsForm />
    </div>
  );
}
