import { PageHeading } from '@/components/ui/admin/PageHeading';
import { PaymentConfigForm } from '@/components/admin/PaymentConfigForm';

export default function BemaPaymentConfigPage() {
  return (
    <div>
      <PageHeading>Payment Preferences</PageHeading>
      <PaymentConfigForm />
    </div>
  );
}
