import numpy as np
import pandas as pd
import streamlit as st
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, balanced_accuracy_score
)

st.set_page_config(page_title="ISL Guard | Digital Prototype", page_icon="💧", layout="wide")

# ----------------------------- CONSTANTS -----------------------------
SEED = 42
FEATURES = [
    "injection_m3h", "extraction_m3h", "injection_pressure_kpa",
    "extraction_pressure_kpa", "boundary_ph", "boundary_sulfate_mg_l",
    "groundwater_level_m", "gradient_proxy"
]

# ----------------------------- SYNTHETIC DATA -----------------------------
@st.cache_data
def generate_data(scenario: str, hours: int, seed: int) -> pd.DataFrame:
    """Generate illustrative synthetic data. Not a calibrated field model."""
    rng = np.random.default_rng(seed)
    t = pd.date_range("2026-11-01 00:00", periods=hours, freq="h")
    x = np.linspace(0, 1, hours)

    injection = 50 + rng.normal(0, 1.0, hours)
    extraction = 50 + rng.normal(0, 1.0, hours)
    p_in = 250 + rng.normal(0, 3, hours)
    p_out = 180 + rng.normal(0, 3, hours)
    ph = 7.1 + rng.normal(0, 0.08, hours)
    sulfate = 120 + rng.normal(0, 5, hours)
    gw = 10 + rng.normal(0, 0.03, hours)
    gradient = 1.0 + rng.normal(0, 0.025, hours)

    if scenario == "Debi dengesizliği":
        ramp = np.clip((x - 0.18) / 0.25, 0, 1)
        injection += 10 * ramp
        extraction -= 2 * ramp
        p_in += 18 * ramp
        gradient -= 0.35 * ramp
        ph -= 0.7 * ramp
        sulfate += 115 * ramp
    elif scenario == "Olası sınır etkisi":
        ramp = np.clip((x - 0.35) / 0.3, 0, 1)
        injection += 5 * ramp
        extraction += 1 * ramp
        gradient -= 0.55 * ramp
        ph -= 1.0 * ramp
        sulfate += 210 * ramp
        gw += 0.12 * ramp
    elif scenario == "Erken müdahale":
        ramp = np.clip((x - 0.2) / 0.18, 0, 1)
        injection += 9 * ramp
        extraction += 1 * ramp
        gradient -= 0.3 * ramp
        ph -= 0.45 * ramp
        sulfate += 75 * ramp
        # Illustrative response begins around 60% of the timeline.
        response = np.clip((x - 0.6) / 0.12, 0, 1)
        injection -= 7 * response
        extraction += 1.5 * response
        gradient += 0.22 * response
        ph += 0.28 * response
        sulfate -= 35 * response

    injection = np.clip(injection, 0, None)
    extraction = np.clip(extraction, 0, None)
    ph = np.clip(ph, 3.0, 10.0)
    sulfate = np.clip(sulfate, 0, None)
    gradient = np.clip(gradient, -1.0, 1.5)

    # Demonstration-only rule labels; these are not site safety limits.
    imbalance = injection - extraction
    risk_score = (
        0.30 * np.clip(imbalance / 12, 0, 1)
        + 0.25 * np.clip((7.0 - ph) / 2.5, 0, 1)
        + 0.25 * np.clip((sulfate - 150) / 250, 0, 1)
        + 0.20 * np.clip((0.65 - gradient) / 0.8, 0, 1)
    )
    risk_label = (risk_score >= 0.38).astype(int)

    return pd.DataFrame({
        "timestamp": t,
        "injection_m3h": injection,
        "extraction_m3h": extraction,
        "injection_pressure_kpa": p_in,
        "extraction_pressure_kpa": p_out,
        "boundary_ph": ph,
        "boundary_sulfate_mg_l": sulfate,
        "groundwater_level_m": gw,
        "gradient_proxy": gradient,
        "flow_imbalance_m3h": imbalance,
        "illustrative_risk_score": risk_score,
        "rule_based_risk_label": risk_label,
        "scenario": scenario,
    })

def train_and_score(df: pd.DataFrame):
    """Train on first 20% as a synthetic baseline; scores are relative anomaly scores."""
    X = df[FEATURES].replace([np.inf, -np.inf], np.nan).ffill().bfill()
    baseline_n = max(24, int(len(X) * 0.2))
    baseline = X.iloc[:baseline_n]
    model = IsolationForest(n_estimators=200, contamination=0.05, random_state=SEED)
    model.fit(baseline)
    anomaly_score = -model.decision_function(X)  # higher = more anomalous
    cutoff = float(np.quantile(anomaly_score.iloc[:baseline_n], 0.95))
    anomaly = (anomaly_score > cutoff).astype(int)
    return anomaly_score, anomaly, cutoff

def make_recommendation(row, anomaly: bool, risk_label: int, allowed_imbalance: float):
    target = min(float(row["injection_m3h"]), float(row["extraction_m3h"]) + allowed_imbalance)
    if risk_label or anomaly:
        action = "Yüksek öncelik: sentetik göstergeleri doğrula; debi/gradient eğilimini incele."
        if target < float(row["injection_m3h"]):
            action += f" Demo optimizasyonu enjeksiyonu {target:.1f} m³/h hedefiyle sınırlandırmayı öneriyor."
        action += " Operasyonel karar saha prosedürü ve yetkili uzman onayı gerektirir."
    else:
        action = "Belirgin demo alarm koşulu yok. İzlemeyi ve veri kalitesi kontrolünü sürdür."
    return target, action

# ----------------------------- UI -----------------------------
st.title("💧 ISL Guard")
st.subheader("ISL madenciliği için sentetik veri tabanlı izleme ve karar destek prototipi")
st.warning(
    "DİJİTAL PROTOTİP — Bu ekrandaki tüm veriler sentetiktir. "
    "Risk etiketleri gösterim amacıyla tanımlanmıştır; gerçek saha ölçümü, "
    "doğrulanmış hidrojeolojik model veya gerçek pompa kontrolü değildir."
)

with st.sidebar:
    st.header("Demo ayarları")
    scenario = st.selectbox(
        "Sanal saha senaryosu",
        ["Normal çalışma", "Debi dengesizliği", "Olası sınır etkisi", "Erken müdahale"],
        index=1
    )
    hours = st.slider("Simülasyon süresi (saat)", 72, 720, 240, 24)
    allowed_imbalance = st.slider("Demo için izin verilen debi farkı (m³/h)", 0.0, 10.0, 1.5, 0.5)
    ph_demo_threshold = st.slider("Demo pH uyarı eşiği", 4.0, 7.0, 6.0, 0.1)
    sulfate_demo_threshold = st.slider("Demo sülfat uyarı eşiği (mg/L)", 100, 500, 250, 10)
    gradient_demo_threshold = st.slider("Demo gradyan göstergesi alt eşiği", 0.0, 1.0, 0.65, 0.05)
    seed = st.number_input("Veri tohumu (aynı sonuçları yeniden üretir)", min_value=0, max_value=999999, value=SEED)

df = generate_data(scenario, int(hours), int(seed))
anomaly_score, anomaly_flag, anomaly_cutoff = train_and_score(df)

# User-adjustable illustrative rule flags; explicitly demo-only.
df["demo_rule_alert"] = (
    (df["flow_imbalance_m3h"] > allowed_imbalance)
    | (df["boundary_ph"] < ph_demo_threshold)
    | (df["boundary_sulfate_mg_l"] > sulfate_demo_threshold)
    | (df["gradient_proxy"] < gradient_demo_threshold)
).astype(int)
df["ai_anomaly"] = anomaly_flag.to_numpy()
df["combined_alert"] = ((df["demo_rule_alert"] == 1) | (df["ai_anomaly"] == 1)).astype(int)
df["anomaly_score"] = anomaly_score.to_numpy()

latest = df.iloc[-1]
target_injection, recommendation = make_recommendation(
    latest, bool(latest["ai_anomaly"]), int(latest["demo_rule_alert"]), allowed_imbalance
)
alert_hours = int(df["combined_alert"].sum())
rule_hours = int(df["demo_rule_alert"].sum())
ai_hours = int(df["ai_anomaly"].sum())

# Session-state simulation controls: explicitly simulated, no external system is controlled.
if "simulated_stop" not in st.session_state:
    st.session_state.simulated_stop = False
if "event_log" not in st.session_state:
    st.session_state.event_log = []

c1, c2, c3, c4 = st.columns(4)
c1.metric("Senaryo", scenario)
c2.metric("Birleşik uyarı görülen saat", f"{alert_hours}/{len(df)}")
c3.metric("AI anomali işareti", f"{ai_hours} saat")
c4.metric("Son kayıt risk puanı", f"{latest['illustrative_risk_score']:.2f}")

tabs = st.tabs(["Canlı görünüm", "Senaryo analizi", "Veri ve model", "Müdahale simülasyonu"])

with tabs[0]:
    st.markdown("### Son sentetik kayıt")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Enjeksiyon", f"{latest['injection_m3h']:.1f} m³/h")
    m2.metric("Ekstraksiyon", f"{latest['extraction_m3h']:.1f} m³/h")
    m3.metric("Sınır pH", f"{latest['boundary_ph']:.2f}")
    m4.metric("Sınır sülfat", f"{latest['boundary_sulfate_mg_l']:.0f} mg/L")

    if int(latest["combined_alert"]):
        st.error("Demo uyarısı: Son kayıtta en az bir kural veya AI anomali göstergesi tetiklendi.")
    else:
        st.success("Son sentetik kayıtta birleşik uyarı tetiklenmedi.")

    st.markdown("### AI destekli karar desteği")
    st.info(recommendation)
    st.caption(
        f"Son kayıt AI anomali skoru: {latest['anomaly_score']:.4f}; "
        f"sentetik baseline %95 eşiği: {anomaly_cutoff:.4f}. "
        "Skor, gerçek sızıntı olasılığı değildir."
    )

    chart_df = df.tail(min(120, len(df))).set_index("timestamp")
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(chart_df.index, chart_df["injection_m3h"], label="Enjeksiyon (m³/h)")
    ax.plot(chart_df.index, chart_df["extraction_m3h"], label="Ekstraksiyon (m³/h)")
    ax.set_ylabel("Debi (m³/h)")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(chart_df.index, chart_df["boundary_ph"], label="Sınır pH")
    ax.axhline(ph_demo_threshold, linestyle="--", label="Demo pH eşiği")
    ax.set_ylabel("pH (birimsiz)")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

with tabs[1]:
    st.markdown("### Senaryo performans göstergeleri")
    st.write(
        "Buradaki sayımlar sentetik senaryodaki demo kurallarının ve modelin davranışını özetler; "
        "gerçek saha başarı oranı veya doğruluk iddiası değildir."
    )
    k1, k2, k3 = st.columns(3)
    k1.metric("Kural tabanlı uyarı", f"{rule_hours} saat")
    k2.metric("AI anomali işareti", f"{ai_hours} saat")
    k3.metric("Birleşik uyarı", f"{alert_hours} saat")

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(df["timestamp"], df["gradient_proxy"], label="Gradyan göstergesi")
    ax.axhline(gradient_demo_threshold, linestyle="--", label="Demo alt eşiği")
    ax.set_ylabel("Gösterge (sentetik)")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(df["timestamp"], df["boundary_sulfate_mg_l"], label="Sınır sülfat (mg/L)")
    ax.axhline(sulfate_demo_threshold, linestyle="--", label="Demo eşiği")
    ax.set_ylabel("Sülfat (mg/L, sentetik)")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

with tabs[2]:
    st.markdown("### Model ve veri açıklaması")
    st.write("**Veri kaynağı:** uygulama içinde üretilen sentetik veri; dış sensör/veritabanı bağlantısı yok.")
    st.write("**Anomali modeli:** Isolation Forest; ilk %20'lik bölüm sentetik baseline kabul edilir.")
    st.write("**Kural katmanı:** debi farkı, pH, sülfat ve gradyan göstergesi için kullanıcı tarafından ayarlanabilen demo eşikleri.")
    st.write("**Birleşik alarm:** kural tabanlı uyarı veya AI anomali işareti.")
    st.write("**Önemli:** AI anomali işareti, risk etiketiyle aynı şey değildir; model çıktısı olasılık olarak yorumlanmamalıdır.")
    st.markdown("### Son kayıtlar")
    st.dataframe(df.tail(20), use_container_width=True)
    csv = df.to_csv(index=False).encode("utf-8-sig")
    st.download_button("Sentetik veri setini CSV indir", data=csv, file_name="isl_guard_synthetic_demo.csv", mime="text/csv")
    st.markdown("### Basit model değerlendirmesi")
    st.write(
        "Bu demo için gerçek ve bağımsız saha etiketleri bulunmadığından "
        "accuracy/precision/recall gibi metrikler gerçek performans kanıtı olarak sunulamaz. "
        "Bunun yerine senaryo davranışı ve uyarıların zamanlaması test edilmelidir."
    )

with tabs[3]:
    st.markdown("### Müdahale simülasyonu")
    st.write("Bu bölüm gerçek ekipmanı durdurmaz; yalnızca arayüz içindeki sanal durumu değiştirir.")
    if st.session_state.simulated_stop:
        st.error("SANAL DURDURMA ETKİN")
        st.write("Demo durum: simülasyon operatör tarafından durduruldu.")
        if st.button("Sanal sistemi yeniden başlat"):
            st.session_state.simulated_stop = False
            st.session_state.event_log.append({"time": pd.Timestamp.now(), "event": "Sanal sistem yeniden başlatıldı"})
            st.rerun()
    else:
        st.success("Sanal sistem çalışıyor.")
        col_a, col_b = st.columns(2)
        with col_a:
            if st.button("🛑 Sanal durdurmayı uygula", type="primary", use_container_width=True):
                st.session_state.simulated_stop = True
                st.session_state.event_log.append({"time": pd.Timestamp.now(), "event": "Sanal durdurma uygulandı"})
                st.rerun()
        with col_b:
            if st.button("Müdahale önerisini olay günlüğüne ekle", use_container_width=True):
                st.session_state.event_log.append({"time": pd.Timestamp.now(), "event": recommendation})
                st.rerun()
    st.markdown("### Müdahale sonrası senaryo değerlendirmesi")
    st.write(f"Son enjeksiyon: **{latest['injection_m3h']:.1f} m³/h**")
    st.write(f"Demo hedef enjeksiyon: **{target_injection:.1f} m³/h**")
    st.write(
        "Hedef yalnızca injection ≤ extraction + izin verilen fark kısıtına göre hesaplanır. "
        "Bu, doğrulanmış saha optimizasyonu değildir."
    )
    if st.session_state.event_log:
        st.dataframe(pd.DataFrame(st.session_state.event_log), use_container_width=True)
        if st.button("Olay günlüğünü temizle"):
            st.session_state.event_log = []
            st.rerun()
    else:
        st.caption("Henüz olay kaydı yok.")

st.divider()
st.caption("ISL Guard dijital prototip | Sentetik veriler | Karar destek demosu; saha güvenlik sistemi değildir.")
