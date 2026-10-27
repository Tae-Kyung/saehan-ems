"use client";

import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface UploadResult {
  date: string;
  rows: number;
  equipmentCount: number;
  insertCount: number;
  mappedEquipment?: string[];
  unmapped?: string[];
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f && f.name.endsWith(".json")) handleFile(f);
      else setError("JSON 파일만 업로드 가능합니다.");
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const upload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/ems", {
        method: "POST",
        body: formData,
      });
      const resText = await res.text();
      if (!resText) {
        setError("서버 응답이 비어 있습니다.");
        return;
      }
      const data = JSON.parse(resText);
      if (!res.ok) {
        setError(data.error || "업로드 실패");
      } else {
        setResult(data.data);
      }
    } catch (err) {
      setError(`파일 처리 오류: ${err}`);
    } finally {
      setUploading(false);
    }
  }, [file]);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">데이터 업로드</h1>

      <Card>
        <CardHeader>
          <CardTitle>EMS 전류 자료 (JSON)</CardTitle>
          <CardDescription>
            1분 단위 전류 데이터 · 07:00 ~ 익일 07:00
            <br />
            EMS 비교분석 화면에서 추출한 JSON 파일을 올려주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              dragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : file
                ? "border-green-500 bg-green-50 dark:bg-green-950"
                : "border-gray-300 dark:border-gray-700 hover:border-gray-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".json"
              className="hidden"
              onChange={onFileSelect}
            />
            {file ? (
              <div>
                <p className="text-green-700 dark:text-green-400 font-semibold">
                  ✓ {file.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium">여기에 끌어다 놓거나 클릭</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ems_YYYYMMDD.json 형식
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3 items-center">
            <Button onClick={upload} disabled={!file || uploading}>
              {uploading ? "업로드 중..." : "업로드 및 저장"}
            </Button>
            {file && !uploading && (
              <button
                className="text-sm text-muted-foreground hover:underline"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
              >
                초기화
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-sm space-y-1">
              <p className="font-semibold text-green-700 dark:text-green-400">
                업로드 완료
              </p>
              <p>날짜: {result.date}</p>
              <p>데이터: {result.rows}행 × {result.equipmentCount}대 설비</p>
              <p>저장: {result.insertCount.toLocaleString()}건</p>
              {result.mappedEquipment && (
                <p>설비: {result.mappedEquipment.join(", ")}</p>
              )}
              {result.unmapped && result.unmapped.length > 0 && (
                <p className="text-amber-600 dark:text-amber-400">
                  매핑 안 됨: {result.unmapped.join(", ")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
