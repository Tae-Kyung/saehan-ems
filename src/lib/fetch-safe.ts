/** 안전한 fetch + JSON 파싱. 빈 응답이나 파싱 실패 시 에러를 던지지 않고 null 반환. */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!text) {
      return { ok: false, status: res.status, data: null, error: "서버 응답이 비어 있습니다." };
    }
    try {
      const json = JSON.parse(text);
      if (!res.ok) {
        return { ok: false, status: res.status, data: null, error: json.error || `HTTP ${res.status}` };
      }
      return { ok: true, status: res.status, data: json };
    } catch {
      return { ok: false, status: res.status, data: null, error: `응답 파싱 실패: ${text.slice(0, 200)}` };
    }
  } catch (err) {
    return { ok: false, status: 0, data: null, error: `네트워크 오류: ${err}` };
  }
}
