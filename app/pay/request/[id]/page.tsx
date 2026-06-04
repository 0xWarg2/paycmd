import { PaymentRequestClient } from "./payment-request-client";

export default async function PaymentRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PaymentRequestClient requestId={id} />;
}
