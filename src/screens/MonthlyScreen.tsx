import type { PlnlController } from "../hooks/usePlnl";
import { NOTIFY_COPY } from "../lib/content";
import { won } from "../lib/format";
import { useToast } from "@toss/tds-mobile";

// ── 월간 현황 탭 ─────────────────────────────────────────────────────────
// TODO(인정/A): TDS 컴포넌트로 교체. 데이터/액션은 plnl 그대로 사용.

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", marginBottom: 20, boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
      {children}
    </div>
  );
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export function MonthlyScreen({ plnl, onOpenLogin }: { plnl: PlnlController; onOpenLogin: () => void }) {
  const { monthly, selectableMonths, actions, state, notif, view } = plnl;
  const { openToast } = useToast();
  const s = monthly.stats;

  return (
    <div>
      {/* 표창장 도착 알림 (로그인 + 월말) */}
      {monthly.showNotif && (
        <div style={{ background: "linear-gradient(135deg,#fff3d6,#ffe7a8)", border: "1px solid #ffdb87", borderRadius: 14, padding: 13, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#8a5b00" }}>
            {NOTIFY_COPY.arrivalTitle(`${monthly.year}년 ${monthly.monthLabel}`)}
          </div>
          {/* 다음 달부터 도착 알림 받기 (F17 알림 동의) */}
          {notif.canPrompt && (
            <button
              onClick={() => actions.enableNotifications()}
              style={{ marginTop: 10, padding: "8px 12px", border: "1px solid #ffdb87", borderRadius: 10, background: "#fff", color: "#b07a00", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              {NOTIFY_COPY.enableCta}
            </button>
          )}
        </div>
      )}

      {/* 요약 */}
      <Card>
        <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>
          📈 {monthly.year}년 {monthly.monthLabel} 요약
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat k="낸 돈" v={won(s.fee)} />
          <Stat k="출석 / 목표" v={`${s.done} / ${s.target}회`} />
          <Stat k="회수한 금액" v={won(s.recovered)} color="#15b877" />
          {s.rate >= 100 ? (
            <Stat k="초과 회수액" v={`+${won(s.over)}`} color={monthly.bracket.barColor} />
          ) : (
            <Stat k="기부한 금액" v={won(s.donate)} color="#f04452" />
          )}
        </div>
      </Card>

      {/* 월 이동 (달력 위) */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => actions.shiftMonth(-1)} style={navBtn}>‹</button>
        <div style={{ position: "relative" }}>
          <select
            value={`${monthly.year}-${monthly.month}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              actions.goToMonth(y, m);
            }}
            style={{ appearance: "none", WebkitAppearance: "none", padding: "9px 30px 9px 16px", borderRadius: 12, border: "none", fontWeight: 800, fontSize: 15, boxShadow: "0 1px 2px rgba(0,0,0,.06)", cursor: "pointer", fontFamily: "inherit", color: "#191f28" }}
          >
            {selectableMonths.map((o) => (
              <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{o.label}</option>
            ))}
          </select>
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#b0b8c1", fontSize: 12, pointerEvents: "none" }}>▾</span>
        </div>
        <button onClick={() => actions.shiftMonth(1)} disabled={monthly.isCurrent} style={navBtn}>›</button>
      </div>

      {/* 달력 */}
      <Card>
        <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>
          🗓️ 출석 달력 <small>(날짜를 눌러 직접 기록)</small>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 6 }}>
          {DOW.map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "#f0808a" : "#b0b8c1" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
          {monthly.calendar.map((cell, i) =>
            cell.day === 0 ? (
              <div key={`e${i}`} />
            ) : (
              <button
                key={cell.dateStr}
                disabled={cell.isFuture}
                onClick={() => actions.cycleDay(cell.dateStr)}
                title={cell.isFrozen ? "🛡️ 보호권으로 지킨 날" : undefined}
                style={{
                  position: "relative",
                  aspectRatio: "1", border: cell.isToday ? "2px solid #5DC528" : "none", borderRadius: 9,
                  fontSize: 12.5, fontWeight: cell.value ? 800 : 600,
                  // 보호된 날(빠졌지만 보호권으로 메움)은 done/missed 색 대신 보호 톤으로.
                  background: cell.isFrozen ? "#eaf2ff" : cell.value === "done" ? "#e7f9f1" : cell.value === "missed" ? "#fdeced" : "#f2f4f6",
                  color: cell.isFrozen ? "#5DC528" : cell.value === "done" ? "#15b877" : cell.value === "missed" ? "#f04452" : "#8b95a1",
                  opacity: cell.isFuture ? 0.3 : 1,
                }}
              >
                {cell.day}
                {cell.isFrozen && (
                  <span style={{ position: "absolute", top: 1, right: 2, fontSize: 9 }}>🛡️</span>
                )}
                {!cell.isFrozen && cell.value === "done" && (
                  <span style={{ position: "absolute", bottom: 1, right: 2, fontSize: 9 }}>💪</span>
                )}
                {!cell.isFrozen && cell.value === "missed" && (
                  <span style={{ position: "absolute", bottom: 1, right: 2, fontSize: 9 }}>💸</span>
                )}
              </button>
            ),
          )}
        </div>
        {/* 달력 범례 */}
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7684", margin: "10px 0 4px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 4, background: "#e7f9f1", display: "inline-block" }} />
            운동함 💪
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 4, background: "#fdeced", display: "inline-block" }} />
            못 감 💸
          </span>
        </div>
        <button
          onClick={() => actions.clearMonth(monthly.year, monthly.month)}
          style={{ width: "100%", marginTop: 8, padding: 13, border: "1px solid #e5e8eb", borderRadius: 13, background: "#fff", color: "#6b7684", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          이번 달 기록 초기화
        </button>
      </Card>

      {/* 월간 결산 (로그인 + 월말 + 광고) */}
      {!state.loggedIn ? (
        <LockCard emoji="📊" title="월간 결산 리포트" desc="한 달이 끝나면 이번 달 운동 성적표가 나와요" onLogin={onOpenLogin} />
      ) : !monthly.monthEnded ? (
        <Card>
          <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>📊 월간 결산 리포트</p>
          <p style={{ fontSize: 13, color: "#8b95a1", marginBottom: 14 }}>
            이번 달이 끝나면 결산이 만들어져요 · D-{monthly.daysLeft}
          </p>
          <button onClick={() => actions.togglePreview()} style={{ ...ghostBtn, marginTop: 8 }}>🔔 월말 도착 미리보기</button>
        </Card>
      ) : !monthly.reportUnlocked ? (
        <Card>
          <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>📊 월간 결산 리포트</p>
          <button onClick={() => { actions.watchReportAd().then((r) => { if (r.ok) openToast("결산 리포트가 도착했어요"); }); }} style={fullBtn}>📺 광고 보고 결산 보기</button>
        </Card>
      ) : (
        <Card>
          <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>
            📊 {monthly.report.year}년 {monthly.report.monthLabel} 결산 리포트
          </p>
          {/* 등급 헤더 */}
          <div style={{
            background: monthly.bracket.bgGradient,
            borderRadius: 14, padding: "14px 16px", marginBottom: 14, color: "#fff",
          }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>{monthly.bracket.emoji}</div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4 }}>
              {monthly.bracket.label} · 회수율 {monthly.report.rate}%
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4 }}>
              한 줄 총평: {monthly.report.grade}
            </div>
          </div>
          <Line k="출석 / 목표" v={`${monthly.report.done} / ${monthly.report.target}회`} />
          <Line k="최장 연속 출석" v={`${monthly.report.maxStreak}일 🔥`} />
          <Line k="회수한 금액" v={won(monthly.report.recovered)} color="#15b877" />
          {monthly.report.graduated ? (
            <Line k="초과 회수액" v={`+${won(monthly.report.over)}`} color={monthly.bracket.barColor} />
          ) : (
            <Line k="기부한 금액" v={won(monthly.report.donate)} color="#f04452" />
          )}
          <Line k="다음 달 추천 목표" v={`${monthly.report.nextTargetRecommendation}회`} />
        </Card>
      )}

      {/* 표창장 */}
      {!state.loggedIn ? (
        <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: "0 1px 2px rgba(0,0,0,.04)", position: "relative", overflow: "hidden" }}>
          <p style={{ fontWeight: 700, color: "#6b7684", marginTop: 0 }}>🏅 표창장</p>
          {/* 블러 — 실제 표창장 텍스트를 흐리게 보여줘 호기심 유발 */}
          <div style={{ filter: "blur(3px)", opacity: 0.55, pointerEvents: "none", userSelect: "none" }}>
            <div style={{ border: "2px solid #ffb800", borderRadius: 16, padding: "24px 20px 22px", textAlign: "center", background: "linear-gradient(180deg,#fffdf5,#fff8e6)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#a06800", letterSpacing: 2, marginBottom: 14 }}>헬스장 후원 표창장</div>
              <div style={{ fontSize: 14, color: "#333d4b", lineHeight: 1.7, fontWeight: 600 }}>
                회원님께서는 이번 달 금 ●●●●원을<br />아낌없이 기부하셨기에<br />이 상장을 수여합니다 👑
              </div>
            </div>
          </div>
          {/* 베일 오버레이 */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.55)", borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 26 }}>🔒</div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#333d4b" }}>표창장은 토스 로그인 후 받을 수 있어요</div>
            <div style={{ fontSize: 11.5, color: "#8b95a1", lineHeight: 1.4 }}>한 달 출석 기록으로 나만의 표창장이 만들어져요</div>
            <button onClick={onOpenLogin} style={{ marginTop: 6, background: "#5DC528", color: "#fff", border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              토스 로그인하고 표창장 받기
            </button>
          </div>
        </div>
      ) : !monthly.monthEnded ? (
        <Card>
          <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>🏅 표창장</p>
          <p style={{ fontSize: 13, color: "#8b95a1" }}>
            {monthly.monthLabel} 말에 표창장이 도착해요 · D-{monthly.daysLeft}
          </p>
        </Card>
      ) : !monthly.certUnlocked ? (
        <Card>
          <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>🏅 표창장</p>
          <button onClick={() => { actions.watchCertAd().then((r) => { if (r.ok) openToast("표창장이 열렸어요"); }); }} style={fullBtn}>📺 광고 보고 표창장 보기</button>
        </Card>
      ) : (
        <Card>
          <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>
            🏅 {monthly.year}년 {monthly.monthLabel} 표창장 <small style={{ color: "#b0b8c1", fontWeight: 500 }}>(스샷 공유용)</small>
          </p>
          {/* 표창장 카드 */}
          <div style={{ position: "relative", marginBottom: 14, marginTop: 24 }}>
            {/* 상단 메달 */}
            <div style={{
              position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
              background: "#fff", padding: "0 6px", borderRadius: "50%",
              fontSize: 28, lineHeight: 1, zIndex: 1,
            }}>🏅</div>
            <div style={{
              border: "2px solid #ffb800", borderRadius: 16,
              padding: "28px 20px 22px", textAlign: "center",
              background: "linear-gradient(180deg,#fffdf5,#fff8e6)",
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#a06800", letterSpacing: 2, marginBottom: 14 }}>
                {monthly.certificate.text.title}
              </div>
              <div
                style={{ fontSize: 14, color: "#333d4b", lineHeight: 1.7, fontWeight: 600 }}
                dangerouslySetInnerHTML={{ __html: monthly.certificate.text.body }}
              />
              <div style={{ fontSize: 12.5, color: "#8b95a1", marginTop: 14, fontWeight: 600 }}>
                — {monthly.year}.{String(monthly.month + 1).padStart(2, "0")} 뺄래낼래 —
              </div>
            </div>
          </div>
          {/* 공유 문구 박스 */}
          <div style={{
            background: "#f9fafb", border: "1px solid #f2f4f6",
            borderRadius: 14, padding: 16, fontSize: 14,
            whiteSpace: "pre-line", color: "#4e5968", lineHeight: 1.7,
            fontWeight: 500, marginBottom: 12,
          }}>
            {monthly.certificate.text.share}
          </div>
          <button onClick={() => copyShareText(monthly.certificate.text.share)} style={primaryBtn}>
            공유 문구 복사하기
          </button>
          {view.previewEnd && monthly.isCurrent && (
            <button onClick={() => actions.togglePreview()} style={{ ...ghostBtn, marginTop: 8 }}>
              미리보기 끄기
            </button>
          )}
        </Card>
      )}
    </div>
  );
}

function copyShareText(text: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => alert("복사:\n\n" + text));
  } else {
    alert("복사:\n\n" + text);
  }
}

const navBtn: React.CSSProperties = { border: "none", background: "#fff", width: 34, height: 34, borderRadius: 10, fontSize: 16, boxShadow: "0 1px 2px rgba(0,0,0,.06)", color: "#4e5968", cursor: "pointer", fontFamily: "inherit" };
const fullBtn: React.CSSProperties = { width: "100%", padding: 14, border: "none", borderRadius: 14, fontWeight: 800, background: "#5DC528", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 15 };
const primaryBtn: React.CSSProperties = { width: "100%", padding: 14, border: "none", borderRadius: 14, fontWeight: 800, background: "#3182f6", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 15 };
const ghostBtn: React.CSSProperties = { width: "100%", padding: 12, border: "1px solid #e5e8eb", borderRadius: 13, background: "#fff", color: "#6b7684", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 };

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #f2f4f6", borderRadius: 14, padding: 13 }}>
      <div style={{ fontSize: 12, color: "#8b95a1", fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? "#191f28" }}>{v}</div>
    </div>
  );
}

function Line({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "9px 0", borderBottom: "1px solid #f2f4f6" }}>
      <span style={{ color: "#6b7684" }}>{k}</span>
      <span style={{ fontWeight: 800, color: color ?? "#191f28" }}>{v}</span>
    </div>
  );
}

function LockCard({ emoji, title, desc, onLogin }: { emoji: string; title: string; desc: string; onLogin: () => void }) {
  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: "0 1px 2px rgba(0,0,0,.04)", position: "relative", overflow: "hidden" }}>
      <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>{emoji} {title}</p>
      {/* 블러 플레이스홀더 */}
      <div style={{ filter: "blur(4px)", opacity: 0.5, pointerEvents: "none", userSelect: "none" }}>
        <div style={{ height: 54, background: "#f2f4f6", borderRadius: 12, marginBottom: 8 }} />
        <div style={{ height: 14, width: "60%", background: "#f2f4f6", borderRadius: 6 }} />
      </div>
      {/* 베일 오버레이 */}
      <div style={{
        position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)",
        borderRadius: 18, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 6, padding: 16, textAlign: "center",
      }}>
        <div style={{ fontSize: 26 }}>🔒</div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#333d4b" }}>{title} · 로그인 전용</div>
        <div style={{ fontSize: 11.5, color: "#8b95a1", lineHeight: 1.4 }}>{desc}</div>
        <button
          onClick={onLogin}
          style={{ marginTop: 6, background: "#5DC528", color: "#fff", border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
        >
          토스 로그인하기
        </button>
      </div>
    </div>
  );
}
