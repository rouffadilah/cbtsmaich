const endpointMap = {
  startExam: "/api/start-exam",
  saveAnswer: "/api/save-answer",
  reportViolation: "/api/report-violation",
  submitExam: "/api/submit-exam"
};

export function httpsCallable(_functions, name) {
  const endpoint = endpointMap[name];
  if (!endpoint) throw new Error(`Endpoint backend tidak dikenal: ${name}`);

  return async (data = {}) => {
    const { auth } = await import("./firebase-config.js");
    const user = auth.currentUser;
    if (!user) throw new Error("Sesi login tidak valid.");

    const idToken = await user.getIdToken();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify(data)
    });

    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(payload.error || "Permintaan ke server gagal.");
    return { data: payload };
  };
}
