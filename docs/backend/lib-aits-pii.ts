// 토스 login-me 가 내려주는 암호화된 PII 복호화.
// 복사 위치: plnl.vercel.app/lib/aits/pii.ts
//
// 알고리즘: AES-256-GCM (`develop.md` 5단계 참고)
// - 키: 콘솔 이메일로 받은 base64 인코딩된 256-bit 키
// - IV: 암호문 앞 12바이트
// - AAD: 콘솔 이메일로 받은 문자열 (보통 "TOSS")
// - GCM auth tag: 암호문 마지막 16바이트

import crypto from "node:crypto";

const KEY_B64 = process.env.TOSS_AITS_DECRYPT_KEY ?? "";
const AAD = process.env.TOSS_AITS_DECRYPT_AAD ?? "";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function assertConfigured() {
  if (!KEY_B64 || !AAD) {
    throw new Error(
      "TOSS_AITS_DECRYPT_KEY / TOSS_AITS_DECRYPT_AAD 환경변수가 설정되지 않았어요. 콘솔에서 토스 로그인 활성화 후 이메일로 받은 복호화 키를 등록하세요.",
    );
  }
}

// 키/AAD 는 모듈 상수라 매 복호화마다 다시 디코딩할 필요 없이 1회만 만들어 재사용한다.
let _key: Buffer | null = null;
let _aad: Buffer | null = null;

export function decryptPII(encryptedBase64: string): string {
  assertConfigured();
  const decoded = Buffer.from(encryptedBase64, "base64");
  if (decoded.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted payload too short");
  }

  const iv = decoded.subarray(0, IV_LENGTH);
  const tag = decoded.subarray(decoded.length - TAG_LENGTH);
  const ciphertext = decoded.subarray(IV_LENGTH, decoded.length - TAG_LENGTH);

  const key = (_key ??= Buffer.from(KEY_B64, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD((_aad ??= Buffer.from(AAD)));
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf-8");
}

// null-safe 복호화. 토스가 null 을 내려준 필드는 그대로 null 반환.
export function decryptPIINullable(value: string | null): string | null {
  if (value == null) return null;
  try {
    return decryptPII(value);
  } catch (e) {
    console.error("[pii] decrypt failed:", e);
    return null;
  }
}
