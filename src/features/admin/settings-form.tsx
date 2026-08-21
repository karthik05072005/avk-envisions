'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiClientError, api } from '@/lib/api-client';

/**
 * Settings editor.
 *
 * The input rendered depends on the setting's declared `valueType`, so a
 * boolean is a checkbox and a number is a number field. Only changed rows are
 * submitted — the API ignores unknown keys, and sending everything on every
 * save would flood the audit log with no-op entries.
 */
export interface SettingRow {
  key: string;
  value: string;
  valueType: string;
  group: string;
  label: string | null;
}

export function SettingsForm({ settings }: { settings: SettingRow[] }) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(settings.map((s) => [s.key, s.value])),
  );
  const [saving, setSaving] = React.useState(false);

  const dirty = settings.filter((s) => values[s.key] !== s.value);

  const groups = settings.reduce<Record<string, SettingRow[]>>((acc, setting) => {
    (acc[setting.group] ??= []).push(setting);
    return acc;
  }, {});

  async function save() {
    if (dirty.length === 0) return;
    setSaving(true);

    try {
      const result = await api.put<{ updated: number }>('/api/admin/settings', {
        settings: dirty.map((s) => ({ key: s.key, value: values[s.key] ?? '' })),
      });
      toast.success(`Updated ${result.updated} setting${result.updated === 1 ? '' : 's'}.`);
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([group, rows]) => (
        <Card key={group}>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <h2 className="font-semibold capitalize tracking-tight">{group}</h2>

            {rows.map((setting) => {
              const current = values[setting.key] ?? '';
              const changed = current !== setting.value;

              return (
                <div key={setting.key}>
                  <label
                    htmlFor={setting.key}
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    {setting.label ?? setting.key}
                    {changed && (
                      <span className="text-xs font-normal text-warning">unsaved</span>
                    )}
                  </label>

                  {setting.valueType === 'BOOLEAN' ? (
                    <label className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        id={setting.key}
                        type="checkbox"
                        checked={current === 'true'}
                        onChange={(event) =>
                          setValues((previous) => ({
                            ...previous,
                            [setting.key]: event.target.checked ? 'true' : 'false',
                          }))
                        }
                        className="size-4 rounded border-input"
                      />
                      {current === 'true' ? 'Enabled' : 'Disabled'}
                    </label>
                  ) : (
                    <Input
                      id={setting.key}
                      type={setting.valueType === 'NUMBER' ? 'number' : 'text'}
                      value={current}
                      onChange={(event) =>
                        setValues((previous) => ({ ...previous, [setting.key]: event.target.value }))
                      }
                      className="mt-1.5"
                    />
                  )}

                  <p className="mt-1 font-mono text-xs text-muted-foreground">{setting.key}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/95 p-4 shadow-elevated backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {dirty.length === 0
            ? 'No unsaved changes.'
            : `${dirty.length} unsaved change${dirty.length === 1 ? '' : 's'}.`}
        </p>
        <Button onClick={save} loading={saving} disabled={dirty.length === 0}>
          <Save aria-hidden="true" />
          Save settings
        </Button>
      </div>
    </div>
  );
}
