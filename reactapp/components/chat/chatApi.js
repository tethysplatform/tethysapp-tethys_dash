function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function sendMessage({ prompt, dashboardId }) {
  const res = await fetch("/tethysdash/chat/message", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
    },
    body: JSON.stringify({ prompt, dashboard_id: dashboardId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Chat request failed (${res.status}): ${detail || res.statusText}`);
  }
  return res.json();
}
