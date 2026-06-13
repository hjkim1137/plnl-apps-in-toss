import {
  loadFullScreenAd,
  showFullScreenAd,
} from "@apps-in-toss/web-framework";

// 광고 — 전면형(interstitial) + 보상형(rewarded). (sajumon adInterstitial 일반화 + 보상형 신규)
//
// 앱인토스 SDK 는 두 종류 모두 같은 load/showFullScreenAd API 로 다루고, adGroupId 로 구분한다
// (콘솔에서 그룹을 전면형/보상형으로 설정). 시청 완료 판정만 다르다:
//   - interstitial: 노출(impression/show)이 한 번이라도 있었으면 닫을 때 적립.
//   - rewarded   : 'userEarnedReward' 이벤트가 와야 적립(30초 끝까지 시청). 기획 §5.4.
//
// 사용처(기획 §5.4):
//   전면형 → 출석(무료소진)·마일스톤 포인트·결산·표창장 열람
//   보상형 → 스트릭 보호권

export type AdKind = "interstitial" | "rewarded";

const GROUP_INTERSTITIAL = import.meta.env.VITE_AD_GROUP_ID_INTERSTITIAL ?? "";
const GROUP_REWARDED = import.meta.env.VITE_AD_GROUP_ID_REWARDED ?? "";

function groupIdFor(kind: AdKind): string {
  return kind === "rewarded" ? GROUP_REWARDED : GROUP_INTERSTITIAL;
}

export function isAdConfigured(kind: AdKind): boolean {
  return groupIdFor(kind).length > 0;
}

/** 광고 시청 결과. earned=true 면 보상 지급 대상. */
export type AdResult = { earned: boolean };

/**
 * 광고 load → show → (보상/노출) → dismissed 흐름을 Promise 로 래핑.
 * SDK 가 콜백 기반이라 cleanup(언리스너)도 함께 수행한다.
 *
 * @throws adGroupId 미설정 / 노출 실패(failedToShow) / SDK 에러.
 */
export function playAd(kind: AdKind): Promise<AdResult> {
  const adGroupId = groupIdFor(kind);
  const requireReward = kind === "rewarded";

  return new Promise<AdResult>((resolve, reject) => {
    if (!adGroupId) {
      reject(
        new Error(
          `ad group id not set (${kind}: ${
            requireReward
              ? "VITE_AD_GROUP_ID_REWARDED"
              : "VITE_AD_GROUP_ID_INTERSTITIAL"
          })`,
        ),
      );
      return;
    }

    // 노출/보상 이벤트가 한 번이라도 왔는지. dismissed 시점에 적립 여부 결정.
    let shown = false;
    let earnedReward = false;
    let loadUnregister: (() => void) | undefined;
    let showUnregister: (() => void) | undefined;
    let settled = false;

    const cleanup = () => {
      loadUnregister?.();
      showUnregister?.();
    };
    const finishOk = (result: AdResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const finishErr = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    try {
      loadUnregister = loadFullScreenAd({
        options: { adGroupId },
        onEvent: (data) => {
          if (data.type !== "loaded") return;
          try {
            showUnregister = showFullScreenAd({
              options: { adGroupId },
              onEvent: (showData) => {
                if (showData.type === "userEarnedReward") {
                  earnedReward = true;
                  shown = true;
                  return;
                }
                if (showData.type === "impression" || showData.type === "show") {
                  shown = true;
                  return;
                }
                if (showData.type === "failedToShow") {
                  finishErr(new Error("failedToShow"));
                  return;
                }
                if (showData.type === "dismissed") {
                  // 보상형은 userEarnedReward 필수, 전면형은 노출만으로 적립.
                  const earned = requireReward ? earnedReward : shown;
                  finishOk({ earned });
                }
              },
              onError: finishErr,
            });
          } catch (err) {
            finishErr(err);
          }
        },
        onError: finishErr,
      });
    } catch (err) {
      finishErr(err);
    }
  });
}
