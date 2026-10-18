
import time

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st


st.set_page_config(
    page_title="ISL Guard | Early Warning",
    page_icon="💧",
    layout="wide",
)

# --------------------------------------------------
# ISL GUARD - SENTETIK ERKEN UYARI VE DURDURMA DEMOSU
# --------------------------------------------------

st.title("💧 ISL Guard")
st.subheader("Intelligent ISL Risk Monitoring & Intervention")

st.warning(
    "PROOF OF CONCEPT: Bu demo sentetik veriler kullanir. "
    "Gercek saha sensorlerine bagli degildir. "
    "Otomatik durdurma yalnizca simule edilir."
)

st.sidebar.header("Demo ayarlari")

warning_threshold = st.sidebar.slider(
    "Uyari esigi (sentetik gosterge)",
    min_value=1.0,
    max_value=6.0,
    value=3.0,
    step=0.5,
)

timeout_seconds = st.sidebar.slider(
    "Yanitsiz kalininca otomatik durdurma suresi (saniye)",
    min_value=5,
    max_value=20,
    value=10,
    step=1,
)

st.sidebar.caption(
    "Demo hizlandirilmis calisir: her saniye yaklasik "
    "bir saatlik sentetik veri ilerler."
)


# --------------------------------------------------
# VERIYI BIR KEZ OLUSTUR
# --------------------------------------------------

if "isl_data" not in st.session_state:
    rng = np.random.default_rng(42)
    n = 120

    timestamps = pd.date_range(
        "2026-10-01",
        periods=n,
        freq="h",
    )

    # Normal kosullarda birbirine yakin debiler
    injection = 50 + rng.normal(0, 0.8, n)
    extraction = 50 + rng.normal(0, 0.8, n)

    # SENTETIK RISK EPIZODU:
    # 24-54 saatleri arasinda enjeksiyon artiyor,
    # cekim azaliyor. Boylece dengesizlik olusuyor.
    injection[24:55] += 12
    extraction[24:55] -= 2

    injection = np.maximum(injection, 0)
    extraction = np.maximum(extraction, 0)

    # Basinc degerleri de ornek amacli uretilir
    pressure_in = (
        250
        + 2 * (injection - 50)
        + rng.normal(0, 3, n)
    )

    pressure_out = (
        180
        + 2 * (extraction - 50)
        + rng.normal(0, 3, n)
    )

    # Pozitif enjeksiyon-cekim farki
    positive_imbalance = np.maximum(
        injection - extraction,
        0,
    )

    # Son 24 saatlik pozitif dengesizlik ortalamasi
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


# --------------------------------------------------
# BUTON ISLEMLERI
# --------------------------------------------------

def stop_system():
    st.session_state.stopped = True
    st.session_state.running = False
    st.session_state.pending_alert = False
    st.session_state.stop_index = (
        st.session_state.current_index
    )
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


# --------------------------------------------------
# CANLI IZLEME
# Her saniye yeni bir sentetik saat incelenir.
# --------------------------------------------------

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

    current_imbalance = float(row["imbalance"])
    risk_now = current_imbalance >= warning_threshold

    # Esik ilk kez asildiginda otomatik uyari olustur.
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

    # Riskli durum sona erdiginde yeni bir uyariya izin ver.
    if (
        not risk_now
        and not st.session_state.pending_alert
    ):
        st.session_state.alert_latched = False
        st.session_state.operator_decision = ""

    # Operator yanit vermezse otomatik durdurma simule edilir.
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
            "Operator yanit vermedigi icin "
            "zaman asiminda otomatik durdurma uygulandi."
        )
        st.session_state.operator_decision = (
            "Yanitsiz kalindi - otomatik durdurma"
        )

    stopped = st.session_state.stopped
    pending = st.session_state.pending_alert

    if stopped:
        status = "SISTEM DURDURULDU"
    elif pending:
        status = "ACIL OPERATOR YANITI BEKLENIYOR"
    elif risk_now:
        status = "RISK ESIGI ASILDI"
    else:
        status = "NORMAL IZLEME"

    # Durum gostergeleri
    c1, c2, c3, c4 = st.columns(4)

    c1.metric("Sistem durumu", status)
    c2.metric(
        "Enjeksiyon debisi",
        f"{row['injection']:.1f} m³/h",
    )
    c3.metric(
        "Cekim debisi",
        f"{row['extraction']:.1f} m³/h",
    )
    c4.metric(
        "Dengesizlik gostergesi",
        f"{current_imbalance:.2f}",
        delta=f"Esik: {warning_threshold:.1f}",
    )

    st.caption(
        f"Simule edilen zaman: {row['timestamp']} | "
        f"Kayit: {i + 1}/{len(df)}"
    )

    # Belirgin, otomatik uyarı paneli
    if pending:
        remaining = max(
            0,
            int(
                st.session_state.alert_deadline
                - time.time()
                + 0.99
            ),
        )

        st.error(
            f"""
            ## ⚠️ ERKEN UYARI: DENGESIZLIK ESIGI ASILDI

            **Uyari nedeni:** 24 saatlik pozitif debi farki
            ortalamasi belirlenen esige ulasti veya asti.

            **Olculen sentetik gosterge:** {current_imbalance:.2f}

            **Esik:** {warning_threshold:.2f}

            ### Sistemi simdi durduralim mi?

            {remaining} saniye icinde yanit vermezsen
            demo sistemi otomatik olarak durduracak.
            """
        )

        left, right = st.columns(2)

        with left:
            st.button(
                "🛑 Evet, sistemi durdur",
                key="confirm_stop",
                type="primary",
                on_click=stop_system,
                use_container_width=True,
            )

        with right:
            st.button(
                "Devam et, izlemeyi surdur",
                key="confirm_continue",
                on_click=continue_system,
                use_container_width=True,
            )

    elif stopped:
        st.error(
            "## 🛑 SISTEM DURDURULDU\n\n"
            + st.session_state.stop_reason
        )

        st.info(
            "Bu demoda enjeksiyon ve cekim islemleri "
            "durdurulmus kabul edilir. Gercek ekipman "
            "kontrol edilmiyor."
        )

    elif risk_now:
        st.warning(
            "Esik asildi. Operator devam etmeyi secti; "
            "gosterge izlenmeye devam ediyor. "
            "Bu durum gercek bir sizinti tespiti degildir."
        )

    else:
        st.success(
            "Esik asimi yok. Sentetik veriler izleniyor."
        )

    if st.session_state.operator_decision:
        st.caption(
            "Son islem: "
            + st.session_state.operator_decision
        )

    # --------------------------------------------------
    # GRAFIKLER
    # --------------------------------------------------

    visible = df.iloc[max(0, i - 47): i + 1]

    fig, ax = plt.subplots(figsize=(11, 4))

    ax.plot(
        visible["timestamp"],
        visible["injection"],
        label="Enjeksiyon (sentetik)",
    )

    ax.plot(
        visible["timestamp"],
        visible["extraction"],
        label="Cekim (sentetik)",
    )

    # Durdurma gerceklesmisse etkin debileri sifirla.
    if stopped and st.session_state.stop_index is not None:
        stop_time = df.iloc[
            st.session_state.stop_index
        ]["timestamp"]

        ax.axvline(
            stop_time,
            linestyle="--",
            label="Simule durdurma zamani",
        )

    ax.set_title("Debi izleme")
    ax.set_ylabel("Debi (m³/h)")
    ax.legend()
    ax.grid(alpha=0.25)
    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

    fig2, ax2 = plt.subplots(figsize=(11, 4))

    ax2.plot(
        visible["timestamp"],
        visible["imbalance"],
        label="24 saatlik dengesizlik gostergesi",
    )

    ax2.axhline(
        warning_threshold,
        linestyle="--",
        label="Uyari esigi",
    )

    ax2.set_title("Erken uyari gostergesi")
    ax2.set_ylabel("Sentetik gosterge")
    ax2.legend()
    ax2.grid(alpha=0.25)
    fig2.autofmt_xdate()
    st.pyplot(fig2)
    plt.close(fig2)

    # Son kayitlar
    with st.expander("Son sentetik kayitlari gor"):
        st.dataframe(
            visible.tail(12),
            use_container_width=True,
        )

    st.caption(
        "Not: Uyari, sentetik debi farki gostergesine "
        "dayanir. Bu gosterge tek basina yer alti suyu "
        "sizintisini kanitlamaz."
    )


live_monitor()
