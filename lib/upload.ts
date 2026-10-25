import { supabase } from "@/lib/supabase";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

export type Attachment = { name: string; url: string; path: string; size: number; type: string };

export const formatSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;

/** 업로드 전 검사. 문제가 있으면 사유 문구를 돌려준다. */
export function checkFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return `${file.name}: 파일당 20MB까지 올릴 수 있습니다. (${formatSize(file.size)})`;
  if (file.size === 0) return `${file.name}: 빈 파일입니다.`;
  return null;
}

/**
 * Supabase Storage 의 uploads 버킷에 <userId>/<랜덤>.<확장자> 로 올린다.
 * 저장소 키는 영문·숫자만 허용하므로(한글 파일명은 Invalid key) 경로에는 원래 이름을 쓰지 않고,
 * 원래 이름은 Attachment.name 으로 따로 보관해 목록·내려받기에 쓴다.
 */
export async function uploadFile(userId: string, file: File): Promise<Attachment> {
  const bad = checkFile(file);
  if (bad) throw new Error(bad);
  const ext = (file.name.match(/\.([0-9A-Za-z]{1,8})$/)?.[1] ?? "").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`${file.name}: ${error.message}`);
  const { data } = supabase.storage.from("uploads").getPublicUrl(path);
  return { name: file.name, url: data.publicUrl, path, size: file.size, type: file.type };
}

export async function removeUpload(path: string) {
  await supabase.storage.from("uploads").remove([path]);
}
