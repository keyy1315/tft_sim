'use client';
import { use } from 'react';
import ActualDataEditor from '@/components/actual-data/ActualDataEditor';
import AdminGuard from '@/components/AdminGuard';

export default function ActualDataEditPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  return (
    <AdminGuard>
      <ActualDataEditor gameId={gameId} />
    </AdminGuard>
  );
}
