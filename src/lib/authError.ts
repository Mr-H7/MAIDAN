type AuthFailure = {
  message?: string;
  status?: number;
  code?: string;
};

export function signupFailureMessage(
  error: AuthFailure,
  language: "ar" | "en",
) {
  const message = error.message ?? "";
  const lower = message.toLowerCase();
  const hourlyEmailCap =
    lower.includes("email rate limit exceeded") ||
    (error.code === "over_email_send_rate_limit" &&
      !lower.includes("for security purposes"));
  const shortWait =
    lower.includes("for security purposes") ||
    lower.includes("only request this after");
  if (hourlyEmailCap) {
    return language === "ar"
      ? "وصل ميدان إلى حد إرسال رسائل التأكيد في هذه الساعة. انتظر حوالي ساعة، ثم أنشئ الحساب مرة واحدة. تكرار المحاولة الآن لا يرسل الرسالة."
      : "MAIDAN has reached this hour's confirmation-email limit. Wait about an hour, then create the account once. Repeating the request now does not send the email.";
  }
  if (shortWait) {
    return language === "ar"
      ? "طُلب تأكيد هذا البريد للتو. انتظر دقيقة واحدة، ثم أعد المحاولة مرة واحدة."
      : "A confirmation was just requested for this email. Wait one minute, then try once.";
  }
  return (
    message ||
    (language === "ar" ? "تعذر إنشاء الحساب." : "Could not create the account.")
  );
}
