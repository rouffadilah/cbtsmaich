const endpointMap = {
  startExam: "/api/start-exam",
  saveAnswer: "/api/save-answer",
  reportViolation: "/api/report-violation",
  submitExam: "/api/submit-exam"
};

// Compatibility value for legacy attempt.js calls: httpsCallable(functions, ...).
// Vercel endpoints do not need a Firebase Functions instance.
if (typeof globalThis.functions === "undefined") globalThis.functions = null;

const revisionState = new Map();
const pendingRequests = new Set();

export function getPendingExamWrites() {
  return [...pendingRequests];
}

export function httpsCallable(_functions, name) {
  const endpoint = endpointMap[name];
  if (!endpoint) throw new Error(`Endpoint backend tidak dikenal: ${name}`);

  return async (data = {}) => {
    const { auth } = await import("./firebase-config.js");
    const user = auth.currentUser;
    if (!user) throw new Error("Sesi login tidak valid.");

    const payload = { ...data };
    if (name === "saveAnswer" && payload.attemptId && payload.questionId) {
      const key = `${payload.attemptId}:${payload.questionId}`;
      const next = Math.max(Date.now(), (revisionState.get(key) || 0) + 1);
      revisionState.set(key, next);
      payload.revision = next;
    }

    const idToken = await user.getIdToken();
    const requestPromise = (async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      let responsePayload = {};
      try { responsePayload = await response.json(); } catch (_) {}
      if (!response.ok) throw new Error(responsePayload.error || "Permintaan ke server gagal.");

      // Saat refresh/retry, pulihkan jawaban server ke backup lokal.
      if (name === "startExam" && responsePayload.attemptId && responsePayload.savedAnswers) {
        try {
          const localKey = `cbt_ans_${user.uid}_${responsePayload.attemptId}`;
          const current = JSON.parse(localStorage.getItem(localKey) || "{}");
          localStorage.setItem(localKey, JSON.stringify({
            jawabanSiswa: { ...(current.jawabanSiswa || {}), ...(responsePayload.savedAnswers || {}) },
            raguRagu: { ...(current.raguRagu || {}), ...(responsePayload.savedRaguRagu || {}) }
          }));
        } catch (_) {}
      }

      return { data: responsePayload };
    })();

    pendingRequests.add(requestPromise);
    try {
      return await requestPromise;
    } finally {
      pendingRequests.delete(requestPromise);
    }
  };
}
