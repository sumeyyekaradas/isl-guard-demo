
import time

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


# =========================================================
# ISL GUARD - BÜTÜNLEŞİK PROTOTİP
# UYARI: Bütün ölçümler sentetiktir.
# Gerçek sensör veya pompa kontrolü yapılmaz.
# =========================================================

st.set_page_config(
    page_title="ISL Guard | Akıllı İzleme",
    page_icon="💧",
    layout="wide",
)

st.title("💧 ISL Guard")
st.subheader("ISL Yeraltı Suyu İzleme ve Karar Destek Prototipi")

st.warning(
    "DEMO MODU: Veriler sentetiktir. AI anomali tespiti yapar; "
    "tek başına gerçek sızıntıyı kanıtlamaz. Öneriler, tracer "
    "testi ve durdurma/geri çekme işlemleri simülasyondur. "
    "Gerçek saha kontrolü için kullanılamaz."
)


# =========================================================
# 1. SAHA PROFİLLERİ
# Profil hassasiyetleri simülasyon varsayımlarıdır.
# EPA değerleri saha güvenlik sınırı olarak kullanılmaz.
# =========================================================

site_profiles = {
    "Saha A - Başlangıç koşulları": {
        "description": "Başlangıç su kalitesiyle karşılaştırma.",
        "ph_drop": 0.8,
        "sulfate_delta": 100.0,
        "conductivity_pct": 30.0,
        "imbalance": 6.0,
    },
    "Saha B - Kimyasal değişime duyarlı": {
        "description": "Kimyasal değişimlere daha hassas simülasyon.",
        "ph_drop": 0.5,
        "sulfate_delta": 75.0,
        "conductivity_pct": 20.0,
        "imbalance": 4.0,
    },
    "Saha C - Sınır kuyusu odaklı": {
        "description": "Sınır kuyusu değişimlerine hassas simülasyon.",
        "ph_drop": 0.3,
        "sulfate_delta": 50.0,
        "conductivity_pct": 15.0,
        "imbalance": 3.0,
    },
}

st.sidebar.header("Saha ve sistem ayarları")

selected_site = st.sidebar.selectbox(
    "İzlenecek saha profili",
    list(site_profiles.keys()),
)

site = site_profiles[selected_site]
st.sidebar.caption(site["description"])

st.sidebar.markdown("#### Kimyasal değişim eşikleri")

ph_drop_limit = st.sidebar.slider(
    "Başlangıca göre pH düşüşü",
    min_value=0.1,
    max_value=2.0,
    value=site["ph_drop"],
    step=0.1,
    key=f"ph_{selected_site}",
)

sulfate_delta_limit = st.sidebar.slider(
    "Başlangıca göre sülfat artışı (mg/L)",
    min_value=10.0,
    max_value=200.0,
    value=site["sulfate_delta"],
    step=10.0,
    key=f"sulfate_{selected_site}",
)

conductivity_limit = st.sidebar.slider(
    "İletkenlik artışı (%)",
    min_value=5.0,
    max_value=60.0,
    value=site["conductivity_pct"],
    step=5.0,
    key=f"conductivity_{selected_site}",
)

warning_threshold = st.sidebar.slider(
    "24 saatlik pozitif debi farkı eşiği (m³/h)",
    min_value=1.0,
    max_value=15.0,
    value=float(site["imbalance"]),
    step=0.5,
)

max_imbalance = st.sidebar.slider(
    "Simülasyon optimizasyonunda izin verilen debi farkı",
    min_value=0.0,
    max_value=5.0,
    value=1.5,
    step=0.5,
)

timeout_seconds = st.sidebar.slider(
    "Uyarı yanıt süresi (saniye)",
    min_value=5,
    max_value=30,
    value=10,
)

st.sidebar.markdown("#### Geri çekme simülasyonu")

pressure_min = st.sidebar.number_input(
    "Simülasyon basınç aralığı - alt sınır (kPa)",
    min_value=0.0,
    max_value=1000.0,
    value=150.0,
    step=5.0,
)

pressure_max = st.sidebar.number_input(
    "Simülasyon basınç aralığı - üst sınır (kPa)",
    min_value=0.0,
    max_value=1000.0,
    value=220.0,
    step=5.0,
)

if pressure_min >= pressure_max:
    st.sidebar.error("Üst sınır, alt sınırdan büyük olmalıdır.")

st.sidebar.caption(
    "Basınç aralığı yalnızca demo kontrolüdür; "
    "gerçek saha için güvenli basınç değeri değildir."
)

st.markdown("### Referans bilgileri")
st.info(
    "ABD EPA ikincil içme suyu referansları: pH 6,5–8,5; "
    "sülfat 250 mg/L. Bunlar ISL operasyon sınırları değildir. "
    "Saha müdahale sınırları hidrojeolojik inceleme ve "
    "uygulanabilir mevzuat doğrultusunda belirlenmelidir."
)


# =========================================================
# 2. SENTETİK SENSÖR VERİLERİ
# =========================================================

required_columns = {
    "timestamp",
    "injection",
    "extraction",
    "pressure_in",
    "pressure_out",
    "ph_boundary",
    "sulfate_boundary",
    "conductivity",
    "groundwater_level",
    "hydraulic_gradient",
    "tracer_well_1",
    "tracer_well_2",
    "imbalance",
}

if (
    "isl_data" not in st.session_state
    or not required_columns.issubset(
        set(st.session_state.isl_data.columns)
    )
):
    rng = np.random.default_rng(42)
    n = 168

    timestamps = pd.date_range(
        "2026-10-01",
        periods=n,
        freq="h",
    )

    injection = 50 + rng.normal(0, 0.8, n)
    extraction = 50 + rng.normal(0, 0.8, n)

    # Sentetik operasyonel dengesizlik dönemi
    injection[48:86] += 10
    extraction[48:86] -= 4

    injection = np.maximum(injection, 0)
    extraction = np.maximum(extraction, 0)

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

    # Sentetik kimyasal ölçümler
    ph_boundary = 7.2 + rng.normal(0, 0.05, n)
    sulfate_boundary = 180 + rng.normal(0, 5, n)
    conductivity = 600 + rng.normal(0, 15, n)

    ph_boundary[48:86] = np.linspace(
        7.2, 5.7, 38
    ) + rng.normal(0, 0.04, 38)

    sulfate_boundary[48:86] = np.linspace(
        180, 420, 38
    ) + rng.normal(0, 5, 38)

    conductivity[48:86] = np.linspace(
        600, 1000, 38
    ) + rng.normal(0, 15, 38)

    # Sentetik su seviyesi ve hidrolik gradyan
    groundwater_level = 100 + rng.normal(0, 0.05, n)
    groundwater_level[48:86] += np.linspace(0, 0.5, 38)

    hydraulic_gradient = (
        0.002 + rng.normal(0, 0.0001, n)
    )
    hydraulic_gradient[48:86] = np.linspace(
        0.002, 0.0035, 38
    ) + rng.normal(0, 0.0001, 38)

    # Sentetik tracer yanıtı: yalnızca örnek konsantrasyon eğrisi
    t = np.arange(n)
    tracer_well_1 = np.exp(-0.5 * ((t - 62) / 4) ** 2)
    tracer_well_2 = 0.6 * np.exp(-0.5 * ((t - 76) / 5) ** 2)

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
        "ph_boundary": ph_boundary,
        "sulfate_boundary": sulfate_boundary,
        "conductivity": conductivity,
        "groundwater_level": groundwater_level,
        "hydraulic_gradient": hydraulic_gradient,
        "tracer_well_1": tracer_well_1,
        "tracer_well_2": tracer_well_2,
        "imbalance": imbalance,
    })

    st.session_state.current_index = 0
    st.session_state.running = True
    st.session_state.stopped = False
    st.session_state.extraction_mode = False
    st.session_state.pending_alert = False
    st.session_state.alert_latched = False
    st.session_state.alert_deadline = None
    st.session_state.stop_reason = ""
    st.session_state.operator_decision = ""
    st.session_state.tracer_test_started = False
    st.session_state.extraction_stop_reason = ""


df = st.session_state.isl_data


# =========================================================
# 3. AI ANOMALİ ANALİZİ
# Model ilk 24 sentetik kaydı başlangıç profili sayar.
# =========================================================

feature_columns = [
    "injection",
    "extraction",
    "pressure_in",
    "pressure_out",
    "ph_boundary",
    "sulfate_boundary",
    "conductivity",
    "groundwater_level",
    "hydraulic_gradient",
    "imbalance",
]

features = df[feature_columns].copy()
baseline = features.iloc[:24]

ai_model = make_pipeline(
    StandardScaler(),
    IsolationForest(
        n_estimators=150,
        contamination="auto",
        random_state=42,
    ),
)

ai_model.fit(baseline)

scores = ai_model.decision_function(features)
baseline_scores = ai_model.decision_function(baseline)
ai_cutoff = float(np.quantile(baseline_scores, 0.05))

ai_anomaly = scores < ai_cutoff

# Başlangıç kayıtlarında AI alarmı oluşturmuyoruz.
ai_anomaly[:24] = False

# Başlangıç kimyasal değerleri
baseline_ph = float(df["ph_boundary"].iloc[:24].median())
baseline_sulfate = float(df["sulfate_boundary"].iloc[:24].median())
baseline_conductivity = float(df["conductivity"].iloc[:24].median())


# =========================================================
# 4. ÖNERİ VE OPTİMİZASYON
# =========================================================

def optimize_injection(
    current_injection,
    current_extraction,
    allowed_imbalance,
):
    """Demo için debi farkına dayalı basit hesaplama."""
    target = min(
        current_injection,
        current_extraction + allowed_imbalance,
    )
    return max(0.0, target)


def get_recommendations(
    row,
    anomaly,
    ph_drop,
    sulfate_delta,
    conductivity_pct,
    imbalance_value,
    target_injection,
    stopped,
):
    messages = []

    if stopped:
        messages.append(
            "Enjeksiyon durdurulmuş durumda. "
            "Yeniden başlatma kararı öncesinde ölçümler "
            "ve durdurma nedeni yetkili kişi tarafından incelenmeli."
        )

    if anomaly:
        messages.append(
            "AI modeli başlangıç verisinden farklı bir ölçüm "
            "örüntüsü işaretliyor. Ölçüm kalitesini ve diğer "
            "göstergeleri doğrulayın."
        )

    if ph_drop >= ph_drop_limit:
        messages.append(
            "Sınır kuyusunda pH başlangıç değerinden belirgin "
            "şekilde düşmüş. Ölçümü doğrulayın ve saha prosedürünü "
            "izleyerek çevresel riski değerlendirin."
        )

    if sulfate_delta >= sulfate_delta_limit:
        messages.append(
            "Sülfat başlangıç değerine göre artmış. Tek başına "
            "bu değişim asit sızıntısını kanıtlamaz; diğer kimyasal "
            "ölçümler ve akış bilgileriyle karşılaştırın."
        )

    if conductivity_pct >= conductivity_limit:
        messages.append(
            "Elektriksel iletkenlik başlangıca göre artmış. "
            "Bu değişim çözünmüş iyonlardan kaynaklanabilir; "
            "pH, sülfat ve ölçüm kalitesiyle birlikte inceleyin."
        )

    if imbalance_value >= warning_threshold:
        messages.append(
            "Pozitif debi farkı eşiği aşılmış. Enjeksiyon ve "
            "geri çekme ölçümlerini doğrulayın."
        )

    if target_injection < float(row["injection"]) - 0.01:
        messages.append(
            "Basit debi hesabı daha düşük enjeksiyon hedefi "
            "gösteriyor. Bu hesap saha için doğrulanmış güvenli "
            "çalışma noktası değildir."
        )

    if not messages:
        messages.append(
            "Seçili demo eşiklerine göre belirgin uyarı yok. "
            "Ölçümleri izlemeye devam edin."
        )

    return messages


# =========================================================
# 5. SİSTEM DURUMU VE OPERATÖR EYLEMLERİ
# =========================================================

def stop_system():
    st.session_state.stopped = True
    st.session_state.running = False
    st.session_state.extraction_mode = True
    st.session_state.pending_alert = False
    st.session_state.stop_reason = (
        "Operatör durdurmayı seçti. "
        "Geri çekme, demo basınç koşuluna göre değerlendirilecek."
    )
    st.session_state.operator_decision = "Durdurma onaylandı"


def continue_system():
    st.session_state.pending_alert = False
    st.session_state.alert_deadline = None
    st.session_state.operator_decision = (
        "Operatör simülasyonda devam etmeyi seçti."
    )


def reset_demo():
    st.session_state.current_index = 0
    st.session_state.running = True
    st.session_state.stopped = False
    st.session_state.extraction_mode = False
    st.session_state.pending_alert = False
    st.session_state.alert_latched = False
    st.session_state.alert_deadline = None
    st.session_state.stop_reason = ""
    st.session_state.operator_decision = ""
    st.session_state.extraction_stop_reason = ""


col_reset, col_tracer = st.columns(2)

with col_reset:
    st.button(
        "↻ Simülasyonu baştan başlat",
        on_click=reset_demo,
        use_container_width=True,
    )

with col_tracer:
    st.button(
        "🧪 Tracer testini başlat",
        key="start_tracer",
        on_click=lambda: st.session_state.update(
            tracer_test_started=True
        ),
        use_container_width=True,
    )


# =========================================================
# 6. TRACER TESTİ
# =========================================================

if st.session_state.tracer_test_started:
    st.markdown("## 🧪 Tracer testi sonuçları")

    st.warning(
        "Bu tracer eğrileri sentetiktir. Gerçek bir tracer "
        "enjeksiyonu yapılmamış, gerçek akış yolu doğrulanmamıştır."
    )

    tracer_df = df[
        ["timestamp", "tracer_well_1", "tracer_well_2"]
    ].copy()

    st.markdown(
        "**Gösterilen noktalar:** İzleme kuyusu 1 ve izleme kuyusu 2"
    )

    fig_tracer, ax_tracer = plt.subplots(figsize=(11, 4))
    ax_tracer.plot(
        tracer_df["timestamp"],
        tracer_df["tracer_well_1"],
        label="İzleme kuyusu 1",
    )
    ax_tracer.plot(
        tracer_df["timestamp"],
        tracer_df["tracer_well_2"],
        label="İzleme kuyusu 2",
    )
    ax_tracer.set_ylabel("Göreli tracer konsantrasyonu")
    ax_tracer.set_xlabel("Simüle zaman")
    ax_tracer.grid(alpha=0.25)
    ax_tracer.legend()
    fig_tracer.autofmt_xdate()
    st.pyplot(fig_tracer)
    plt.close(fig_tracer)

    for col, label in [
        ("tracer_well_1", "İzleme kuyusu 1"),
        ("tracer_well_2", "İzleme kuyusu 2"),
    ]:
        peak_idx = int(df[col].to_numpy().argmax())
        st.write(
            f"**{label}:** En yüksek simüle sinyal zamanı "
            f"{df['timestamp'].iloc[peak_idx]}."
        )

    st.caption(
        "Gerçek testte tracer türü, arka plan değeri, enjeksiyon "
        "zamanı, numune alma sıklığı, kuyu konumları ve analiz "
        "yöntemi kaydedilmelidir. Tracer seçimi uzman onayı gerektirir."
    )


# =========================================================
# 7. CANLI İZLEME PANELİ
# =========================================================

@st.fragment(run_every="1s")
def live_monitor():
    df = st.session_state.isl_data

    # Normal durumda veri ilerler.
    if (
        st.session_state.running
        and st.session_state.current_index < len(df) - 1
    ):
        st.session_state.current_index += 1

    # Durdurma sonrası geri çekme simülasyonu:
    # enjeksiyon 0 kabul edilir, çekim yalnızca seçili demo
    # basınç aralığında sürer. Bu gerçek kontrol değildir.
    elif (
        st.session_state.stopped
        and st.session_state.extraction_mode
        and st.session_state.current_index < len(df) - 1
    ):
        current_row = df.iloc[st.session_state.current_index]
        pressure_ok = (
            pressure_min <= float(current_row["pressure_out"])
            <= pressure_max
        )

        if pressure_ok:
            st.session_state.current_index += 1
        else:
            st.session_state.extraction_mode = False
            st.session_state.extraction_stop_reason = (
                "Simüle geri çekme basıncı seçilen aralığın dışında. "
                "Geri çekme simülasyonu durduruldu."
            )

    i = st.session_state.current_index
    row = df.iloc[i]

    # Saha başlangıcına göre kimyasal değişimler
    ph_drop = baseline_ph - float(row["ph_boundary"])
    sulfate_delta = (
        float(row["sulfate_boundary"]) - baseline_sulfate
    )
    conductivity_pct = (
        (float(row["conductivity"]) - baseline_conductivity)
        / max(abs(baseline_conductivity), 1e-6)
        * 100
    )

    imbalance_value = float(row["imbalance"])
    anomaly_now = bool(ai_anomaly[i])

    chemical_alert = (
        ph_drop >= ph_drop_limit
        or sulfate_delta >= sulfate_delta_limit
        or conductivity_pct >= conductivity_limit
    )

    risk_now = (
        anomaly_now
        or imbalance_value >= warning_threshold
        or chemical_alert
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
        st.session_state.extraction_mode = True
        st.session_state.pending_alert = False
        st.session_state.stop_reason = (
            "Operatör yanıt vermedi; demo otomatik durdurma "
            "senaryosuna geçti."
        )
        st.session_state.operator_decision = (
            "Yanıt yok - simüle otomatik durdurma"
        )

    stopped = st.session_state.stopped
    pending = st.session_state.pending_alert

    if stopped:
        status = "ENJEKSİYON DURDURULDU"
    elif pending:
        status = "OPERATÖR YANITI BEKLENİYOR"
    elif risk_now:
        status = "ANOMALİ / UYARI"
    else:
        status = "NORMAL İZLEME"

    target = optimize_injection(
        float(row["injection"]),
        float(row["extraction"]),
        max_imbalance,
    )

    recommendation_messages = get_recommendations(
        row=row,
        anomaly=anomaly_now,
        ph_drop=ph_drop,
        sulfate_delta=sulfate_delta,
        conductivity_pct=conductivity_pct,
        imbalance_value=imbalance_value,
        target_injection=target,
        stopped=stopped,
    )

    # Durdurma durumunda enjeksiyon sıfır kabul edilir.
    injection_display = 0.0 if stopped else float(row["injection"])

    pressure_ok = (
        pressure_min <= float(row["pressure_out"]) <= pressure_max
    )

    extraction_display = (
        float(row["extraction"])
        if not stopped or (
            st.session_state.extraction_mode and pressure_ok
        )
        else 0.0
    )

    st.markdown("## 📡 Anlık izleme")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Sistem durumu", status)
    c2.metric("Enjeksiyon", f"{injection_display:.1f} m³/h")
    c3.metric("Geri çekme", f"{extraction_display:.1f} m³/h")
    c4.metric("AI anomali", "EVET" if anomaly_now else "Hayır")

    st.caption(
        f"Simüle zaman: {row['timestamp']} | "
        f"Kayıt {i + 1}/{len(df)} | Profil: {selected_site}"
    )

    # Kimyasal ve hidrojeolojik göstergeler
    st.markdown("### Kimyasal ve hidrojeolojik göstergeler")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Sınır kuyusu pH", f"{row['ph_boundary']:.2f}")
    c2.metric(
        "Sülfat",
        f"{row['sulfate_boundary']:.1f} mg/L",
        delta=f"{sulfate_delta:+.1f} mg/L başlangıca göre",
    )
    c3.metric(
        "Elektriksel iletkenlik",
        f"{row['conductivity']:.1f} µS/cm",
        delta=f"{conductivity_pct:+.1f}% başlangıca göre",
    )
    c4.metric(
        "Yeraltı suyu seviyesi",
        f"{row['groundwater_level']:.3f} m",
    )

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Enjeksiyon basıncı", f"{row['pressure_in']:.1f} kPa")
    c2.metric("Geri çekme basıncı", f"{row['pressure_out']:.1f} kPa")
    c3.metric("Hidrolik gradyan göstergesi", f"{row['hydraulic_gradient']:.5f}")
    c4.metric("24 saatlik pozitif debi farkı", f"{imbalance_value:.2f} m³/h")

    if pending:
        remaining = max(
            0,
            int(st.session_state.alert_deadline - time.time() + 0.99),
        )

        st.error(
            f"## ⚠️ Erken uyarı\n\n"
            f"**AI anomali skoru:** {scores[i]:.4f}\n\n"
            f"**pH başlangıçtan düşüş:** {ph_drop:.2f}\n\n"
            f"**Sülfat başlangıçtan artış:** {sulfate_delta:.1f} mg/L\n\n"
            f"**İletkenlik değişimi:** {conductivity_pct:.1f}%\n\n"
            f"**Yanıt süresi:** {remaining} saniye. "
            "Yanıt verilmezse demo durdurma senaryosuna geçer."
        )

        left, right = st.columns(2)

        with left:
            st.button(
                "🛑 Enjeksiyonu durdur",
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
        st.error("## 🛑 Enjeksiyon durduruldu")
        st.write(st.session_state.stop_reason)

        if st.session_state.extraction_mode and pressure_ok:
            st.success(
                "Geri çekme simülasyonu, seçili basınç aralığı "
                "içinde devam ediyor."
            )
        else:
            st.warning(
                st.session_state.extraction_stop_reason
                or "Geri çekme simülasyonu aktif değil."
            )

        st.caption(
            "Bu davranış yalnızca sentetik simülasyondur. "
            "Gerçek sahada geri çekme kararı basınç tek başına "
            "kullanılarak verilmemeli; saha prosedürü ve "
            "hidrojeolojik değerlendirme gereklidir."
        )

    elif risk_now:
        st.warning(
            "Uyarı koşulu tespit edildi. Operatör devam etmeyi "
            "seçmiş olabilir; göstergeler izleniyor."
        )
    else:
        st.success("Sentetik veriler izleniyor; seçili uyarı koşulu yok.")

    st.markdown("### AI destekli öneriler")
    for message in recommendation_messages:
        st.write(f"- {message}")

    st.markdown("### Debi optimizasyonu - demo hesabı")
    o1, o2, o3 = st.columns(3)
    o1.metric("Mevcut enjeksiyon", f"{row['injection']:.2f} m³/h")
    o2.metric("Hesaplanan hedef", f"{target:.2f} m³/h")
    o3.metric(
        "Hedef farkı",
        f"{target - float(row['injection']):.2f} m³/h",
    )

    st.caption(
        "Bu hesap yalnızca enjeksiyon debisini çekim debisi "
        "+ izin verilen fark ile sınırlar. Hidrojeolojik "
        "güvenlik modeli veya gerçek saha optimizasyonu değildir."
    )

    # Grafikler
    visible = df.iloc[max(0, i - 47):i + 1]

    st.markdown("### Debi ve basınç trendleri")
    fig, axes = plt.subplots(2, 1, figsize=(11, 7))

    axes[0].plot(
        visible["timestamp"],
        visible["injection"],
        label="Sentetik enjeksiyon",
    )
    axes[0].plot(
        visible["timestamp"],
        visible["extraction"],
        label="Sentetik geri çekme",
    )
    axes[0].set_ylabel("Debi (m³/h)")
    axes[0].legend()
    axes[0].grid(alpha=0.25)

    axes[1].plot(
        visible["timestamp"],
        visible["pressure_in"],
        label="Enjeksiyon basıncı",
    )
    axes[1].plot(
        visible["timestamp"],
        visible["pressure_out"],
        label="Geri çekme basıncı",
    )
    axes[1].set_ylabel("Basınç (kPa)")
    axes[1].legend()
    axes[1].grid(alpha=0.25)

    fig.autofmt_xdate()
    st.pyplot(fig)
    plt.close(fig)

    st.markdown("### Kimyasal izleme trendleri")
    fig2, axes2 = plt.subplots(3, 1, figsize=(11, 9))

    axes2[0].plot(visible["timestamp"], visible["ph_boundary"])
    axes2[0].set_ylabel("pH")
    axes2[0].grid(alpha=0.25)

    axes2[1].plot(
        visible["timestamp"],
        visible["sulfate_boundary"],
    )
    axes2[1].set_ylabel("Sülfat (mg/L)")
    axes2[1].grid(alpha=0.25)

    axes2[2].plot(
        visible["timestamp"],
        visible["conductivity"],
    )
    axes2[2].set_ylabel("İletkenlik (µS/cm)")
    axes2[2].grid(alpha=0.25)

    fig2.autofmt_xdate()
    st.pyplot(fig2)
    plt.close(fig2)

    st.markdown("### AI anomali skoru")
    fig3, ax3 = plt.subplots(figsize=(11, 4))
    ax3.plot(
        visible["timestamp"],
        scores[max(0, i - 47):i + 1],
        label="Isolation Forest skoru",
    )
    ax3.axhline(
        ai_cutoff,
        linestyle="--",
        label="Sentetik başlangıç eşiği",
    )
    ax3.legend()
    ax3.grid(alpha=0.25)
    fig3.autofmt_xdate()
    st.pyplot(fig3)
    plt.close(fig3)

    with st.expander("Son sentetik kayıtları göster"):
        st.dataframe(
            visible.tail(12),
            use_container_width=True,
        )


live_monitor()
