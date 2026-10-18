
import time

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st
from sklearn.ensemble import IsolationForest

st.set_page_config(
    page_title="ISL Guard | AI Risk Support",
    page_icon="💧",
    layout="wide",
)

st.title("💧 ISL Guard")
st.subheader("AI-Assisted ISL Monitoring & Decision Support")

st.warning(
    "PROTOTIP: Veriler sentetiktir. AI modeli sentetik normal "
    "veriden sapmalari arar; gercek sizinti tespiti yapmaz. "
    "Otomatik durdurma ve oneriler yalnizca simule edilir."
)

# ---------------- SETTINGS ----------------

st.sidebar.header("Sistem ayarlari")

warning_threshold = st.sidebar.slider(
    "Erken uyari esigi",
    1.0, 6.0, 3.0, 0.5,
)

timeout_seconds = st.sidebar.slider(
    "Yanitsiz kalininca durdurma suresi (saniye)",
    5, 20, 10, 1,
)

max_imbalance = st.sidebar.slider(
    "Optimizasyon icin izin verilen anlik pozitif debi farki",
    0.0, 5.0, 1.5, 0.5,
)

# ---------------- SYNTHETIC DATA ----------------

if "isl_data" not in st.session_state:
    rng = np.random.default_rng(42)
    n = 120

    timestamps = pd.date_range(
        "2026-10-01", periods=n, freq="h"
    )

    injection = 50 + rng.normal(0, 0.8, n)
    extraction = 50 + rng.normal(0, 0.8, n)

    # Sentetik anomali bolgesi
    injection[24:55] += 12
    extraction[24:55] -= 2

    injection = np.maximum(injection, 0)
    extraction = np.maximum(extraction, 0)

    pressure_in = (
        250 + 2 * (injection - 50)
        + rng.normal(0, 3, n)
    )
    pressure_out = (
        180 + 2 * (extraction - 50)
        + rng.normal(0, 3, n)
    )

    positive_imbalance = np.maximum(
        injection - extraction, 0
    )

    imbalance = (
        pd.Series(positive_imbalance)
        .rolling(24, min_periods=1)
        .mean()
        .to_numpy()
    )

    st.session_state.isl_data = pd.DataFrame({
        "timestamp": timestamps,
        "injection": injection,
        "extraction": extraction,
        "pressure_in": pressure_in,
        "pressure_out": pressure_out,
        "imbalance": imbalance,
    })

    st.session_state.current_index = 0
    st.session_state.running = True
    st.session_state.stopped = False
    st.session_state.stop_index = None
    st.session_state.pending_alert = False
    st.session_state.alert_latched = False
    st.session_state.alert_deadline = None
    st.session_state.stop_reason = ""
    st.session_state.operator_decision = ""

df = st.session_state.isl_data

# ---------------- AI ANOMALY DETECTION ----------------
# Isolation Forest is trained only on the first 24
# synthetic records, treated as a normal baseline.

features = pd.DataFrame({
    "injection": df["injection"],
    "extraction": df["extraction"],
    "pressure_difference": (
        df["pressure_in"] - df["pressure_out"]
    ),
    "imbalance": df["imbalance"],
})

baseline = features.iloc[:24]

ai_model = IsolationForest(
    n_estimators=150,
    contamination="auto",
    random_state=42,
)

ai_model.fit(baseline)

scores = ai_model.decision_function(features)
baseline_scores = ai_model.decision_function(baseline)

# Low scores mean more anomalous relative to baseline.
ai_cutoff = np.quantile(baseline_scores, 0.05)
ai_anomaly = scores < ai_cutoff

# ---------------- OPTIMIZATION ----------------

def optimize_injection(current_injection, current_extraction,
                       allowed_imbalance):
    """
    Maximize injection rate subject to:
    injection_target <= extraction + allowed_imbalance
    and injection_target <= current_injection.

    This is a simple constrained optimizer, not a validated
    hydrogeological safety model.
    """
    target = min(
        current_injection,
        current_extraction + allowed_imbalance,
    )
    return max(0.0, target)


def get_recommendation(is_anomaly, imbalance_value,
                       threshold, current_injection,
                       target_injection, stopped):
    if stopped:
        return (
            "Sistem durdurulmus durumda. Yeniden baslatmadan "
            "once olcumleri ve durdurma nedenini inceleyin."
        )

    if is_anomaly or imbalance_value >= threshold:
        return (
            "Anormal olcum oruntusu veya esik asimi var. "
            "Debi ve basinc olcumlerini dogrulayin; "
            "enjeksiyonu hesaplanan hedefe sinirlamayi "
            "ve operator guvenlik prosedurunu degerlendirin."
        )

    if target_injection < current_injection - 0.01:
        return (
            "Optimizasyon, tanimli debi farki kisiti icin "
            "daha dusuk bir enjeksiyon hedefi oneriyor. "
            "Bu hedef saha icin dogrulanmis guvenli deger degildir."
        )

    return (
        "AI modeli sentetik referans veriden belirgin bir "
        "sapma isaretlemiyor. Olcumleri izlemeye devam edin."
    )


# ---------------- USER ACTIONS ----------------

def stop_system():
    st.session_state.stopped = True
    st.session_state.running = False
    st.session_state.pending_alert = False
    st.session_state.stop_index = st.session_state.current_index
    st.session_state.stop_reason = (
        "Operator sistemi durdurmayi secti."
    )
    st.session_state.operator_decision = "Durdurma onaylandi"


def continue_system():
    st.session_state.pending_alert = False
    st.session_state.alert_deadline = None
    st.session_state.operator_decision = (
        "Operator devam etmeyi secti."
    )


def reset_demo():
    st.session_state.current_index = 0
    st.session_state.running = True
    st.session_state.stopped = False
    st.session_state.stop_index = None
    st.session_state.pending_alert = False
    st.session_state.alert_latched = False
    st.session_state.alert_deadline = None
    st.session_state.stop_reason = ""
    st.session_state.operator_decision = ""


st.button(
    "↻ Simulasyonu bastan baslat",
    on_click=reset_demo,
)

# ---------------- LIVE MONITOR ----------------

@st.fragment(run_every="1s")
def live_monitor():
    df = st.session_state.isl_data

    if (
        st.session_state.running
        and st.session_state.current_index < len(df) - 1
    ):
        st.session_state.current_index += 1

    i = st.session_state.current_index
    row = df.iloc[i]

    imbalance_value = float(row["imbalance"])
    anomaly_now = bool(ai_anomaly[i])

    # Combine the existing threshold rule with AI anomaly flag.
    risk_now = (
        imbalance_value >= warning_threshold or anomaly_now
    )

    if (
        risk_now
        and not st.session_state.alert_latched
        and not st.session_state.stopped
    ):
        st.session_state.pending_alert = True
        st.session_state.alert_latched = True
        st.session_state.alert_deadline = (
            time.time() + timeout_seconds
        )
        st.session_state.operator_decision = ""

    if (
        not risk_now
        and not st.session_state.pending_alert
    ):
        st.session_state.alert_latched = False

    if (
        st.session_state.pending_alert
        and st.session_state.alert_deadline is not None
        and time.time() >= st.session_state.alert_deadline
    ):
        st.session_state.stopped = True
        st.session_state.running = False
        st.session_state.pending_alert = False
        st.session_state.stop_index = i
        st.session_state.stop_reason = (
            "Operator yanit vermedi; simule otomatik durdurma."
        )
        st.session_state.operator_decision = (
            "Yanitsiz kalindi - otomatik durdurma"
        )

    stopped = st.session_state.stopped
    pending = st.session_state.pending_alert

    if stopped:
        status = "SISTEM DURDURULDU"
    elif pending:
        status = "OPERATOR YANITI BEKLENIYOR"
    elif risk_now:
        status = "ANOMALI / ESİK ASIMI"
    else:
        status = "NORMAL IZLEME"

    target = optimize_injection(
        float(row["injection"]),
        float(row["extraction"]),
        max_imbalance,
    )

    recommendation = get_recommendation(
        anomaly_now,
        imbalance_value,
        warning_threshold,
        float(row["injection"]),
        target,
        stopped,
    )

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Sistem durumu", status)
    c2.metric("Enjeksiyon", f"{row['injection']:.1f} m³/h")
    c3.metric("Cekim", f"{row['extraction']:.1f} m³/h")
    c4.metric("AI anomali", "EVET" if anomaly_now else "Hayir")

    st.caption(
        f"Simule zaman: {row['timestamp']} | "
        f"Kayit {i + 1}/{len(df)}"
    )

    if pending:
        remaining = max(
            0,
            int(st.session_state.alert_deadline - time.time() + 0.99),
        )

        st.error(
            f"""
            ## ⚠️ ERKEN UYARI

            **Tetiklenme nedeni:** {
                "AI anomali tespiti" if anomaly_now
                else "Debi dengesizligi esik asimi"
            }

            **24 saatlik dengesizlik gostergesi:** {
                imbalance_value:.2f
            }

            **AI anomali skoru:** {scores[i]:.4f}

            **{remaining} saniye icinde yanit verin.**
            Yanitsiz kalinirsa demo otomatik durdurulacak.
            """
        )

        left, right = st.columns(2)
        with left:
            st.button(
                "🛑 Sistemi durdur",
                key="stop_button",
                type="primary",
                on_click=stop_system,
                use_container_width=True,
            )
        with right:
            st.button(
                "Devam et",
                key="continue_button",
                on_click=continue_system,
                use_container_width=True,
            )

    elif stopped:
        st.error("## 🛑 SISTEM DURDURULDU")
        st.write(st.session_state.stop_reason)

    elif risk_now:
        st.warning(
            "Anomali veya esik asimi goruluyor. "
            "Operator devam etmeyi secti; gostergeler izleniyor."
        )
    else:
        st.success("Sentetik veriler izleniyor; uyari kosulu yok.")

    st.markdown("### AI destekli öneri")
    st.info(recommendation)

    st.markdown("### Optimizasyon sonucu")
    o1, o2, o3 = st.columns(3)
    o1.metric("Mevcut enjeksiyon", f"{row['injection']:.2f} m³/h")
    o2.metric("Hesaplanan hedef", f"{target:.2f} m³/h")
    o3.metric(
        "Hedef farki",
        f"{target - row['injection']:.2f} m³/h",
    )

    st.caption(
        "Hedef, enjeksiyon debisini cekim debisi + tanimli "
        "izin verilen fark ile sinirlayan basit bir optimizasyondur. "
        "Gercek saha icin guvenli calisma noktasi degildir."
    )

    visible = df.iloc[max(0, i - 47):i + 1]

    st.markdown("### Debi izleme")
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.plot(visible["timestamp"], visible["injection"], label="Enjeksiyon")
    ax.plot(visible["timestamp"], visible["extraction"], label="Cekim")
    ax.legend()
    ax.grid(alpha=0.25)
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

    st.markdown("### AI anomali skoru ve uyari esigi")
    fig2, ax2 = plt.subplots(figsize=(11, 4))
    ax2.plot(
        visible["timestamp"],
        scores[max(0, i - 47):i + 1],
        label="Isolation Forest skoru",
    )
    ax2.axhline(
        ai_cutoff,
        linestyle="--",
        label="Sentetik referans esigi",
    )
    ax2.legend()
    ax2.grid(alpha=0.25)
    fig2.autofmt_xdate()
    st.pyplot(fig2)
    plt.close(fig2)

    with st.expander("Son sentetik kayitlari gor"):
        view = visible.copy()
        view["AI_anomali"] = ai_anomaly[max(0, i - 47):i + 1]
        st.dataframe(view.tail(12), use_container_width=True)


live_monitor()
