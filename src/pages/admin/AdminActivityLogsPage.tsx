import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../types/store';

interface LogRow {
  id: string;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string;
  ip_address: string | null;
  created_at: string;
}

export const AdminActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    apiFetch<{ logs: LogRow[] }>('/api/admin/activity-logs')
      .then((res) => setLogs(res.logs))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Admin Activity Logs</h1>
        <p className="text-xs text-[#707782] mt-1">
          Immutable audit trail of staff authentication, catalogue updates, orders, payments, and configuration changes.
        </p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Target</th>
              <th className="py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#101820]/5">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#707782]">No activity logs recorded yet.</td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 px-4 tabular-nums whitespace-nowrap text-[#707782]">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-medium">{l.actor_email}</td>
                  <td className="py-2.5 px-4 font-mono">{l.action}</td>
                  <td className="py-2.5 px-4">
                    {l.entity_type} {l.entity_id ? `(${l.entity_id.slice(0, 8)})` : ''}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-[#707782] max-w-xs truncate">
                    {l.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
