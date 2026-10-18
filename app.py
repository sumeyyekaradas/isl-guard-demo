
import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

st.set_page_config(
    page_title="ISL Guard",
    page_icon="💧",
    layout="wide"
)

st.title("💧 ISL Guard")
st.subheader("Intelligent ISL Risk Monitoring & Intervention Demo")

st.warning(
    "Proof of concept: all data and thresholds are synthetic. "
    "This is not a validated groundwater leakage prediction system."
)

# Demo controls
st.sidebar.header("Simulation controls")
warning_threshold = st.sidebar.slider(
    "Warning threshold (demo)",
    min_value=1.0,
    max_value=5.0,
    value=3.0,
    step=0.1
)

timeout_hours = st.sidebar.slider(
    "Operator response timeout (hours)",
    min_value=1,
    max_value=6,
    value=2
)

# Generate reproducible demo data
rng = np.random.default_rng(42)
hours = 720
timestamps = pd.date_range(
    "2026-11-01",
    periods=hours,
    freq="h"
)

injection = np.full(hours, 50.0)
extraction = np.full(hours, 50.0)

injection[240:480] += np.linspace(0, 10, 240)
extraction[240:480] += np.linspace(0, -20, 240)

injection[480:] += np.linspace(10, -15, 240)
extraction[480:] += np.linspace(-20, 10, 240)

diurnal = 2 * np.sin(2 * np.pi * np.arange(hours) / 24)
injection += diurnal + rng.normal(0, 1.2, hours)
extraction += diurnal + rng.normal(0, 1.2, hours)

injection = np.maximum(injection, 0)
extraction = np.maximum(extraction, 0)

delta_q = injection - extraction
positive_delta = np.maximum(delta_q, 0)

imbalance = (
    pd.Series(positive_delta)
    .rolling(24, min_periods=1)
    .mean()
    .to_numpy()
)

pressure_in = 250 + 3 * (injection - 50) + rng.normal(0, 5, hours)
pressure_out = 180 + 2.5 * (extraction - 50) + rng.normal(0, 4, hours)

pressure_in = np.maximum(pressure_in, 50)
pressure_out = np.maximum(pressure_out, 30)

gradient_proxy = (pressure_in - pressure_out) / 100 + 0.05 * delta_q

warning = imbalance >= warning_threshold
risk_condition = (gradient_proxy > 1.8) | (imbalance > 4.5)

# Simple illustrative intervention rule
controlled_injection = injection.copy()
active = False
warning_since = None
intervention = np.zeros(hours, dtype=bool)

for i in range(hours):
    if not active:
        if warning[i]:
            if warning_since is None:
                warning_since = i
            if i - warning_since >= timeout_hours:
                active = True
        elif imbalance[i] < warning_threshold * 0.8:
            warning_since = None
    elif imbalance[i] < warning_threshold * 0.8:
        active = False
        warning_since = None

    intervention[i] = active

    if active:
        controlled_injection[i] = min(injection[i], extraction[i])

controlled_delta = np.maximum(controlled_injection - extraction, 0)

# Dashboard
latest = -1
current_status = (
    "INTERVENTION ACTIVE" if intervention[latest]
    else "WARNING" if warning[latest]
    else "NORMAL"
)

col1, col2, col3, col4 = st.columns(4)
col1.metric("Current status", current_status)
col2.metric("Injection rate", f"{injection[latest]:.1f} m³/h")
col3.metric("Extraction rate", f"{extraction[latest]:.1f} m³/h")
col4.metric("Synthetic indicator", f"{imbalance[latest]:.2f}")

st.markdown("### Monitoring trends")

fig, ax = plt.subplots(figsize=(12, 4))
ax.plot(timestamps, injection, label="Injection")
ax.plot(timestamps, extraction, label="Extraction")
ax.set_ylabel("Flow rate (m³/h)")
ax.legend()
ax.grid(alpha=0.25)
st.pyplot(fig)
plt.close(fig)

fig, ax = plt.subplots(figsize=(12, 4))
ax.plot(timestamps, imbalance, label="24-hour imbalance indicator")
ax.axhline(
    warning_threshold,
    linestyle="--",
    label="Warning threshold"
)
ax.axhline(4.5, linestyle=":", label="Synthetic risk threshold")
ax.set_ylabel("Indicator")
ax.legend()
ax.grid(alpha=0.25)
st.pyplot(fig)
plt.close(fig)

st.markdown("### Intervention comparison")

baseline_total = positive_delta.sum()
controlled_total = controlled_delta.sum()

m1, m2, m3 = st.columns(3)
m1.metric("Baseline imbalance (synthetic m³)", f"{baseline_total:.1f}")
m2.metric("Controlled imbalance (synthetic m³)", f"{controlled_total:.1f}")

reduction = (
    100 * (1 - controlled_total / baseline_total)
    if baseline_total > 0 else 0
)
m3.metric("Simulated reduction", f"{reduction:.1f}%")

st.caption(
    "The reduction is a result of the illustrative control rule in synthetic data. "
    "It is not an estimate of real leakage or contamination reduction."
)

st.markdown("### Latest records")
records = pd.DataFrame({
    "Timestamp": timestamps,
    "Injection (m³/h)": injection,
    "Extraction (m³/h)": extraction,
    "Imbalance indicator": imbalance,
    "Synthetic risk condition": risk_condition,
    "Intervention active": intervention
})
st.dataframe(records.tail(24), use_container_width=True)
