"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface CriteriaItem {
  group: string;
  stopThreshold: string;
  idleThreshold: string;
  durationMin: number;
}

export default function SettingsPage() {
  const [criteria, setCriteria] = useState<CriteriaItem[]>([]);
  const [editing, setEditing] = useState<Record<string, CriteriaItem>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/criteria")
      .then((r) => r.json())
      .then((json) => {
        setCriteria(json.data || []);
      });
  }, []);

  const startEdit = (c: CriteriaItem) => {
    setEditing((prev) => ({ ...prev, [c.group]: { ...c } }));
  };

  const cancelEdit = (group: string) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[group];
      return next;
    });
  };

  const updateField = (group: string, field: keyof CriteriaItem, value: string) => {
    setEditing((prev) => ({
      ...prev,
      [group]: { ...prev[group], [field]: value },
    }));
  };

  const save = async (group: string) => {
    const item = editing[group];
    if (!item) return;
    setSaving(group);
    setMessage(null);
    try {
      const res = await fetch(`/api/criteria/${encodeURIComponent(group)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stopThreshold: parseFloat(item.stopThreshold),
          idleThreshold: parseFloat(item.idleThreshold),
          durationMin: parseInt(String(item.durationMin)),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setCriteria((prev) =>
          prev.map((c) => (c.group === group ? { ...item } : c))
        );
        cancelEdit(group);
        setMessage(`${group} 저장 완료`);
      } else {
        setMessage(json.error);
      }
    } catch (err) {
      setMessage(String(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">설정</h1>
      <p className="text-sm text-muted-foreground mb-6">
        설비 그룹별 판정 기준을 설정합니다. 변경 후 분석을 다시 실행하면 새 기준이 적용됩니다.
      </p>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border text-sm">
          {message}
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-4 font-semibold">그룹</th>
              <th className="text-right py-3 px-4 font-semibold">완전정지 (A)</th>
              <th className="text-right py-3 px-4 font-semibold">비가동 상한 (A)</th>
              <th className="text-right py-3 px-4 font-semibold">지속 조건 (분)</th>
              <th className="text-center py-3 px-4 font-semibold w-32"></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const isEditing = !!editing[c.group];
              const item = editing[c.group] || c;
              return (
                <tr key={c.group} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="py-3 px-4 font-bold">{c.group}</td>
                  <td className="py-3 px-4 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={item.stopThreshold}
                        onChange={(e) => updateField(c.group, "stopThreshold", e.target.value)}
                        className="border rounded px-2 py-1 w-20 text-right bg-background"
                      />
                    ) : (
                      item.stopThreshold
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={item.idleThreshold}
                        onChange={(e) => updateField(c.group, "idleThreshold", e.target.value)}
                        className="border rounded px-2 py-1 w-20 text-right bg-background"
                      />
                    ) : (
                      item.idleThreshold
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.durationMin}
                        onChange={(e) => updateField(c.group, "durationMin", e.target.value)}
                        className="border rounded px-2 py-1 w-16 text-right bg-background"
                      />
                    ) : (
                      item.durationMin
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {isEditing ? (
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" onClick={() => save(c.group)} disabled={saving === c.group}>
                          {saving === c.group ? "..." : "저장"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelEdit(c.group)}>
                          취소
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                        수정
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
