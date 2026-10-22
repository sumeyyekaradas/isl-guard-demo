
import time
import numpy as np
import pandas as pd
import streamlit as st
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest

st.set_page_config(
    page_title="ISL Guard | Digital Prototype",
    page_icon="💧",
    layout="wide"
)

SEED = 42
FEATURES = [
    "injection_m3h", "extraction_m3h",
    "injection_pressure_kpa", "extraction_pressure_kpa",
    "boundary_ph", "boundary_sulfate_mg_l",
    "groundwater_level_m", "gradient_proxy"
]
SCENARIOS = [
    "Normal çalışma",
    "Debi dengesizliği",
    "Olası sınır etkisi",
    "Erken müdahale"
]


# --------------------------------------------------
# 1. SENTETİK VERİ ÜRETİMİ
# --------------------------------------------------
@st.cache_data
def generate_data(scenario, hours, seed):
    rng = np.random.default_rng(seed)
    timestamps = pd.date_range(
        "2026-11-01", periods=hours, freq="h"
    )
    x = np.linspace(0, 1, hours)

    injection = 50 + rng.normal(0, 1, hours)
    extraction = 50 + rng.normal(0, 1, hours)
    p_in = 250 + rng.normal(0, 3, hours)
    p_out = 180 + rng.normal(0, 3, hours)
    ph = 7.1 + rng.normal(0, 0.08, hours)
    sulfate = 120 + rng.normal(0, 5, hours)
    groundwater = 10 + rng.normal(0, 0.03, hours)
    gradient = 1 + rng.normal(0, 0.025, hours)

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
        extraction += ramp
        gradient -= 0.55 * ramp
        ph -= ramp
        sulfate += 210 * ramp
        groundwater += 0.12 * ramp

    elif scenario == "Erken müdahale":
        ramp = np.clip((x - 0.2) / 0.18, 0, 1)
        injection += 9 * ramp
        extraction += ramp
        gradient -= 0.3 * ramp
        ph -= 0.45 * ramp
        sulfate += 75 * ramp

        response = np.clip((x - 0.6) / 0.12, 0, 1)
        injection -= 7 * response
        extraction += 1.5 * response
        gradient += 0.22 * response
        ph += 0.28 * response
        sulfate -= 35 * response

    injection = np.clip(injection, 0, None)
    extraction = np.clip(extraction, 0, None)
    ph = np.clip(ph, 3, 10)
    sulfate = np.clip(sulfate, 0, None)
    gradient = np.clip(gradient, -1, 1.5)

    imbalance = injection - extraction

    risk_score = (
        0.30 * np.clip(imbalance / 12, 0, 1)
        + 0.25 * np.clip((7 - ph) / 2.5, 0, 1)
        + 0.25 * np.clip((sulfate - 150) / 250, 0, 1)
        + 0.20 * np.clip((0.65 - gradient) / 0.8, 0, 1)
    )

    return pd.DataFrame({
        "timestamp": timestamps,
        "injection_m3h": injection,
        "extraction_m3h": extraction,
        "injection_pressure_kpa": p_in,
        "extraction_pressure_kpa": p_out,
        "boundary_ph": ph,
        "boundary_sulfate_mg_l": sulfate,
        "groundwater_level_m": groundwater,
        "gradient_proxy": gradient,
        "flow_imbalance_m3h": imbalance,
        "illustrative_risk_score": risk_score,
        "scenario": scenario
    })


# --------------------------------------------------
# 2. AI ANOMALİ ANALİZİ
# --------------------------------------------------
def train_and_score(df):
    X = df[FEATURES].replace(
        [np.inf, -np.inf], np.nan
    ).ffill().bfill()

    baseline_n = min(
        len(X), max(24, int(len(X) * 0.2))
    )
    baseline = X.iloc[:baseline_n]

    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=SEED
    )
    model.fit(baseline)

    scores = -model.decision_function(X)
    cutoff = float(np.quantile(scores[:baseline_n], 0.95))
    flags = (scores > cutoff).astype(int)

    return scores, flags, cutoff


def add_alerts(df, allowed_imbalance, ph_limit,
               sulfate_limit, gradient_limit):
    result = df.copy()

    result["demo_rule_alert"] = (
        (result["flow_imbalance_m3h"] > allowed_imbalance)
        | (result["boundary_ph"] < ph_limit)
        | (result["boundary_sulfate_mg_l"] > sulfate_limit)
        | (result["gradient_proxy"] < gradient_limit)
    ).astype(int)

    scores, flags, cutoff = train_and_score(result)
    result["anomaly_score"] = scores
    result["ai_anomaly"] = flags
    result["combined_alert"] = (
        (result["demo_rule_alert"] == 1)
        | (result["ai_anomaly"] == 1)
    ).astype(int)

    return result, cutoff


def recommendation(row, allowed_imbalance):
    target = min(
        float(row["injection_m3h"]),
        float(row["extraction_m3h"]) + allowed_imbalance
    )

    if int(row["combined_alert"]):
        message = (
            "Öncelikli inceleme önerilir. Debi, pH, sülfat ve "
            "gradyan göstergelerini doğrula."
        )
        if target < float(row["injection_m3h"]):
            message += (
                f" Demo optimizasyonu enjeksiyon için "
                f"{target:.1f} m³/h hedefini hesaplıyor."
            )
        message += (
            " Bu öneri gerçek pompa kontrolü değildir; "
            "saha kararı uzman onayı gerektirir."
        )
    else:
        message = (
            "Son kayıtta belirgin demo kuralı tetiklenmedi. "
            "İzleme ve veri kalitesi kontrolü sürdürülmeli."
        )

    return target, message


# --------------------------------------------------
# 3. BAŞLIK VE AYARLAR
# --------------------------------------------------
st.title("💧 ISL Guard")
st.subheader(
    "ISL madenciliği için sentetik veri tabanlı "
    "izleme ve karar destek prototipi"
)
st.warning(
    "Bu prototip sentetik verilerle çalışır. Gerçek sensör "
    "bağlantısı, doğrulanmış saha modeli veya fiziksel pompa "
    "kontrolü içermez. Eşikler gösterim amaçlıdır."
)

with st.sidebar:
    st.header("Demo ayarları")
    scenario = st.selectbox("Sanal saha senaryosu", SCENARIOS, index=1)
    hours = st.slider("Simülasyon süresi (saat)", 72, 720, 240, 24)
    allowed_imbalance = st.slider(
        "İzin verilen demo debi farkı (m³/h)",
        0.0, 10.0, 1.5, 0.5
    )
    ph_limit = st.slider("Demo pH uyarı eşiği", 4.0, 7.0, 6.0, 0.1)
    sulfate_limit = st.slider(
        "Demo sülfat uyarı eşiği (mg/L)",
        100, 500, 250, 10
    )
    gradient_limit = st.slider(
        "Demo gradyan alt eşiği", 0.0, 1.0, 0.65, 0.05
    )
    seed = st.number_input(
        "Veri tohumu", min_value=0, max_value=999999,
        value=SEED
    )
    countdown_seconds = st.slider(
        "Operatör yanıt süresi (saniye)",
        5, 60, 15, 5
    )

df = generate_data(scenario, int(hours), int(seed))
df, anomaly_cutoff = add_alerts(
    df, allowed_imbalance, ph_limit,
    sulfate_limit, gradient_limit
)

latest = df.iloc[-1]
target_injection, advice = recommendation(
    latest, allowed_imbalance
)

# --------------------------------------------------
# 4. OTURUM DURUMU VE OLAY GÜNLÜĞÜ
# --------------------------------------------------
if "simulated_stop" not in st.session_state:
    st.session_state.simulated_stop = False
if "event_log" not in st.session_state:
    st.session_state.event_log = []
if "alert_deadline" not in st.session_state:
    st.session_state.alert_deadline = None
if "operator_ack" not in st.session_state:
    st.session_state.operator_ack = False
if "alert_signature" not in st.session_state:
    st.session_state.alert_signature = None

# Her senaryo/veri ayarı değiştiğinde yeni demo alarmı ele alınır.
signature = (
    scenario, int(hours), int(seed),
    float(allowed_imbalance), float(ph_limit),
    float(sulfate_limit), float(gradient_limit)
)
if signature != st.session_state.alert_signature:
    st.session_state.alert_signature = signature
    st.session_state.alert_deadline = None
    st.session_state.operator_ack = False

tabs = st.tabs([
    "Canlı görünüm",
    "Tracer testi",
    "Senaryo analizi",
    "Veri ve model",
    "Müdahale simülasyonu"
])


# --------------------------------------------------
# 5. CANLI GÖRÜNÜM VE GERİ SAYIMLI SANAL DURDURMA
# --------------------------------------------------
with tabs[0]:
    st.markdown("### Son sentetik kayıt")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Enjeksiyon", f"{latest['injection_m3h']:.1f} m³/h")
    c2.metric("Ekstraksiyon", f"{latest['extraction_m3h']:.1f} m³/h")
    c3.metric("Sınır pH", f"{latest['boundary_ph']:.2f}")
    c4.metric(
        "Sınır sülfat",
        f"{latest['boundary_sulfate_mg_l']:.0f} mg/L"
    )

    c1, c2, c3 = st.columns(3)
    c1.metric("Birleşik uyarı", f"{int(df['combined_alert'].sum())} saat")
    c2.metric("AI anomali işareti", f"{int(df['ai_anomaly'].sum())} saat")
    c3.metric(
        "Son kayıt demo risk puanı",
        f"{latest['illustrative_risk_score']:.2f}"
    )

    st.info(advice)
    st.caption(
        f"AI anomali skoru: {latest['anomaly_score']:.4f}; "
        f"sentetik baseline eşiği: {anomaly_cutoff:.4f}. "
        "Bu skor gerçek sızıntı olasılığı değildir."
    )

    if int(latest["combined_alert"]) == 1:
        st.error("Demo alarmı: Son kayıt için bir uyarı koşulu tetiklendi.")
    else:
        st.success("Son kayıtta birleşik demo alarmı tetiklenmedi.")
        st.session_state.alert_deadline = None
        st.session_state.operator_ack = False

    st.markdown("### Operatör yanıtı ve sanal durdurma")
    st.write(
        "Bu mekanizma yalnızca uygulama içindeki sanal durumu değiştirir. "
        "Gerçek ekipmana komut göndermez."
    )

    if st.session_state.simulated_stop:
        st.error("🛑 SANAL DURDURMA ETKİN")
        if st.button("Sanal sistemi yeniden başlat"):
            st.session_state.simulated_stop = False
            st.session_state.alert_deadline = None
            st.session_state.operator_ack = False
            st.session_state.event_log.append({
                "time": pd.Timestamp.now(),
                "event": "Sanal sistem yeniden başlatıldı"
            })
            st.rerun()
    elif int(latest["combined_alert"]) == 1:
        if st.session_state.alert_deadline is None and not st.session_state.operator_ack:
            st.session_state.alert_deadline = (
                time.time() + countdown_seconds
            )

        if st.session_state.operator_ack:
            st.success("Operatör demo alarmını aldığını bildirdi.")
            if st.button("Sanal durdurmayı uygula"):
                st.session_state.simulated_stop = True
                st.session_state.event_log.append({
                    "time": pd.Timestamp.now(),
                    "event": "Operatör yanıtından sonra sanal durdurma"
                })
                st.rerun()
        else:
            @st.fragment(run_every="1s")
            def operator_countdown():
                if st.session_state.simulated_stop:
                    st.error("Sanal durdurma etkin.")
                    return

                deadline = st.session_state.alert_deadline
                if deadline is None:
                    return

                remaining = max(0, int(np.ceil(deadline - time.time())))

                if remaining <= 0:
                    st.session_state.simulated_stop = True
                    st.session_state.alert_deadline = None
                    st.session_state.event_log.append({
                        "time": pd.Timestamp.now(),
                        "event": (
                            "Operatör yanıtı gelmedi; "
                            "otomatik sanal durdurma"
                        )
                    })
                    st.error(
                        "Yanıt süresi doldu. Otomatik sanal durdurma uygulandı."
                    )
                    st.rerun()
                    return

                st.warning(
                    f"Operatör yanıtı bekleniyor: {remaining} saniye"
                )
                if st.button("Uyarıyı aldım — operatör yanıtı", key="ack_alert"):
                    st.session_state.operator_ack = True
                    st.session_state.alert_deadline = None
                    st.session_state.event_log.append({
                        "time": pd.Timestamp.now(),
                        "event": "Operatör demo alarmını onayladı"
                    })
                    st.rerun()

            operator_countdown()
    else:
        st.success("Aktif son-kayıt alarmı yok.")

    chart = df.tail(min(120, len(df))).set_index("timestamp")

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(chart.index, chart["injection_m3h"], label="Enjeksiyon")
    ax.plot(chart.index, chart["extraction_m3h"], label="Ekstraksiyon")
    ax.set_ylabel("Debi (m³/h)")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(chart.index, chart["boundary_ph"], label="Sınır pH")
    ax.axhline(ph_limit, linestyle="--", label="Demo pH eşiği")
    ax.set_ylabel("pH")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)


# --------------------------------------------------
# 6. TRACER TESTİ
# --------------------------------------------------
with tabs[1]:
    st.markdown("### 🧪 Tracer testi ve kırılma eğrisi")
    st.write(
        "Bu modül, sentetik izleyici madde konsantrasyonunu analiz eder. "
        "Eğri gerçek saha ölçümü değildir."
    )

    a, b, c = st.columns(3)
    with a:
        duration = st.slider(
            "Test süresi (saat)", 24, 240, 72, 12,
            key="tracer_duration"
        )
    with b:
        peak_setting = st.slider(
            "Sentetik tepe zamanı (saat)", 2, 120, 24,
            key="tracer_peak"
        )
    with c:
        spread = st.slider(
            "Eğri yayılımı", 2.0, 30.0, 8.0, 1.0,
            key="tracer_spread"
        )

    tracer_rng = np.random.default_rng(int(seed) + 100)
    tracer_time = np.arange(duration, dtype=float)
    tracer_concentration = np.exp(
        -0.5 * ((tracer_time - peak_setting) / spread) ** 2
    )
    tracer_concentration += tracer_rng.normal(0, 0.008, duration)
    tracer_concentration = np.clip(tracer_concentration, 0, None)

    peak_idx = int(np.argmax(tracer_concentration))
    peak_hour = float(tracer_time[peak_idx])
    peak_value = float(tracer_concentration[peak_idx])
    area = float(np.trapz(tracer_concentration, tracer_time))

    detected = np.flatnonzero(tracer_concentration > 0.05)
    first_arrival = (
        float(tracer_time[detected[0]]) if len(detected) else None
    )

    a, b, c = st.columns(3)
    a.metric("Tepe zamanı", f"{peak_hour:.0f} saat")
    b.metric("Tepe konsantrasyonu", f"{peak_value:.3f}")
    c.metric("Eğri altındaki alan", f"{area:.2f}")

    if first_arrival is not None:
        st.metric("İlk algılanma zamanı", f"{first_arrival:.0f} saat")
    else:
        st.warning("Algılama eşiğinin üzerinde değer bulunamadı.")

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(tracer_time, tracer_concentration, label="Göreli konsantrasyon")
    ax.axvline(peak_hour, linestyle="--", label="Tepe zamanı")
    ax.set_xlabel("Başlangıçtan itibaren süre (saat)")
    ax.set_ylabel("Göreli konsantrasyon")
    ax.set_title("Sentetik tracer kırılma eğrisi")
    ax.grid(alpha=0.25)
    ax.legend()
    st.pyplot(fig)
    plt.close(fig)

    tracer_df = pd.DataFrame({
        "time_hours": tracer_time,
        "relative_concentration": tracer_concentration
    })
    st.download_button(
        "Tracer verisini CSV indir",
        data=tracer_df.to_csv(index=False).encode("utf-8-sig"),
        file_name="isl_guard_tracer_demo.csv",
        mime="text/csv"
    )

    st.info(
        "Tepe zamanı ve eğri alanı sentetik veriden hesaplanır. "
        "Bu ölçüler tek başına sızıntıyı veya yeraltı suyu akış yönünü "
        "kanıtlamaz; gerçek yorum için saha verisi gerekir."
    )


# --------------------------------------------------
# 7. SENARYO ANALİZİ
# --------------------------------------------------
with tabs[2]:
    st.markdown("### Senaryo performans göstergeleri")
    st.caption(
        "Sayımlar demo kurallarının ve modelin davranışını gösterir; "
        "gerçek saha başarısı veya doğruluk ölçütü değildir."
    )

    a, b, c = st.columns(3)
    a.metric("Kural uyarısı", f"{int(df['demo_rule_alert'].sum())} saat")
    b.metric("AI anomali işareti", f"{int(df['ai_anomaly'].sum())} saat")
    c.metric("Birleşik uyarı", f"{int(df['combined_alert'].sum())} saat")

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(df["timestamp"], df["gradient_proxy"], label="Gradyan göstergesi")
    ax.axhline(gradient_limit, linestyle="--", label="Demo alt eşiği")
    ax.set_ylabel("Sentetik gösterge")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(
        df["timestamp"], df["boundary_sulfate_mg_l"],
        label="Sınır sülfat"
    )
    ax.axhline(sulfate_limit, linestyle="--", label="Demo eşiği")
    ax.set_ylabel("Sülfat (mg/L)")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(
        df["timestamp"], df["illustrative_risk_score"],
        label="Gösterim amaçlı risk puanı"
    )
    ax.set_ylabel("Sentetik puan")
    ax.set_ylim(0, 1)
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)


# --------------------------------------------------
# 8. VERİ VE MODEL
# --------------------------------------------------
with tabs[3]:
    st.markdown("### Model ve veri açıklaması")
    st.write("**Veri kaynağı:** Uygulama içinde oluşturulan sentetik veri.")
    st.write(
        "**AI modeli:** Isolation Forest. İlk %20'lik veri bölümü "
        "sentetik başlangıç referansı olarak kullanılır."
    )
    st.write(
        "**Kural katmanı:** Debi farkı, pH, sülfat ve gradyan "
        "göstergesine bağlı kullanıcı ayarlı demo eşikleri."
    )
    st.write(
        "**Birleşik alarm:** Kural uyarısı veya AI anomali işaretinden "
        "en az birinin tetiklenmesi."
    )
    st.write(
        "**Sınır:** Gerçek saha verisi ve bağımsız doğrulanmış etiketler "
        "olmadığından saha performansı kanıtlanmış değildir."
    )

    st.markdown("### Son 20 kayıt")
    st.dataframe(df.tail(20), use_container_width=True)

    st.download_button(
        "Sentetik veri setini CSV indir",
        data=df.to_csv(index=False).encode("utf-8-sig"),
        file_name="isl_guard_synthetic_demo.csv",
        mime="text/csv"
    )


# --------------------------------------------------
# 9. MÜDAHALE SİMÜLASYONU VE OPTİMİZASYON
# --------------------------------------------------
with tabs[4]:
    st.markdown("### Müdahale simülasyonu")
    st.write(
        "Bu bölüm gerçek pompayı kontrol etmez. Debi kısıtının "
        "sentetik verideki etkisini hesaplar."
    )

    before_injection = df["injection_m3h"].to_numpy()
    before_extraction = df["extraction_m3h"].to_numpy()

    after_injection = np.minimum(
        before_injection,
        before_extraction + allowed_imbalance
    )

    before_imbalance = before_injection - before_extraction
    after_imbalance = after_injection - before_extraction

    before_exceedance = int(
        (before_imbalance > allowed_imbalance).sum()
    )
    after_exceedance = int(
        (after_imbalance > allowed_imbalance + 1e-9).sum()
    )

    before_positive = float(np.clip(before_imbalance, 0, None).sum())
    after_positive = float(np.clip(after_imbalance, 0, None).sum())

    a, b, c = st.columns(3)
    a.metric("Önce: eşik üstü saat", before_exceedance)
    b.metric("Sonra: eşik üstü saat", after_exceedance)
    c.metric(
        "Pozitif debi farkı toplamı",
        f"{before_positive:.1f} → {after_positive:.1f} m³"
    )

    comparison = pd.DataFrame({
        "timestamp": df["timestamp"],
        "injection_before_m3h": before_injection,
        "injection_after_demo_m3h": after_injection,
        "extraction_m3h": before_extraction,
        "imbalance_before_m3h": before_imbalance,
        "imbalance_after_demo_m3h": after_imbalance
    })

    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(
        comparison["timestamp"],
        comparison["injection_before_m3h"],
        label="Enjeksiyon: önce"
    )
    ax.plot(
        comparison["timestamp"],
        comparison["injection_after_demo_m3h"],
        label="Enjeksiyon: demo müdahale sonrası"
    )
    ax.plot(
        comparison["timestamp"],
        comparison["extraction_m3h"],
        label="Ekstraksiyon"
    )
    ax.set_ylabel("Debi (m³/h)")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

    st.dataframe(comparison.tail(20), use_container_width=True)

    st.download_button(
        "Müdahale karşılaştırmasını CSV indir",
        data=comparison.to_csv(index=False).encode("utf-8-sig"),
        file_name="isl_guard_intervention_comparison.csv",
        mime="text/csv"
    )

    st.markdown("### Sanal sistem kontrolü")
    if st.session_state.simulated_stop:
        st.error("SANAL DURDURMA ETKİN")
        if st.button("Sanal sistemi yeniden başlat", key="restart_intervention"):
            st.session_state.simulated_stop = False
            st.session_state.alert_deadline = None
            st.session_state.operator_ack = False
            st.session_state.event_log.append({
                "time": pd.Timestamp.now(),
                "event": "Müdahale sekmesinden sanal yeniden başlatma"
            })
            st.rerun()
    else:
        if st.button("🛑 Sanal durdurmayı uygula", type="primary"):
            st.session_state.simulated_stop = True
            st.session_state.alert_deadline = None
            st.session_state.event_log.append({
                "time": pd.Timestamp.now(),
                "event": "Manuel sanal durdurma uygulandı"
            })
            st.rerun()

    if st.button("Müdahale önerisini olay günlüğüne ekle"):
        st.session_state.event_log.append({
            "time": pd.Timestamp.now(),
            "event": advice
        })
        st.rerun()

    st.markdown("### Olay günlüğü")
    if st.session_state.event_log:
        st.dataframe(
            pd.DataFrame(st.session_state.event_log),
            use_container_width=True
        )
        if st.button("Olay günlüğünü temizle"):
            st.session_state.event_log = []
            st.rerun()
    else:
        st.caption("Henüz olay kaydı yok.")


st.divider()
st.caption(
    "ISL Guard | Sentetik veriye dayalı dijital prototip | "
    "Saha güvenlik sistemi veya gerçek ekipman kontrolü değildir."
)
