import { notFound } from "next/navigation";
import { getPublicReviewRequestByToken } from "@/lib/customer-reputation/customer-reputation.service";
import { ReviewRequestForm } from "./review-request-form";

type Props = { params: Promise<{ token: string }> };

export default async function PublicReviewRequestPage({ params }: Props) {
  const { token } = await params;
  let model: Awaited<ReturnType<typeof getPublicReviewRequestByToken>>;
  try {
    model = await getPublicReviewRequestByToken(token);
  } catch {
    notFound();
  }
  return <ReviewRequestForm token={token} model={model} />;
}
