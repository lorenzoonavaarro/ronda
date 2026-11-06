import { redirect } from 'next/navigation';

import { AuthForm } from '../../components/auth-form';
import { getCurrentUser } from '../../lib/api';
import { visibleError } from '../../lib/form-error';
import { safeNextPath } from '../../lib/next-path';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(
    typeof params.next === 'string' ? params.next : undefined,
  );
  const user = await getCurrentUser();

  if (user) {
    redirect(next ?? '/');
  }

  return (
    <AuthForm
      mode="register"
      nextPath={next}
      error={visibleError(params.error)}
    />
  );
}
